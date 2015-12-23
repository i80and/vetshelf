/// <reference path="typings/mithril/mithril.d.ts" />
/// <reference path="typings/moment/moment.d.ts" />

import Client from './Client'
import Patient from './Patient'
import Database from './Database'
import SearchResults from './SearchResults'
import Visit from './Visit'
import PhoneInfo from './PhoneInfo'
import * as optionsWidget from './optionsWidget'
import toggleWidget from './toggleWidget'
import * as appointmentEditor from './appointmentEditor'
import * as util from './util'

const PAUSE_INTERVAL_MS = 200

export class ViewModel {
    private timeoutID: number
    results: SearchResults
    private database: Database
    appointmentEditor: appointmentEditor.Model

    private selectedID: string
    private selectedType: string

    constructor(database: Database) {
        this.timeoutID = -1
        this.results = new SearchResults([])
        this.database = database
        this.appointmentEditor = null

        this.selectedID = ''
        this.selectedType = ''

        this.search('upcoming')
    }

    set selected(val: Client | Patient) {
        if(val === null) {
            this.selectedID = ''
            this.selectedType = ''
            return
        }

        this.selectedID = val._id
        if(val instanceof Client) {
            this.selectedType = 'client'
        } else if(val instanceof Patient) {
            this.selectedType = 'patient'
        } else {
            throw util.assertionError.error(`Bad value ${val} not client or patient`)
        }
    }

    get selected(): Client | Patient {
        if(this.clientIsSelected()) {
            return this.results.getClient(this.selectedID)
        } else if(this.patientIsSelected()) {
            return this.results.getPatient(this.selectedID)
        }

        return null
    }

    get selectedClient(): Client {
        if(!this.clientIsSelected()) {
            throw util.assertionError.error('Client requested when Patient selected')
        }

        return <Client>this.selected
    }

    get selectedPatient(): Patient {
        if(!this.patientIsSelected()) {
            throw util.assertionError.error('Patient requested when Client selected')
        }

        return <Patient>this.selected
    }

    clientIsSelected(): boolean { return this.selectedType === 'client' }
    patientIsSelected(): boolean { return this.selectedType === 'patient' }

    get isDirty(): boolean {
        if(!this.selected) { return false }
        return this.selected.isDirty
    }

    isSelected(record: Client|Patient): boolean {
        if(this.selected === null) { return false }

        if(this.selected.id === record.id) {
            return true
        }

        if((record instanceof Client) && record.hasPet(this.selected.id)) {
            return true
        }

        return false
    }

    async search(query: string): Promise<void> {
        m.startComputation()

        this.selected = null

        try {
            this.results = await this.database.search(query)

            // Don't search unless there's been a pause
            if(this.timeoutID >= 0) {
                window.clearTimeout(this.timeoutID)
            }

            this.timeoutID = window.setTimeout(async () => {
                this.timeoutID = -1
                await this.__search(query)
            }, PAUSE_INTERVAL_MS)
        } catch(err) {
            console.error(err)
        } finally {
            m.endComputation()
        }
    }

    async addClient(): Promise<void> {
        const client = Client.emptyClient()

        m.startComputation()
        try {
            const id = await this.database.updateClient(client)
            this.results.refreshClient(client)
            await this.selectClient(id)
        } catch(err) {
            console.error(err)
        } finally {
            m.endComputation()
        }
    }

    async addPatient(): Promise<void> {
        const selected = await this.selected
        if(!(selected instanceof Client)) {
            throw util.typeError.error('Cannot create patient child of selection')
        }

        if(!selected.id) {
            throw util.valueError.error('Selection has no ID')
        }

        const patient = Patient.emptyPatient()
        const clientID = this.selected.id

        m.startComputation()
        try {
            const id = await this.database.updatePatient(patient, { addOwners: [clientID] })
            this.results.refreshPatient(patient)
            this.results.refreshClient(await this.database.getClient(clientID))
            await this.selectPatient(id)
        } catch(err) {
            console.error(err)
        } finally {
            m.endComputation()
        }
    }

