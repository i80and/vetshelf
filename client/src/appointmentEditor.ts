/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/mithril/mithril.d.ts" />

import * as calendarWidget from './calendarWidget'
import Visit from './Visit'

export class Model {
    appointment: Visit
    calendar: calendarWidget.CalendarModel
    onsave: (m: Model)=>void
    ondelete: ()=>void

    rawTasks: (p?: string)=>string
    weightKg: (p?: number)=>number

    constructor(appointment: Visit) {
        this.appointment = appointment
        this.calendar = new calendarWidget.CalendarModel()
        this.calendar.selected = appointment.date.clone()
        this.calendar.showing = appointment.date.clone()

        this.rawTasks = m.prop(this.appointment.tasks.join(','))
        this.weightKg = m.prop(this.appointment.weightKg)
        this.onsave = () => {}
        this.ondelete = () => {}

        Object.seal(this)
    }

    getNewAppointment(): Visit {
        return this.appointment.with({
            tasks: this.tasks,
            date: this.date,
            weightKg: this.weightKg()})
    }

    get date() {
        return this.calendar.selected
    }

    get tasks() {
        return this.rawTasks().split(/[^a-z]+/)
    }
}

interface ViewConfig {
    onsave?: (m: Model) => void;
    ondelete?: () => void;
}

export function view(model: Model, options: ViewConfig={}) {
    if(!options.onsave) { options.onsave = () => {} }
    if(!options.ondelete) { options.ondelete = () => {} }

    return m('div.appointment-editor-widget', {}, [
        calendarWidget.monthWidget(model.calendar),
        m('div', {}, [
            m('input', {
                onchange: m.withAttr('value', model.rawTasks),
                value: model.rawTasks(),
                placeholder: 'Completed Tasks' }),
            m('input', {
                onchange: function() {
                    if(this.value === '') {
                        model.weightKg(0.0)
                        return
                    }
                    model.weightKg(parseFloat(this.value))
                },
                type: 'number',
                value: model.weightKg() <= 0 ? '' : model.weightKg(),
                placeholder: 'Weight (kg)'
            }),
        ]),
        m('div.button-strip', {}, [
            m('button.button-primary', { onclick: () => options.onsave(model) }, 'Save'),
            m('button.button-error', { onclick: () => options.ondelete() }, 'Delete')
        ])
    ])
}
