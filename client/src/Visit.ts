/// <reference path="typings/moment/moment.d.ts" />

export default class Visit {
    id: string
    _date: moment.Moment
    _tasks: string[]
    _note: string
    committed: any

    private dirty: Set<string>

    constructor(id: string, date: moment.Moment, tasks: string[], note: string) {
        this.id = id
        this._date = date || moment()
        this._tasks = tasks || []
        this._note = note || ''

        this.dirty = new Set<string>()

        Object.freeze(this.tasks)
    }

    with(fields: {date?: moment.Moment, note?: string, tasks?: string[]}): Visit {
        const result = new Visit(this.id, this.date, this.tasks, this.note)
        if(fields.date !== undefined) { result.date = fields.date }
        if(fields.tasks !== undefined) { result.tasks = fields.tasks }
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
            committed: this.committed,
            note: this.note,

            dirty: Array.from(this.dirty)
        }
    }

    static deserialize(data: any): Visit {
        const date = moment(data.date)
        return new Visit(data.id, date, data.tasks, data.note)
    }

    static emptyVisit(): Visit {
        return new Visit(null, moment(), [], '')
    }
}
