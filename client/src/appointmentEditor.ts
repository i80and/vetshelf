/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/mithril/mithril.d.ts" />

import * as calendarWidget from './calendarWidget'
import Visit from './Visit'

export class Model {
    appointment: Visit
    calendar: calendarWidget.CalendarModel
    onsave: (m: Model)=>void
    ondelete: ()=>void

    rawTags: any

    constructor(appointment: Visit) {
        this.appointment = appointment
        this.calendar = new calendarWidget.CalendarModel()
        this.calendar.selected = appointment.date.clone()
        this.calendar.showing = appointment.date.clone()

        this.rawTags = m.prop('')
        this.onsave = () => {}
        this.ondelete = () => {}

        Object.seal(this)
    }

    getNewAppointment(): Visit {
        return this.appointment.with({tags: this.tags, date: this.date})
    }

    get date() {
        return this.calendar.selected
    }

    get tags() {
        return this.rawTags().split(/[^a-z]+/)
    }
}

interface ViewConfig {
    onsave?: (m: Model) => void;
    ondelete?: () => void;
}

export function view(model: Model, options: ViewConfig={}) {
    if(!options.onsave) options.onsave = () => {}
    if(!options.ondelete) options.ondelete = () => {}

    return m('div.appointment-editor-widget', {}, [
        calendarWidget.monthWidget(model.calendar),
        m('div', {}, [
            m('input', { onchange: m.withAttr('value', model.rawTags), placeholder: 'Completed Tasks' }),
        ]),
        m('div.button-strip', {}, [
            m('button.button-primary', { onclick: () => options.onsave(model) }, 'Save'),
            m('button.button-error', { onclick: () => options.ondelete() }, 'Delete')
        ])
    ])
}
