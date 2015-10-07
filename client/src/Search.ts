/// <reference path="typings/mithril/mithril.d.ts" />
/// <reference path="typings/moment/moment.d.ts" />

import Client from './Client'
import Connection from './Connection'
import Patient from './Patient'
import SearchResults from './SearchResults'
import Visit from './Visit'
import * as optionsWidget from './optionsWidget'
import toggleWidget from './toggleWidget'
import * as util from './util'

const PAUSE_INTERVAL_MS = 200

export class ViewModel {
    private timeoutID: number
    results: SearchResults
    selected: any

    constructor() {
        this.timeoutID = -1
        this.results = new SearchResults([])

        this.selected = null

        this.showUpcoming()
    }

    get dirty() {
        if(!this.selected) { return false }
        return this.selected.dirty
    }

    isSelected(record: any) {
        if(this.selected === null) { return false }

        if(this.selected.id === record.id) {
            return true
        }

        if((record instanceof Client) && record.hasPet(this.selected.id)) {
            return true
        }

        return false
    }

    search(query: string) {
        if(query === '') { return this.showUpcoming() }

        // Don't search unless there's been a pause
        if(this.timeoutID >= 0) {
            window.clearTimeout(this.timeoutID)
        }

        this.timeoutID = window.setTimeout(() => {
            this.timeoutID = -1
            this.__search(query)
        }, PAUSE_INTERVAL_MS)
    }

    addClient() {
        const client = new Client(null, {})

        m.startComputation()
        Connection.theConnection.saveClient(client).then((id: string) => {
            return this.selectClient(id)
        }).then(() => {
            m.endComputation()
        }).catch((msg) => {
            console.error(msg)
            m.endComputation()
        })
    }

    addPatient() {
        if(!(this.selected instanceof Client)) {
            throw util.error('TypeError', 'Cannot create patient child of selection')
        }

        if(!this.selected.id) {
            throw util.error('ValueError', 'Selection has no ID')
        }

        const patient = new Patient(null, {})
        const clientID = this.selected.id

        m.startComputation()
        Connection.theConnection.savePatient(patient, [clientID]).then((id: string) => {
            return this.selectPatient(id)
        }).then((patient) => {
            this.results.addPatient(patient, clientID)
            m.endComputation()
        }).catch((msg) => {
            console.error(msg)
            m.endComputation()
        })
    }

    addAppointment() {}

    save() {
        if(!this.dirty) { return }

        let saver: (record:any)=>any = null
        let getter: (id:string)=>any = null
        if(this.selected instanceof Client) {
            saver = Connection.theConnection.saveClient.bind(Connection.theConnection)
            getter = this.selectClient.bind(this)
        } else if(this.selected instanceof Patient) {
            saver = Connection.theConnection.savePatient.bind(Connection.theConnection)
            getter = this.selectPatient.bind(this)
        } else {
            return
        }

        m.startComputation()
        saver(this.selected).catch((msg: any) => {
            console.error(msg)
            m.endComputation()
        }).then(() => {
            getter(this.selected.id)
            if(this.results && this.selected) {
                this.results.updateRecord(this.selected)
            }
            m.endComputation()
        })
    }

    revert() {
        if(!this.dirty) { return }

        if(!window.confirm('Are you sure you want to revert your working changes?')) {
            return
        }

        if(this.selected instanceof Client) {
            return this.selectClient(this.selected.id)
        } else if(this.selected instanceof Patient) {
            return this.selectPatient(this.selected.id)
        }
    }

    showUpcoming() {
        m.startComputation()

        Connection.theConnection.showUpcoming().then((results) => {
            this.results = results
            m.endComputation()
        }).catch((err) => {
            console.error(err)
            this.results.clear()
            m.endComputation()

        })
    }

    selectClient(id: string) {
        return this.__selectRecord(id, (id:string) => Connection.theConnection.getClients([id]))
    }

    selectPatient(id: string) {
        return this.__selectRecord(id, (id:string) => Connection.theConnection.getPatients([id]))
    }

    __selectRecord(id: string, getter: (id:string)=>any) {
        m.startComputation()
        return getter(id).then((records: any[]) => {
            if(records.length === 0) {
                throw util.error('KeyError', `No such record: "${id}"`)
            }

            this.selected = records[0]
            m.endComputation()

            return records[0]
        }).catch((msg: any) => {
            console.error(msg)
            m.endComputation()
        })
    }

    __search(query: string) {
        m.startComputation()

        Connection.theConnection.search(query).then((results) => {
            this.results = results
            m.endComputation()
        }).catch((err) => {
            console.error(err)
            this.results.clear()
            m.endComputation()
        })
    }
}

export let vm: ViewModel = null

function renderPatient(petID: string) {
    const patient = vm.results.patients.get(petID)
    const classes: string[] = []

    if(vm.results.matchedPatients.has(petID)) { classes.push('preferred') }
    if(!patient.active) { classes.push('inactive') }
    if(vm.selected && (patient.id === vm.selected.id)) { classes.push('selected') }

    return m('li.patient-info',
        { class: classes.join(' '),
          onclick: () => vm.selectPatient(petID) }, [
        m('span', patient.name)
    ])
}

