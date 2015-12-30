/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/mithril/mithril.d.ts" />

import * as calendarWidget from './calendarWidget'
import * as combobox from './editableComboboxWidget'
import Visit from './Visit'
import * as visit from './Visit'

export class Model {
    appointment: Visit
    calendar: calendarWidget.CalendarModel
    tasks: visit.Visit.ITask[]

    weightKg: (p?: number)=>number
    note: (p?: string)=>string

    constructor(appointment: Visit) {
        this.appointment = appointment
        this.calendar = new calendarWidget.CalendarModel()
        this.calendar.selected = appointment.date.clone()
        this.calendar.showing = appointment.date.clone()

        this.tasks = appointment.tasks.slice()

        this.weightKg = m.prop(this.appointment.weightKg)
        this.note = m.prop(this.appointment.note)

        Object.seal(this)
    }

    getNewAppointment(): Visit {
        this.appointment = this.appointment.with({
            tasks: this.tasks.filter((task) => Boolean(task.name)),
            date: this.date,
            weightKg: this.weightKg(),
            note: this.note()})
        return this.appointment
    }

    get date() {
        return this.calendar.selected
    }
}

interface IViewConfig {
    onedit?: (m: Model) => void
    ondelete?: () => void
}

function renderEditTasks(model: Model, options: IViewConfig): MithrilVirtualElement {
    const rows: MithrilVirtualElement[] = []
    for(let task of model.tasks) {
        rows.push(m('div', [
            m('input', {
                placeholder: 'Task',
                value: task.name,
                oninput: function() {
                    task.name = this.value
                    options.onedit(model)
                }
            }),
            m('input[type=number]', {
                placeholder: 'Charge',
                value: task.charge || '',
                step: '0.01',
                oninput: function() {
                    const val = Number.parseFloat(this.value)
                    if (!isNaN(val)) {
                        task.charge = val
                    }

                    options.onedit(model)
                }
            })]))
    }

    rows.push(m('div', [
        m('span'), m('span', '$' + model.appointment.cost)]))

    return m('div.condensed-entry-list', rows)
}

function renderExtras(model: Model, options: IViewConfig) {
    const elements: MithrilVirtualElement[] = []

    const rabiesTask = model.appointment.task('rabies')
    if (rabiesTask !== null) {
        elements.push(
            m('input', {
                placeholder: 'Rabies Tag',
                value: rabiesTask['rabiesTag'] || '',
                oninput: function() {
                    rabiesTask['rabiesTag'] = this.value
                    options.onedit(model)
                }
            }))
    }

    return elements
}

export function view(model: Model, options: IViewConfig={}) {
    if (!options.onedit) { options.onedit = () => {} }
    if (!options.ondelete) { options.ondelete = () => {} }

    model.tasks = model.tasks.filter((task) => Boolean(task.name))
    model.tasks.push({ name: '', charge: 0 })

    return m('div.appointment-editor-widget', {}, [
        calendarWidget.monthWidget(model.calendar, {
            onchange: () => { options.onedit(model) }
        }),
        m('div', {}, [
            m('input', {
                oninput: function() {
                    if(this.value === '') {
                        model.weightKg(0.0)
                        return
                    }
                    model.weightKg(parseFloat(this.value))
                    options.onedit(model)
                },
                type: 'number',
                step: 'any',
                value: model.weightKg() <= 0 ? '' : model.weightKg(),
                placeholder: 'Weight (kg)'
            }),
            renderEditTasks(model, options),
            renderExtras(model, options),
            m('textarea', {
                value: model.appointment.note,
                oninput: function() {
                    model.note(this.value)
                    options.onedit(model)
                },
                rows: 6,
                placeholder: 'Notes'
            })
        ]),
        m('div.button-strip', {}, [
            m('button.button-error', { onclick: () => options.ondelete() }, 'Delete')
        ])
    ])
}