    async save(): Promise<void> {
        if(!this.isDirty) { return }

        m.startComputation()
        try {
            const selected = this.selected

            if (selected instanceof Client) {
                await this.database.updateClient(selected)
                this.results.refreshClient(selected)
            } else if (selected instanceof Patient) {
                await this.database.updatePatient(selected)
                this.results.refreshPatient(selected)
            }
        } catch(err) {
            console.error(err)
        } finally {
            m.endComputation()
        }
    }

    revert(): Promise<Client|Patient> {
        if(this.isDirty) {
            if (!window.confirm('Are you sure you want to revert your working changes?')) {
                return
            }
        }

        const selected = this.selected
        if(selected instanceof Client) {
            return this.selectClient(selected.id)
        } else if(selected instanceof Patient) {
            return this.selectPatient(selected.id)
        }
    }

    selectClient(clientID: string): Promise<Client> {
        return this.__selectRecord(clientID, (id: string) => {
            return this.database.getClient(id)
        })
    }

    selectPatient(patientID: string): Promise<Patient> {
        return this.__selectRecord(patientID, (id: string) => {
            return this.database.getPatient(id)
        })
    }

    async addAppointment(): Promise<void> {
        const newVisit = this.selectedPatient.insertVisit()
        m.startComputation()
        try {
            this.appointmentEditor = new appointmentEditor.Model(newVisit)
        } catch(err) {
            console.error(err)
        } finally {
            m.endComputation()
        }
    }

    async deleteAppointment(): Promise<void> {
        m.startComputation()
        try {
            this.selectedPatient.deleteVisit(this.appointmentEditor.appointment.id)
            this.appointmentEditor = null
        } catch (err) {
            console.error(err)
        } finally {
            m.endComputation()
        }
    }

    selectAppointment(visit: Visit) {
        this.appointmentEditor = new appointmentEditor.Model(visit)
    }

    async updateAppointment(editor: appointmentEditor.Model): Promise<void> {
        const newAppointment = editor.getNewAppointment()
        m.startComputation()
        try {
            this.selectedPatient.updateVisit(newAppointment)
        } catch(err) {
            console.error(err)
            m.endComputation()
        } finally {
            m.endComputation()
        }
    }

    get selectedAppointment() {
        if(this.appointmentEditor) {
            return this.appointmentEditor.appointment
        }

        return null
    }

    __selectRecord(id: string, getter: (id:string)=>any) {
        m.startComputation()
        this.appointmentEditor = null
        return getter(id).then((record: Client|Patient) => {
            this.selected = record
            m.endComputation()

            return record
        }).catch((msg: any) => {
            console.error(msg)
            m.endComputation()
        })
    }

    async __search(query: string): Promise<void> {
        try {
            this.results = (await this.database.search(query))
        } catch(err) {
            console.error(err)
        }
    }
}

export let vm: ViewModel = null

function renderPatient(petID: string) {
    const patient = vm.results.getPatient(petID)
    if(!patient) {
        console.error(`No such patient: ${petID}`)
        return m('li.patient-info')
    }

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
            class: vm.isDirty? '' : 'inactive',
            onclick: () => vm.save() }, m('span.fa.fa-save')),
        m('div.small-button', {
            title: 'Revert',
            onclick: () => vm.revert() }, m('span.fa.fa-undo'))
    ]
}

