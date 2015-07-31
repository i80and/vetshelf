const Client = require('./Client')
const Connection = require('./Connection')
const optionsWidget = require('./optionsWidget')
const Patient = require('./Patient')
const SearchResults = require('./SearchResults')
const toggleWidget = require('./ToggleWidget')
const util = require('./util')

const PAUSE_INTERVAL_MS = 200

export class ViewModel {
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

    isSelected(record) {
        if(this.selected === null) { return false }

        if(this.selected.id === record.id) {
            return true
        }

        if((record instanceof Client) && record.hasPet(this.selected.id)) {
            return true
        }

        return false
    }

    search(query) {
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
        Connection.theConnection.saveClient(client).then((id) => {
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
        Connection.theConnection.savePatient(patient, [clientID]).then((id) => {
            return this.selectPatient(id)
        }).then((patient) => {
            this.results.addPatient(patient, clientID)
            m.endComputation()
        }).catch((msg) => {
            console.error(msg)
            m.endComputation()
        })
    }

    save() {
        if(!this.dirty) { return }

        let saver = null
        let getter = null
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
        saver(this.selected).catch((msg) => {
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

    selectClient(id) {
        return this.__selectRecord(id, (id) => Connection.theConnection.getClients(id))
    }

    selectPatient(id) {
        return this.__selectRecord(id, (id) => Connection.theConnection.getPatients(id))
    }

    __selectRecord(id, getter) {
        m.startComputation()
        return getter(id).then((records) => {
            if(records.length === 0) {
                throw util.error('KeyError', `No such record: "${id}"`)
            }

            this.selected = records[0]
            m.endComputation()

            return records[0]
        }).catch((msg) => {
            console.error(msg)
            m.endComputation()
        })
    }

    __search(query) {
        m.startComputation()

        Connection.theConnection.search(query).then((results) => {
            if(results === 'error') {
                console.error(results)
                return
            }

            this.results = results
            m.endComputation()
        }).catch((err) => {
            console.error(err)
            this.results.clear()
            m.endComputation()
        })
    }
}

export let vm = null

function renderPatient(petID) {
    const patient = vm.results.patients.get(petID)
    const classes = []
    classes.push(vm.results.matchedPatientIDs.has(petID)? 'preferred' : '')
    classes.push(patient.active? '' : 'inactive')

    return m('li.patient-info',
        { class: classes.join(' '),
          onclick: () => vm.selectPatient(petID) }, [
        m('span', patient.name)
    ])
}

function renderClient(client) {
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
}

function renderEditPatient() {
    return m('section#edit-pane', [
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
        optionsWidget({
            onclick: (val) => vm.selected.sex = val,
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
                ontoggle: (val) => vm.selected.intact = val }),
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
                ontoggle: (val) => vm.selected.active = val,
                onprompt: () => window.confirm('Are you sure you want to change this patient\'s status?')}),
            m('span.left-padded', 'Active')
        ])
    ])
}

function renderEditSelected() {
    if(vm.selected instanceof Client) {
        return renderEditClient()
    }
    else if(vm.selected instanceof Patient) {
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
            m('ul#search-results', vm.results.map((client) => {
                return renderClient(client)
            }))
        ]),
        renderEditSelected()
    ])
}

export const controller = function() {
    vm = new ViewModel()
}
