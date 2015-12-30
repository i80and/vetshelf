/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'
import Visit from './Visit'

class TaskIntervals {
    static get tasks() { return [ 'heartworm', 'exam', 'rabies' ] }

    static task(taskName: string, lastVisit: moment.Moment): moment.Moment {
        return (<any>TaskIntervals)[taskName](lastVisit)
    }

    static heartworm(lastVisit: moment.Moment): moment.Moment {
        return lastVisit.clone().add(6, 'months')
    }

    static exam(lastVisit: moment.Moment): moment.Moment {
        return TaskIntervals.heartworm(lastVisit)
    }

    static rabies(lastVisit: moment.Moment): moment.Moment {
        return lastVisit.clone().add(1, 'year')
    }
}

type patientID = string

interface ISerializedPatient {
    type: string,
    _id: patientID,
    _rev: string,
    name: string,
    sex: string,
    species: string,
    breed: string,
    description: string,
    note: string,
    active: boolean
    visits: any[]
    due: { [s: string]: string }
}

interface ISummary {
    [index:string]: string

    _id: string,
    name: string,
    sex: string,
    species: string,
    breed: string
    description: string,
    rabies?: string,
    note: string
}

export default class Patient {
    _id: patientID
    _rev: string
    private _name: string
    private _sex: string
    private _species: string
    private _breed: string
    private _description: string
    private _note: string
    private _active: boolean
    private _due: Map<string, moment.Moment>

    private _visits: Visit[]
    private dirty: Set<string>

    constructor(id: patientID, options: any) {
        this._id = id
        this._rev = options._rev
        this._name = options.name || '(unnamed)'
        this._sex = options.sex || '?+'
        this._species = options.species || ''
        this._breed = options.breed || ''
        this._description = options.description || ''
        this._note = options.note || ''
        this._active = options.active || false

        this._due = options.due || new Map<string, moment.Moment>()

        if(this._active === undefined) {
            this._active = true
        }

        this.visits = options.visits || []
        this.refreshDueDates()
        this.dirty = new Set<string>()

        Object.seal(this)
    }

    get id(): patientID { return this._id }
    set id(val: patientID) { this._id = val }

    get isDirty(): boolean { return this.dirty.size > 0 }

    get name() { return this._name }
    set name(val) {
        this.dirty.add('name')
        this._name = val
    }

    get breed() { return this._breed }
    set breed(val) {
        this.dirty.add('breed')
        this._breed = val
    }

    get species() { return this._species }
    set species(val) {
        this.dirty.add('species')
        this._species = val
    }

    get description() { return this._description }
    set description(val) {
        this.dirty.add('description')
        this._description = val
    }

    get note() { return this._note }
    set note(val) {
        this.dirty.add('note')
        this._note = val
    }

    get active() { return this._active }
    set active(val) {
        this.dirty.add('active')
        this._active = val
    }

    get sex() { return this._sex[0] }
    set sex(val) {
        if(['f', 'm', '?'].indexOf(val) < 0) {
            throw util.valueError.error(`Invalid sex string: ${val}`)
        }

        this.dirty.add('sex')
        this._sex = `${val}${this._sex[1]}`
    }

    get intact() { return this._sex[1] === '+' }
    set intact(val) {
        this.dirty.add('sex')
        const newVal = val? '+' : '-'
        this._sex = `${this.sex}${newVal}`
    }

    set visits(visits: Visit[]) {
        this._visits = visits.slice()
        this._visits.sort((a, b) => b.date.diff(a.date))
        Object.freeze(this._visits)
    }

    get visits(): Visit[] {
        return this._visits
    }

    insertVisit(): Visit {
        const visit = Visit.emptyVisit()
        visit.id = util.genID('v')
        const copy = this.visits.slice()
        copy.push(visit)
        this.visits = copy
        this.dirty.add('visits')

        return visit
    }

