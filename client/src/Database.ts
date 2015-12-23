/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/pouchdb.d.ts" />
/// <reference path="typings/localforage.d.ts" />

import SearchResults from './SearchResults'
import Client from './Client'
import Patient from './Patient'
import * as util from './util'

// Dummy for PouchDB Map/Reduce functions
const emit: any = null

class TextSearch {
    private messageID: number
    private pending: Map<number, [(result: any)=>void, (err: any)=>void]>
    private worker: Worker

    constructor() {
        this.messageID = 0
        this.pending = new Map()
        this.worker = new Worker('./js/worker-search.js')
        this.worker.onmessage = (e) => {
            const [resolve, reject] = this.pending.get(e.data.id)
            this.pending.delete(e.data.id)

            if(e.data.error) { return reject(e.data.error) }
            return resolve(e.data.result)
        }
    }

    search(query: string): Promise<any> {
        return this.sendMessage('search', [query])
    }

    add(doc: any): Promise<void> {
        return this.sendMessage('add', [doc])
    }

    update(doc: any): Promise<void> {
        return this.sendMessage('update', [doc])
    }

    load(): Promise<void> {
        return this.sendMessage('load')
    }

    persist(): Promise<void> {
        return this.sendMessage('persist')
    }

    debug(): Promise<void> {
        return this.sendMessage('debug')
    }

    private sendMessage(method: string, args?: any[]) {
        const messageID = this.messageID++
        const promise = new Promise<any>((resolve, reject) => {
            this.pending.set(messageID, [resolve, reject])
        })

        this.worker.postMessage({
            id: messageID,
            args: [method].concat(args)
        })

        return promise
    }
}

export default class Database {
    private localDatabase: PouchDB
    private textSearch: TextSearch

    constructor() {
        let w: any = window
        w.db = this

        this.localDatabase = new PouchDB('vetshelf')
        this.textSearch = new TextSearch()
    }

    private async ensureDesignDocument(): Promise<void> {
        const index = {
            _id: '_design/index',
            _rev: <string>undefined,
            filters: {
                'replication-changes': function(doc: any) {
                    return ['client', 'patient'].indexOf(doc.type) >= 0
                }.toString()
            },
            views: {
                owners: {
                    map: function(doc: any) {
                        if (doc.type !== 'client') { return }
                        for (let petID of doc.pets) {
                            emit(petID)
                        }
                    }.toString()
                },
                upcoming: {
                    map: function(doc: any) {
                        if (doc.type !== 'patient') { return }
                        for (let visit of doc.visits) {
                            emit(visit.date)
                        }
                    }.toString()
                }
            }
        }

        try {
            const existing: any = await this.localDatabase.get(index._id)
            if(JSON.stringify(existing.views) === JSON.stringify(index.views)) { return }
            if (existing._rev) { index._rev = existing._rev }
        } catch (err) {
            if (err.status !== 404) { throw err }
        }

        console.log('Installing new design document')
        await this.localDatabase.put(index)
    }

    async ensureIndexes(): Promise<void> {
        await this.ensureDesignDocument()

        console.log('Generating indexes')
        const t1 = moment()

        const promises: Promise<any>[] = []
        promises.push(this.localDatabase.query('index/owners', {limit: 0}))
        promises.push(this.localDatabase.query('index/upcoming', {limit: 0}))

        const result = await this.localDatabase.allDocs({
            include_docs: true,
            startkey: 'c-',
            endkey: 'c-\uffff' })

        for(let row of result.rows) {
            try {
                const client = Client.deserialize(row.doc)
                promises.push(this.updateSearchDocument(client))
            } catch(err) {
                console.error(err)
            }
        }

        await Promise.all(promises)
        await this.textSearch.persist()

        const t2 = moment()
        console.log(`Took ${t2.diff(t1, 'seconds')}s to build search index`)
    }

    async initialize(): Promise<void> {
        // Check if we have a cached search index, and if so, load it
        try {
            await this.textSearch.load()
            await this.ensureDesignDocument()
        } catch(err) {
            await this.ensureIndexes()
        }

        // Keep the search index up to date
        this.localDatabase.changes({
            include_docs: true,
            live: true,
            since: 'now',
            filter: 'index/replication-changes'
        }).on('change', async (results: any): Promise<void> => {
            const doc = results.doc
            if (doc.type === 'client') {
                const client = Client.deserialize(doc)
                await this.updateSearchDocument(client)
            } else if (doc.type === 'patient') {
                const patient = Patient.deserialize(doc)
                const owners = await this.getOwners([patient.id])
                for (let owner of owners) {
                    await this.updateSearchDocument(owner)
                }
            }

            await this.textSearch.persist()
        })
    }

    async getClients(ids: string[]): Promise<Client[]> {
        const results = await this.localDatabase.allDocs({
            include_docs: true,
            keys: ids
        })

        return results.rows.map((row) => {
            return Client.deserialize(row.doc)
        })
    }

    async getClient(id: string): Promise<Client> {
        try {
            const rawClient = await this.localDatabase.get(id)
            return Client.deserialize(rawClient)
        } catch (err) {
            if (err.status === 404) {
                throw util.keyError.error(`No such client: "${id}"`)
            }

            throw err
        }
    }

    async getPatients(ids: string[]): Promise<Patient[]> {
        const results = await this.localDatabase.allDocs({
            include_docs: true,
            keys: ids
        })

        return results.rows.map((row) => {
            return Patient.deserialize(row.doc)
        })
    }