function renderEditPhoneNumbers() {
    const phones = vm.selectedClient.phone
    phones.push(new PhoneInfo('', ''))

    return m('div#phone-inputs.condensed-entry-list', phones.map((phoneInfo) => {
        let type = ''
        if(phoneInfo.note) {
            const types = ['mobile', 'home', 'work', 'fax']
            type = types[types.indexOf(phoneInfo.note)]
            if(type === undefined) {
                type = ''
            }
        }

        return m('div', [
            m('input[type=tel]', {
                placeholder: 'Phone Number',
                pattern: '[0-9\-+ #ext.]+',
                value: phoneInfo.number,
                oninput: function() {
                    vm.selectedClient.savePhone(phoneInfo, phoneInfo.with({ number: this.value }))
                }
            }),
            m('label.select',
                m('select', {
                    value: type,
                    onchange: function() {
                        if(phoneInfo.number) {
                            vm.selectedClient.savePhone(phoneInfo, phoneInfo.with({ note: this.value }))
                        }
                }}, [
                    m('option', { value: '' }, ''),
                    m('option', { value: 'mobile' }, 'Mobile'),
                    m('option', { value: 'home' }, 'Home'),
                    m('option', { value: 'work' }, 'Work'),
                    m('option', { value: 'fax' }, 'Fax')]))
        ])
    }))
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
                value: vm.selectedClient.address,
                oninput: function() { vm.selectedClient.address = this.value } }),
            m('input[type=email]', {
                placeholder: 'Email Address',
                value: vm.selectedClient.email,
                oninput: function() { vm.selectedClient.email = this.value }
            }),
            renderEditPhoneNumbers(),
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

    const children = [
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
                value: vm.selectedPatient.species,
                oninput: function() { vm.selectedPatient.species = this.value } }),
            optionsWidget.optionsWidget({
                onclick: (val: string) => vm.selectedPatient.sex = val,
                value: vm.selectedPatient.sex,
                states: [
                    new optionsWidget.State('m',
                        () => m('span.fa.fa-mars', { title: 'Male' })),
                    new optionsWidget.State('f',
                        () => m('span.fa.fa-venus', { title: 'Female' }))]
            }),
            m('div', [
                toggleWidget({
                    value: vm.selectedPatient.intact,
                    ontoggle: (val: boolean) => vm.selectedPatient.intact = val ,
                    onprompt: () => !vm.selectedPatient.intact? window.confirm('You are un-fixing a patient. Are you sure?') : true }),
                m('span.left-padded', 'Intact')
            ]),
            m('input', {
                placeholder: 'Breed',
                value: vm.selectedPatient.breed,
                oninput: function() { vm.selectedPatient.breed = this.value } }),
            m('input', {
                placeholder: 'Physical Description',
                value: vm.selectedPatient.description,
                oninput: function() { vm.selectedPatient.description = this.value } }),
            m('textarea', {
                placeholder: 'Notes',
                rows: 5,
                value: vm.selected.note,
                oninput: function() { vm.selected.note = this.value } }),
            m('div', [
                toggleWidget({
                    value: vm.selectedPatient.active,
                    ontoggle: (val: boolean) => vm.selectedPatient.active = val,
                    onprompt: () => window.confirm('Are you sure you want to change this patient\'s status?')}),
                m('span.left-padded', 'Active')
            ])
        ]),
        m('div#schedule-pane', [
            m('section', [
                m('h1', 'Due'),
                vm.selectedPatient.dueByDate().map((kv: [moment.Moment, string[]]) => {
                    const [date, names] = kv

                    return m('div.due-entry', { class: date.isAfter(now)? 'future' : '' }, [
                        m('span', date.format('ddd ll')),
                        m('span', util.fromNowMinimum(date)),
                        m('div', names.join(', '))
                    ])
                }),
            ]),
            m('section', [
                m('h1', 'Appointments'),
                [ m('div.visit-entry.small-button', { onclick: () => vm.addAppointment() }, [
                    m('div', [m('span'), m('span.fa.fa-plus')])
                ])].concat(vm.selectedPatient.visits.map((visit: Visit) => {
                    if(visit === undefined) {
                        console.error(`Couldn't find visit ${visit.id}`)
                        return null
                    }

                    return m('div.visit-entry', {
                        onclick: () => { vm.selectAppointment(visit) },
                        class: vm.selectedAppointment && vm.selectedAppointment.id === visit.id? 'selected' : ''
                    }, [
                        m('div.visit-date', { class: visit.date.isAfter(now)? '' : 'past' }, [
                            m('span', visit.date.format('ddd ll')),
                            m('span', visit.date.fromNow())
                        ])
                    ])
                }).filter((x: any) => x !== null))
            ])
        ])
    ]

    if(vm.appointmentEditor) {
        children.push(appointmentEditor.view(vm.appointmentEditor, {
            ondelete: () => vm.deleteAppointment(),
            onedit: (model) => vm.updateAppointment(model)
        }))
    }

    return m('section#edit-pane', children)
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
            m('ul#search-results', vm.results.map((c: Client) => {
                return renderClient(c)
            }))
        ]),
        renderEditSelected()
    ])
}

export const controller = function() {
    const database = new Database()

    m.startComputation()
    database.initialize().then(() => {
        vm = new ViewModel(database)
        m.endComputation()
    })
}
