/// <reference path="typings/moment/moment.d.ts" />

import SearchResults from './SearchResults'
import Client from './Client'
import Patient from './Patient'
import * as patient from './Patient'
import Hopps from './Hopps'
import * as util from './util'

const DEFAULT_LIMIT = 50

class TextSearch {
    private messageID: number
    private pending: Map<number, [(result: any) => void, (err: any) => void]>
    private worker: Worker

    constructor() {
        this.messageID = 0
        this.pending = new Map()
        this.worker = new Worker('./js/worker-search.js')
        this.worker.onmessage = (e) => {
            const [resolve, reject] = this.pending.get(e.data.id)
            this.pending.delete(e.data.id)

            if (e.data.error) { return reject(e.data.error) }
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

    debug(record?: string): Promise<void> {
        return this.sendMessage('debug', [record])
    }

    clearCache(): Promise<void> {
        return this.sendMessage('clearCache')
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
    private localDatabase: Hopps
    private textSearch: TextSearch
    private batchMode: number

    constructor() {
        let w: any = window
        w.db = this

        this.localDatabase = null
        this.textSearch = new TextSearch()
        this.batchMode = 0
    }

    async ensureIndexes(): Promise<void> {
        const timer = new util.Timer()
        console.log('Building search index')
        const promises: Promise<any>[] = []

        await this.localDatabase.forEach('clients', null, (key, rawDoc) => {
            try {
                const client = Client.deserialize(rawDoc)
                promises.push(this.updateSearchDocument(client))
            } catch (err) {
                console.error(err)
            }

            return true
        })

        await Promise.all(promises)
        await this.textSearch.persist()

        timer.log('Building search index')
    }

    async initialize(): Promise<void> {
        const localDatabase = await Hopps.connect('vetshelf', 1, (openRequest) => {
            const db: IDBDatabase = openRequest.result
            const clientStore = db.createObjectStore('clients', { keyPath: '_id' })
            clientStore.createIndex('pets', 'pets', { multiEntry: true })

            const patientStore = db.createObjectStore('patients', { keyPath: '_id' })
            patientStore.createIndex('visitDates', 'visitDates', { multiEntry: true })
        })
        this.localDatabase = localDatabase

        // Check if we have a cached search index, and if so, load it
        try {
            await this.textSearch.load()
        } catch (err) {
            await this.ensureIndexes()
        }

        // Keep the search index up to date
        this.localDatabase.onchange = async (objectStore, doc) => {
            if (this.batchMode > 0) {
                return
            }

            console.log(`Saving in ${objectStore}`, doc)

            if (objectStore === 'clients') {
                const client = Client.deserialize(doc)
                await this.updateSearchDocument(client)
            } else if (objectStore === 'patients') {
                const patient = Patient.deserialize(doc)
                const owners = await this.getOwners([patient.id])
                for (let owner of owners) {
                    await this.updateSearchDocument(owner)
                }
            }

            await this.textSearch.persist()
        }
    }

    async getClients(ids: string[]): Promise<Client[]> {
        let rawDocs: {}[]

        try {
            rawDocs = await this.localDatabase.get('clients', '', ids)
        } catch (err) {
            throw util.keyError.error(err.message)
        }

        return rawDocs.map((rawDoc) => {
            return Client.deserialize(rawDoc)
        })
    }

    async getClient(id: string): Promise<Client> {
        return (await this.getClients([id]))[0]
    }

    async getPatients(ids: string[]): Promise<Patient[]> {
        let rawDocs: {}[]
        try {
            rawDocs = await this.localDatabase.get('patients', '', ids)
        } catch (err) {
            throw util.keyError.error(err.message)
        }

        return rawDocs.map((rawDoc: any) => {
            return Patient.deserialize(rawDoc)
        })
    }

    async getPatient(id: string): Promise<Patient> {
        return (await this.getPatients([id]))[0]
    }

    async getOwners(patientIDs: string[]): Promise<Client[]> {
        const results = await this.localDatabase.get('clients', 'pets', patientIDs)
        const clientIDs = new Set(results.map((row: any) => row._id))
        return this.getClients(Array.from(clientIDs))
    }

    async updateSearchDocument(client: Client): Promise<void> {
        const summary: any = client.summarize()
        const patients = await this.getPatients(client.pets)
        const patientSummaries = patients.map((p) => p.summarize())

        for (let patientSummary of patientSummaries) {
            for (let field in patientSummary) {
                if (!patientSummary.hasOwnProperty(field)) {
                    continue
                }

                const destField = 'pet_' + field
                if (summary[destField] === undefined) {
                    summary[destField] = []
                }

                summary[destField].push(patientSummary[field])
            }
        }

        // Lunr.js won't tokenize strings in arrays, so combine our array elements
        for (let field in summary) {
            if (!summary.hasOwnProperty(field)) {
                continue
            }

            if (summary[field].join) {
                summary[field] = summary[field].join(' ')
            }
        }

        this.textSearch.update(summary)
    }

    async updateClient(client: Client): Promise<string> {
        if (client._id !== null && !client.isDirty) { return client._id }

        if (client._id === null) { client._id = util.genID('c') }
        await this.localDatabase.put('clients', client.serialize())

        client.clearDirty()
        return client.id
    }

    async updatePatient(patient: Patient, options?: { addOwners: string[] }): Promise<string> {
        if (patient._id !== null && !patient.isDirty) { return patient._id }
        if (patient._id === null) { patient._id = util.genID('p') }

        const transaction = this.localDatabase.rawTransaction(['clients', 'patients'], 'readwrite')
        await this.localDatabase.put('patients', patient.serialize(), transaction)

        // Add the patient's owners
        if (options && options.addOwners) {
            const clients = await this.getClients(options.addOwners)
            for (let client of clients) {
                client.addPet(patient._id)
                await this.localDatabase.put('clients', client.serialize(), transaction)
            }
        }

        patient.clearDirty()
        return patient._id
    }

    async populateResultsFromClients(clients: Client[]): Promise<SearchResults> {
        // Construct our client results, and track their patients
        const patientSet = new Set<string>()
        for (let client of clients) {
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

    async showUpcoming(): Promise<SearchResults> {
        const results = await this.localDatabase.query<patient.ISerializedPatient>(
            'patients',
            'visitDates',
            IDBKeyRange.lowerBound(moment().toISOString()),
            {
                limit: DEFAULT_LIMIT,
                direction: 'next'
            })

        const matchedPatients = new Set<string>()
        const patients = new Map<string, Patient>()
        for (let doc of results) {
            matchedPatients.add(doc._id)
            patients.set(doc._id, Patient.deserialize(doc))
        }
        const clients = await this.getOwners(Array.from(matchedPatients))

        // Fill in the remaining patients
        const missingPatients = new Set<string>()
        for (let client of clients) {
            for (let petID of client.pets) {
                if (!matchedPatients.has(petID)) {
                    missingPatients.add(petID)
                }
            }
        }

        for (let patient of (await this.getPatients(Array.from(missingPatients)))) {
            patients.set(patient.id, patient)
        }

        return new SearchResults(clients, patients, matchedPatients)
    }

    async fullTextSearch(query: string): Promise<SearchResults> {
        const results = (await this.textSearch.search(query)).slice(0, DEFAULT_LIMIT)
        const clientIDs = results.map((r: any) => r.ref)
        const clients = await this.getClients(clientIDs)

        return this.populateResultsFromClients(clients)
    }

    async search(query: string): Promise<SearchResults> {
        const timer = new util.Timer()
        try {
            if (query === '' || query === 'upcoming') {
                return await this.showUpcoming()
            } else {
                return await this.fullTextSearch(query)
            }
        } finally {
            timer.log(`Search "${query}"`)
        }
    }

    async importData(data: { clients: any[], patients: any[] }): Promise<void> {
        try {
            this.enterBatchMode()

            const patientIDMap = new Map<string, string>()
            for (let rawPatient of data.patients) {
                try {
                    rawPatient.type = 'patient'
                    rawPatient._id = null
                    rawPatient.visits = rawPatient.visits.map((v: any) => {
                        v.id = util.genID('v')
                        v.kg = v.weight / 1000
                        v.tasks = {}
                        return v
                    })
                    const patient = Patient.deserialize(rawPatient)
                    await this.updatePatient(patient)
                    patientIDMap.set(rawPatient.id, patient._id)
                } catch (err) {
                    console.error(err)
                }
            }

            for (let rawClient of data.clients) {
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
                } catch (err) {
                    console.error(err)
                }
            }
        } finally {
            await this.exitBatchMode()
        }
    }

    // This is ONLY offered for debugging console use
    protected async destroy(idiotProof: string): Promise<void> {
        if (idiotProof !== 'Yes I am sure that I want to delete vetshelf') {
            throw new Error('Declined')
        }

        await this.textSearch.clearCache()
        await this.localDatabase.destroy()

        console.warn('Deleted vetshelf')
    }

    private enterBatchMode(): void {
        this.batchMode += 1
    }

    private exitBatchMode() {
        this.batchMode -= 1
        if (this.batchMode < 0) { this.batchMode = 0 }
        return this.ensureIndexes()
    }
}
