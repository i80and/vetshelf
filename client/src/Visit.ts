/// <reference path="typings/moment/moment.d.ts" />

import * as util from './util'

class Visit {
    date: moment.Moment
    tags: string[]
    note: string
    committed: any

    constructor(date: moment.Moment, tags: string[], note: string, options: any) {
        if(options === undefined) { options = {} }

        this.date = date || moment()
        this.tags = tags || []
        this.note = note || ''

        Object.seal(this)
    }

    serialize(): any {
        return {
            type: 'visit',
            date: this.date.toISOString(),
            tags: this.tags,
            committed: this.committed,
            note: this.note
        }
    }

    static deserialize(data: any): Visit {
        if(data.type !== 'visit') {
            throw util.error('ValueError', `Not a visit instance: ${data.type}`)
        }

        const date = moment(data.date)
        return new Visit(date, data.tags, data.note, data)
    }
}

export default Visit
