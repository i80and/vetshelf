/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'

export default class Visit {
    id: string
    private _date: moment.Moment
    private _tasks: { [index: string]: ITask }
    private _weightKg: number
    private _note: string

    constructor(id: string, date: moment.Moment, tasks: { [index: string]: ITask }, weightKg: number, note: string) {
        this.id = id
        this._date = date || moment()
        this._tasks = tasks || {}
        this._weightKg = weightKg || 0.0
        this._note = note || ''

        Object.freeze(this._tasks)
    }

    with(fields: { date?: moment.Moment, note?: string, tasks?: ITask[], weightKg?: number }): Visit {
        const result = new Visit(this.id, this.date, this._tasks, this.weightKg, this.note)
        if (fields.date !== undefined) { result.date = fields.date }
        if (fields.tasks !== undefined) { result.tasks = fields.tasks }
        if (fields.weightKg !== undefined) { result.weightKg = fields.weightKg }
        if (fields.note !== undefined) { result.note = fields.note }
        return result
    }

    get date() { return this._date }
    set date(val) {
        this._date = val
    }

    get tasks(): ITask[] {
        const tasks: ITask[] = []
        for (let key in this._tasks) {
            if (!this._tasks.hasOwnProperty(key)) { continue }
            tasks.push(this._tasks[key])
        }

        return tasks
    }

    set tasks(val) {
        const newTasks: { [index: string]: ITask } = {}
        for (let task of val) {
            newTasks[task.name] = task
        }

        this._tasks = newTasks
    }

    get weightKg(): number { return this._weightKg }
    set weightKg(val: number) {
        this._weightKg = val
    }

    get note() { return this._note }
    set note(val) {
        this._note = val
    }

    get cost() {
        return this.tasks.reduce((previousValue, currentValue) => {
            return previousValue + Number(currentValue.charge)
        }, 0)
    }

    task(name: string): ITask {
        return this._tasks[name] || null
    }

    rabiesTag(): string {
        if (this._tasks.hasOwnProperty('rabies')) {
            return this._tasks['rabies'].rabiesTag || ''
        }

        return ''
    }

    serialize() {
        return {
            id: this.id,
            date: this.date.toISOString(),
            tasks: this._tasks,
            kg: this.weightKg,
            note: this.note
        }
    }

    static deserialize(data: any): Visit {
        const date = moment(data.date, moment.ISO_8601)
        if (!date.isValid()) {
            throw util.valueError.error(`Error parsing date string: ${data.date}`)
        }

        // Validate the tasks
        const tasks: { [index: string]: ITask } = {}
        for (let key in data.tasks) {
            if (!data.tasks.hasOwnProperty(key)) { continue }
            const task = data.tasks[key]

            if (!task.name) {
                throw util.valueError.error(`Bad task name: ${task.name}`)
            }

            tasks[task.name] = task
        }

        return new Visit(data.id,
            date,
            tasks,
            data.kg,
            data.note)
    }

    static emptyVisit(): Visit {
        return new Visit(null, moment(), {}, 0.0, '')
    }
}

export interface ITask {
    name: string
    charge: number

    rabiesTag?: string
}