    async getPatient(id: string): Promise<Patient> {
        try {
            const rawPatient = await this.localDatabase.get(id)
            return Patient.deserialize(<any>rawPatient)
        } catch (err) {
            if (err.status === 404) {
                throw util.keyError.error(`No such patient: "${id}"`)
            }

            throw err
        }
    }

    async getOwners(patientIDs: string[]): Promise<Client[]> {
        const results = await this.localDatabase.query('index/owners', {
            keys: patientIDs
        })

        const clientIDs = new Set(results.rows.map((row) => row.id))
        return this.getClients(Array.from(clientIDs))
    }

    async updateSearchDocument(client: Client): Promise<void> {
        const summary: any = client.summarize()
        const patients = await this.getPatients(client.pets)
        const patientSummaries = patients.map((p) => p.summarize())

        for(let patientSummary of patientSummaries) {
            for(let field in patientSummary) {
                if (!patientSummary.hasOwnProperty(field)) {
                    continue
                }

                const destField = 'pet_' + field
                if(summary[destField] === undefined) {
                    summary[destField] = []
                }

                summary[destField].push(patientSummary[field])
            }
        }

        this.textSearch.update(summary)
    }

    async updateClient(client: Client): Promise<string> {
        if (client._id !== null && !client.isDirty) { return client._id }

        if (client._id === null) { client._id = util.genID('c') }
        client._rev = (await this.localDatabase.put(client.serialize())).rev

        client.clearDirty()
        return client.id
    }

    async updatePatient(patient: Patient, options?: { addOwners: string[] }): Promise<string> {
        if (patient._id !== null && !patient.isDirty) { return patient._id }

        if (patient._id === null) { patient._id = util.genID('p') }
        patient._rev = (await this.localDatabase.put(patient.serialize())).rev

        // Add the patient's owners
        if (options && options.addOwners) {
            const clients = await this.getClients(options.addOwners)
            const updateDocs = clients.map((c) => {
                c.addPet(patient._id)
                return c.serialize()
            })

            await this.localDatabase.bulkDocs(updateDocs)
        }

        patient.clearDirty()
        return patient._id
    }

    async populateResultsFromClients(clients: Client[]): Promise<SearchResults> {
        // Construct our client results, and track their patients
        const patientSet = new Set<string>()
        for(let client of clients) {
            for (let patientID of client.pets) {
                patientSet.add(patientID)
            }
        }

        const patients = new Map<string, Patient>()

        // Attach the patients to our results set
        const matchedPatientsArray = Array.from(patientSet.values())
        for (let patient of await this.getPatients(matchedPatientsArray)) {
            patients.set(patient.id, patient)
        }

        return new SearchResults(clients, patients, new Set<string>())
    }

    async showRandom(): Promise<SearchResults> {
        // Just list the first hundred clients for now
        const results = await this.localDatabase.allDocs({
            include_docs: true,
            startkey: 'c-',
            endkey: 'c-\uffff',
            limit: 100 })

        const clients = results.rows.map((row) => Client.deserialize(row.doc))
        return this.populateResultsFromClients(clients)
    }

    async showUpcoming(): Promise<SearchResults> {
        const results = await this.localDatabase.query('index/upcoming', {
            include_docs: true,
            startkey: moment().toISOString(),
            limit: 100
        })

        const matchedPatients = new Set<string>()
        const patients = new Map<string, Patient>()
        for(let row of results.rows) {
            matchedPatients.add(row.doc._id)
            patients.set(row.doc._id, Patient.deserialize(row.doc))
        }
        const clients = await this.getOwners(Array.from(matchedPatients))

        // Fill in the remaining patients
        const missingPatients = new Set<string>()
        for(let client of clients) {
            for(let petID of client.pets) {
                if(!matchedPatients.has(petID)) {
                    missingPatients.add(petID)
                }
            }
        }

        for(let patient of (await this.getPatients(Array.from(missingPatients)))) {
            patients.set(patient.id, patient)
        }

        return new SearchResults(clients, patients, matchedPatients)
    }

    async fullTextSearch(query: string): Promise<SearchResults> {
        const results = (await this.textSearch.search(query)).slice(0, 25)
        const clientIDs = results.map((r: any) => r.ref)

        const clients = await this.getClients(clientIDs)

        return this.populateResultsFromClients(clients)
    }

    async search(query: string): Promise<SearchResults> {
        if(query === '' || query === 'upcoming') {
            return await this.showUpcoming()
        } else if (query === 'random') {
            return await this.showRandom()
        } else {
            return await this.fullTextSearch(query)
        }
    }

    async importData(data: { clients: any[], patients: any[] }): Promise<void> {
        const patientIDMap = new Map<string, string>()
        for(let rawPatient of data.patients) {
            try {
                rawPatient.type = 'patient'
                rawPatient._id = null
                rawPatient.visits = rawPatient.visits.map((v: any) => {
                    v.id = util.genID('v')
                    v.kg = v.weight / 1000
                    v.tasks = []
                    return v
                })
                const patient = Patient.deserialize(rawPatient)
                await this.updatePatient(patient)
                patientIDMap.set(rawPatient.id, patient._id)
            } catch(err) {
                console.error(err)
            }
        }

        for(let rawClient of data.clients) {
            try {
                rawClient.type = 'client'
                rawClient._id = null
                rawClient.pets = rawClient.pets.map((id: string) => patientIDMap.get(id))
                                               .filter((id: string) => id !== undefined && id !== null)
                rawClient.phone = rawClient.phone.map((phone: [string, string]) => {
                    return { number: phone[0], note: phone[1] }
                })
                const client = Client.deserialize(rawClient)
                await this.updateClient(client)
            } catch(err) {
                console.error(err)
            }
        }
    }
}
