/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/pouchdb.d.ts" />

import SearchResults from './SearchResults'
import Client from './Client'
import Patient from './Patient'
import * as util from './util'

// Dummy for PouchDB Map/Reduce functions
const emit: any = null

export default class Database {
    private localDatabase: PouchDB

    constructor() {
        this.localDatabase = new PouchDB('vetshelf')
    }

    async ensureIndexes(): Promise<void> {
        const index = {
            _id: '_design/index',
            _rev: <string>undefined,
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
            if(existing.views === index.views) { return }
            if (existing._rev) { index._rev = existing._rev }
        } catch (err) {
            if (err.status !== 404) { throw err }
        }

        await this.localDatabase.put(index)
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
        const summary: any = {}
        const patients = await this.getPatients(client.pets)
        const patientSummaries = patients.map((p) => p.summarize())

        summary._id = `s-${client._id.replace('c-', '')}`
        summary.type = 'search'
        summary.client = client.summarize()
        summary.pets = {}
        for(let patientSummary of patientSummaries) {
            for(let field in patientSummary) {
                if (!patientSummary.hasOwnProperty(field)) {
                    continue
                }

                if(summary.pets[field] === undefined) {
                    summary.pets[field] = []
                }

                summary.pets[field].push(patientSummary[field])
            }
        }

        try {
            const existing: any = await this.localDatabase.get(summary._id)
            if (existing._rev) { summary._rev = existing._rev }
        } catch (err) {
            if (err.status !== 404) { throw err }
        }

        await this.localDatabase.put(summary)
    }

    async updateClient(client: Client): Promise<string> {
        if (client._id !== null && !client.isDirty) { return client._id }

        if (client._id === null) { client._id = util.genID('c') }
        client._rev = (await this.localDatabase.put(client.serialize())).rev

        await this.updateSearchDocument(client)

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

        const owners = await this.getOwners([patient.id])
        for(let owner of owners) {
            await this.updateSearchDocument(owner)
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

    async search(query: string): Promise<SearchResults> {
        if(query === '' || query === 'upcoming') {
            return await this.showUpcoming()
        } else if (query === 'random') {
            return await this.showRandom()
        }

        // Full text search
        const result = await this.localDatabase.search({
            query: query,
            include_docs: true,
            limit: 100,
            fields: ['client.name', 'client.address', 'client.email', 'client.note',
                     'pets.name', 'pets.species', 'pets.breed', 'pets.sex', 'pets.description', 'pets.note'],
            filter: function(doc: any) { return doc.type === 'search' }
        })

        const clientIDs = result.rows.map((row: any) => row.doc.client._id)
        const clients = await this.getClients(clientIDs)

        return this.populateResultsFromClients(clients)
    }
}
