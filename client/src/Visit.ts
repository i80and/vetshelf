/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'

export default class Visit {
    id: string
    _date: moment.Moment
    _tasks: string[]
    _weightKg: number
    _note: string

    private dirty: Set<string>

    constructor(id: string, date: moment.Moment, tasks: string[], weightKg: number, note: string) {
        this.id = id
        this._date = date || moment()
        this._tasks = tasks || []
        this._weightKg = weightKg || 0.0
        this._note = note || ''

        this.dirty = new Set<string>()

        Object.freeze(this.tasks)
    }

    with(fields: {date?: moment.Moment, note?: string, tasks?: string[], weightKg?: number}): Visit {
        const result = new Visit(this.id, this.date, this.tasks, this.weightKg, this.note)
        if(fields.date !== undefined) { result.date = fields.date }
        if(fields.tasks !== undefined) { result.tasks = fields.tasks }
        if (fields.weightKg !== undefined) { result.weightKg = fields.weightKg }
        if(fields.note !== undefined) { result.note = fields.note }
        return result
    }

    get date() { return this._date }
    set date(val) {
        this.dirty.add('date')
        this._date = val
    }

    get tasks() { return this._tasks }
    set tasks(val) {
        this.dirty.add('tasks')
        this._tasks = val
    }

    get weightKg(): number { return this._weightKg }
    set weightKg(val: number) {
        this.dirty.add('kg')
        this._weightKg = val
    }

    get note() { return this._note }
    set note(val) {
        this.dirty.add('note')
        this._note = val
    }

    clearDirty() {
        this.dirty.clear()
    }

    serialize() {
        return {
            id: this.id,
            date: this.date.toISOString(),
            tasks: this.tasks,
            kg: this.weightKg,
            note: this.note,

            dirty: Array.from(this.dirty)
        }
    }

    static deserialize(data: any): Visit {
        const date = moment(data.date, moment.ISO_8601)
        if (!date.isValid()) {
            throw util.valueError.error(`Error parsing date string: ${data.date}`)
        }
        return new Visit(data.id, date, data.tasks, data.kg, data.note)
    }

    static emptyVisit(): Visit {
        return new Visit(null, moment(), [], 0.0, '')
    }
}
