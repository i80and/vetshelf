/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'
import Visit from './Visit'

export default class Patient {
    id: string
    _name: string
    _sex: string
    _species: string
    _breed: string
    _description: string
    _note: string
    _active: boolean
    _due: Map<string, moment.Moment>

    visits: Visit[]
    private dirty: Set<string>

    constructor(id: string, options: any) {
        this.id = id
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
        this.dirty = new Set<string>()

        Object.seal(this)
    }

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

    dueByDate() {
        // First collapse periodicals due on the same date
        const dateMap = new Map<string, string[]>()
        for(let [name, date] of this._due) {
            const dateString = date.toISOString()
            if(!dateMap.has(dateString)) { dateMap.set(dateString, []) }
            dateMap.get(dateString).push(name)
        }

        // Reconvert the string dates back to date objects, and sort by date
        return Array.from(dateMap.entries()).map((kv) => {
            const result: [moment.Moment, string[]] = [moment(kv[0]), kv[1]]
            return result
        }).sort((a, b) => a[0].unix() - b[0].unix())
    }

    clearDirty(): void {
        this.dirty.clear()
    }

    serialize() {
        return {
            type: 'patient',
            id: this.id,
            name: this.name,
            sex: this._sex,
            species: this.species,
            breed: this.breed,
            description: this.description,
            note: this.note,
            active: this.active,

            visits: this.visits,
            dirty: Array.from(this.dirty)
        }
    }

    static deserialize(data: any) {
        if (data.type !== 'patient') {
            throw util.valueError.error(`Not a patient instance: ${data.type}`)
        }

        data.visits = data.visits.map((v: any) => Visit.deserialize(v))
        const patient = new Patient(data.id, data)

        const due = new Map<string, moment.Moment>()
        for (let name in data.due) {
            if (data.due[name] === null) {
                due.set(name, null)
            } else {
                due.set(name, moment(data.due[name]))
            }
        }

        patient._due = due

        return patient
    }

    static emptyPatient(): Patient {
        return new Patient(null, {active: true})
    }
}