    updateVisit(visit: Visit): void {
        let dirty = false
        this._visits = this._visits.map((v) => {
            if(v.id === visit.id) {
                this.dirty.add('visits')
                dirty = true
                return visit
            }

            return v
        })

        if (dirty) { this.refreshDueDates() }
    }

    deleteVisit(visitID: string): void {
        this._visits = this._visits.filter((v) => v.id !== visitID)
        this.refreshDueDates()
        this.dirty.add('visits')
    }

    dueByDate(): [moment.Moment, string[]][] {
        // First collapse periodicals due on the same date
        const dateMap = new Map<string, string[]>()
        for(let [name, date] of this._due) {
            const dateString = date.toISOString()
            if(!dateMap.has(dateString)) { dateMap.set(dateString, []) }
            dateMap.get(dateString).push(name)
        }

        // Reconvert the string dates back to date objects, and sort by date
        return Array.from(dateMap.entries()).map((kv) => {
            const result: [moment.Moment, string[]] = [moment(kv[0], moment.ISO_8601), kv[1]]
            if(!result[0].isValid()) {
                throw util.valueError.error(`Error parsing date string: ${kv[0]}`)
            }
            return result
        }).sort((a, b) => a[0].unix() - b[0].unix())
    }

    clearDirty(): void {
        this.dirty.clear()
    }

    // Return the most recent Visit where the given task was performed
    lastVisitWithTask(taskName: string): Visit {
        return this.visits.filter((visit) => {
            return visit.tasks.findIndex((task) => task.name == taskName) >= 0
        }).sort((a, b) => {
            const diff = a.date.diff(b.date)
            if (diff > 0) { return 1 }
            else if (diff < 0) { return -1 }
            return 0
        })[0] || null
    }

    refreshDueDates(): void {
        const dueDates = new Map<string, moment.Moment>()
        for (let taskName of TaskIntervals.tasks) {
            const lastVisit = this.lastVisitWithTask(taskName)
            if (lastVisit === null) {
                dueDates.set(taskName, moment())
                continue
            }

            dueDates.set(taskName, TaskIntervals.task(taskName, lastVisit.date))
        }

        this._due = dueDates
    }

    serialize(): ISerializedPatient {
        this.refreshDueDates()
        const dueDates: { [s: string]: string } = {}
        for(let [taskName, dueDate] of this._due) {
            dueDates[taskName] = dueDate.toISOString()
        }

        return {
            type: 'patient',
            _id: this._id,
            _rev: this._rev,
            name: this.name,
            sex: this._sex,
            species: this.species,
            breed: this.breed,
            description: this.description,
            note: this.note,
            active: this.active,

            visits: this._visits.map((v) => v.serialize()),
            due: dueDates
        }
    }

    summarize(): ISummary {
        const terms: string[] = []
        if(this.sex === 'm') {
            terms.push('male')
            if (!this.intact) { terms.push('neuter') }
        } else if(this.sex === 'f') {
            terms.push('female')
            if (!this.intact) { terms.push('spay') }
        }

        if (this.intact) { terms.push('intact') }
        else { terms.push('fixed') }

        const fields: ISummary = {
            _id: this._id,
            name: this.name,
            sex: terms.join(' '),
            species: this.species,
            breed: this.breed,
            description: this.description,
            note: this.note,
        }

        const rabiesVisit = this.lastVisitWithTask('rabies')
        if (rabiesVisit && rabiesVisit.task('rabies')) {
            fields.rabies = rabiesVisit.task('rabies').rabiesTag
        }

        return fields
    }

    static deserialize(data: ISerializedPatient) {
        if (data.type !== 'patient') {
            throw util.valueError.error(`Not a patient instance: ${data.type}`)
        }

        data.visits = data.visits.map((v: any) => Visit.deserialize(v))
        const patient = new Patient(data._id, data)

        return patient
    }

    static emptyPatient(): Patient {
        return new Patient(null, {active: true})
    }
}
