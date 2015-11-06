/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'

class Visit {
    id: string
    date: moment.Moment
    tags: string[]
    note: string
    committed: any

    constructor(id: string, date: moment.Moment, tags: string[], note: string, options: any) {
        if(options === undefined) { options = {} }

        this.id = id
        this.date = date || moment()
        this.tags = tags || []
        this.note = note || ''

        Object.seal(this)
    }

    serialize(): any {
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
        return new Visit(data.id, date, data.tags, data.note, data)
    }
}

export default Visit
