/// <reference path="typings/moment/moment.d.ts" />

export default class Visit {
    id: string
    date: moment.Moment
    tasks: string[]
    note: string
    committed: any

    constructor(id: string, date: moment.Moment, tasks: string[], note: string) {
        this.id = id
        this.date = date || moment()
        this.tasks = tasks || []
        this.note = note || ''

        Object.freeze(this.tasks)
    }

    with(fields: {date?: moment.Moment, note?: string, tasks?: string[]}): Visit {
        return new Visit(this.id,
                         (fields.date === undefined) ? this.date : fields.date,
                         (fields.tasks === undefined) ? this.tasks : fields.tasks,
                         (fields.note === undefined) ? this.note : fields.note)
    }

    serialize() {
        return {
            id: this.id,
            date: this.date.toISOString(),
            tasks: this.tasks,
            committed: this.committed,
            note: this.note
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