function renderClient(client: Client) {
    return m('li', {
            class: vm.isSelected(client)? 'active' : ''
        }, [
        m('div.fa.fa-user'),
        m('div', [
            m('div.client-info', { onclick: () => vm.selectClient(client.id) }, [
                m('div', client.name),
                m('div', client.address),
            ]),
            m('ul.patient-results', [
                client.pets.map((petID) => {
                    return renderPatient(petID)
                })
            ])
        ])
    ])
}

function renderCommonToolbarEntries() {
    return [
        m('div.small-button', {
            title: 'Save',
            class: vm.dirty? '' : 'inactive',
            onclick: () => vm.save() }, m('span.fa.fa-save')),
        m('div.small-button', {
            title: 'Revert',
            class: vm.dirty? '' : 'inactive',
            onclick: () => vm.revert() }, m('span.fa.fa-undo'))
    ]
}

function renderEditClient() {
    return m('section#edit-pane', [
        m('div#record-pane', [
            m('div.tool-bar', [
                ...renderCommonToolbarEntries(),
                m('div.small-button', {
                    title: 'Add Patient',
                    onclick: () => vm.addPatient()
                }, m('span.fa.fa-plus'))
            ]),
            m('input', {
                placeholder: 'Name',
                value: vm.selected.name,
                oninput: function() { vm.selected.name = this.value } }),
            m('input', {
                placeholder: 'Address',
                value: vm.selected.address,
                oninput: function() { vm.selected.address = this.value } }),
            m('textarea', {
                placeholder: 'Notes',
                rows: 5,
                value: vm.selected.note,
                oninput: function() { vm.selected.note = this.value } })
            ])
    ])
}

function renderEditPatient() {
    const now = moment()

    return m('section#edit-pane', [
        m('div#record-pane', [
            m('div.tool-bar', [
                ...renderCommonToolbarEntries()
            ]),
            m('input', {
                placeholder: 'Name',
                value: vm.selected.name,
                oninput: function() { vm.selected.name = this.value } }),
            m('input', {
                placeholder: 'Species',
                list: 'species-datalist',
                value: vm.selected.species,
                oninput: function() { vm.selected.species = this.value } }),
            optionsWidget.optionsWidget({
                onclick: (val: string) => vm.selected.sex = val,
                value: vm.selected.sex,
                states: [
                    new optionsWidget.State('f',
                        () => m('span.fa.fa-venus', { title: 'Female' })),
                    new optionsWidget.State('m',
                        () => m('span.fa.fa-mars', { title: 'Male' })),
                    new optionsWidget.State('i',
                        () => m('span.fa.fa-transgender-alt', { title: 'Intersex' }))]}),
            m('div', [
                toggleWidget({
                    value: vm.selected.intact,
                    ontoggle: (val: string) => vm.selected.intact = val }),
                m('span.left-padded', 'Intact')
            ]),
            m('input', {
                placeholder: 'Breed',
                value: vm.selected.breed,
                oninput: function() { vm.selected.breed = this.value } }),
            m('input', {
                placeholder: 'Physical Description',
                value: vm.selected.description,
                oninput: function() { vm.selected.description = this.value } }),
            m('textarea', {
                placeholder: 'Notes',
                rows: 5,
                value: vm.selected.note,
                oninput: function() { vm.selected.note = this.value } }),
            m('div', [
                toggleWidget({
                    value: vm.selected.active,
                    ontoggle: (val: string) => vm.selected.active = val,
                    onprompt: () => window.confirm('Are you sure you want to change this patient\'s status?')}),
                m('span.left-padded', 'Active')
            ])
        ]),
        m('div', [
            m('h1', 'Due'),
            vm.selected.dueByDate().map((kv: [moment.Moment, string[]]) => {
                const [date, names] = kv

                return m('div.due-entry', { class: date.isAfter(now)? 'future' : '' }, [
                    m('span', date.format('ddd ll')),
                    m('span', date.fromNow()),
                    m('div', names.join(', '))
                ])
            }),
            m('h1', 'Appointments'),
            [ m('div.visit-entry', { onclick: () => vm.addAppointment() }, [
                m('div.visit-date', [m('span'), m('span.fa.fa-plus')])
            ])].concat(vm.selected.visits.map((visit: Visit) => {
                return m('div.visit-entry', {
                    onclick: () => {}
                }, [
                    m('div.visit-date', { class: visit.date.isAfter(now)? 'future' : '' }, [
                        m('span', visit.date.format('ddd ll')),
                        m('span', visit.date.fromNow())
                    ])
                ])
            }))
        ])
    ])
}

function renderEditSelected() {
    if(vm.selected instanceof Client) {
        return renderEditClient()
    } else if(vm.selected instanceof Patient) {
        return renderEditPatient()
    }
}

export const view = function() {
    return m('section#search-page', [
        m('section#search-pane', [
            m('input#search-bar', {
                placeholder: 'What to search for?',
                oninput: function() { vm.search(this.value) }
            }),
            m('div#add-client-button.small-button', {
                title: 'Add a new client',
                onclick: () => vm.addClient() }, m('span.fa.fa-plus')),
            m('ul#search-results', vm.results.map((client: Client) => {
                return renderClient(client)
            }))
        ]),
        renderEditSelected()
    ])
}

export const controller = function() {
    vm = new ViewModel()
}