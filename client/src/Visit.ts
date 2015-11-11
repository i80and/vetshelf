/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'

export default class Visit {
    id: string
    date: moment.Moment
    tags: string[]
    note: string
    committed: any

    constructor(id: string, date: moment.Moment, tags: string[], note: string) {
        this.id = id
        this.date = date || moment()
        this.tags = tags || []
        this.note = note || ''

        Object.freeze(this.tags)
    }

    with(fields: {date?: moment.Moment, note?: string, tags?: string[]}): Visit {
        return new Visit(this.id,
                         (fields.date === undefined) ? this.date : fields.date,
                         (fields.tags === undefined) ? this.tags : fields.tags,
                         (fields.note === undefined) ? this.note : fields.note)
    }

    serialize() {
        return {
            id: this.id,
            type: 'visit',
            date: this.date.toISOString(),
            tags: this.tags,
            committed: this.committed,
            note: this.note
        }
    }

    static deserialize(data: any): Visit {
        if(data.type !== 'visit') {
            throw util.valueError.error(`Not a visit instance: ${data.type}`)
        }

        const date = moment(data.date)
        return new Visit(data.id, date, data.tags, data.note)
    }
}
