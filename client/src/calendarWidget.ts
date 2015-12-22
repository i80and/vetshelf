/// <reference path="typings/mithril/mithril.d.ts" />
/// <reference path="typings/moment/moment.d.ts" />

// XXX This widget is actually quite slow due to very heavy (200+ calls per
// draw) use of moment. Much of it is unnecessary; we can cache almost everything,
// either at the moment-level or at the draw level. Or both!

interface ViewConfig {
    onchange?: (d:moment.Moment) => void;
}

function listWeekdays() {
    const firstDayOfWeek = moment.localeData().firstDayOfWeek()
    const weekdays = [
        moment.weekdaysMin(0 + firstDayOfWeek),
        moment.weekdaysMin(1 + firstDayOfWeek),
        moment.weekdaysMin(2 + firstDayOfWeek),
        moment.weekdaysMin(3 + firstDayOfWeek),
        moment.weekdaysMin(4 + firstDayOfWeek),
        moment.weekdaysMin(5 + firstDayOfWeek),
        moment.weekdaysMin(6 + firstDayOfWeek) ]

    return weekdays
}

export class CalendarModel {
    events: Map<any, any>
    selected: moment.Moment
    daysInMonth: number
    _showing: moment.Moment

    constructor() {
        this.events = new Map<string, any>()
        this.selected = null
        this.showing = moment()

        Object.seal(this)
    }

    get value() { return this.selected }

    set showing(m: moment.Moment) {
        this._showing = m
        this.daysInMonth = m.daysInMonth()
    }

    get showing() { return this._showing }

    getEvents(month: moment.Moment) {
        return this.events.get(month.format('YYYY-MM-DD'))
    }

    addMonth(n: number) {
        m.startComputation()
        this.showing.add(n, 'months')
        m.endComputation()
    }

    addYear(n: number) {
        m.startComputation()
        this.showing.add(n, 'years')
        m.endComputation()
    }

    today() {
        m.startComputation()
        this.showing = moment()
        m.endComputation()
    }
}

function selectDay(model: CalendarModel, day: moment.Moment, options: ViewConfig) {
    model.selected = day
    if(options.onchange) { options.onchange.bind(model)(day) }
}

function renderMonthDay(model: CalendarModel, cursor: moment.Moment, options: ViewConfig) {
    const elementOptions: any = {}
    if(cursor.month() !== model.showing.month()) {
        elementOptions.class = 'outside-month'
    }

    if(cursor.isSame(model.selected, 'day')) {
        elementOptions.class += ' selected'
    }

    elementOptions.onclick = selectDay.bind(null, model, cursor.clone(), options)

    const element = m('td', elementOptions, [
        m('div.day-number', cursor.date())
    ])

    cursor.add(1, 'day')

    return element
}

function renderMonthWeek(model: CalendarModel, cursor: moment.Moment, options: ViewConfig) {
    return m('tr', [
        renderMonthDay(model, cursor, options),
        renderMonthDay(model, cursor, options),
        renderMonthDay(model, cursor, options),
        renderMonthDay(model, cursor, options),
        renderMonthDay(model, cursor, options),
        renderMonthDay(model, cursor, options),
        renderMonthDay(model, cursor, options)
    ])
}

export function monthWidget(model: CalendarModel, options: ViewConfig={}) {
    const cursor = model.showing.clone()
    cursor.startOf('month')
    cursor.startOf('week')

    return m('table.calendar-month-widget', [
        m('thead', [
            m('th', { colspan: '7' }, model.showing.format('MMMM YYYY')),
            m('tr', [
                m('th.calendar-button', { onclick: () => model.addYear(-1) }, '«'),
                m('th.calendar-button', { onclick: () => model.addMonth(-1) }, '‹'),
                m('th.calendar-button', { onclick: () => model.today(), colspan: '3' }, 'Today'),
                m('th.calendar-button', { onclick: () => model.addMonth(1) }, '›'),
                m('th.calendar-button', { onclick: () => model.addYear(1) }, '»')]),
            m('tr', listWeekdays().map((name) => m('th', name))),
        ]),
        renderMonthWeek(model, cursor, options),
        renderMonthWeek(model, cursor, options),
        renderMonthWeek(model, cursor, options),
        renderMonthWeek(model, cursor, options),
        renderMonthWeek(model, cursor, options),
        renderMonthWeek(model, cursor, options)
    ])
}
