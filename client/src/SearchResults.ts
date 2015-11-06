import Client from './Client'
import Patient from './Patient'
import Visit from './Visit'
import * as util from './util'

export default class SearchResults {
    clients: Client[]
    clientIDs: string[]
    patients: Map<string, Patient>
    visits: Map<string, Visit>
    matchedPatients: Set<string>
    clientsIndex: Map<string, Client>

    constructor(clients: Client[],
                patients: Map<string, Patient>=null,
                visits: Map<string, Visit>=null,
                matchedPatients: Set<string>=null) {
        this.clientIDs = clients.map((doc) => doc.id) || []
        this.patients = patients || new Map<string, Patient>()
        this.visits = visits || new Map<string, Visit>()
        this.matchedPatients = matchedPatients || new Set<string>()

        this.clientsIndex = new Map<string, Client>()
        for(let client of clients) {
            this.clientsIndex.set(client.id, client)
        }
    }

    updateRecord(doc: Client|Patient) {
        if(doc instanceof Patient) {
            this.patients.set(doc.id, doc)
        } else if(doc instanceof Client) {
            this.clientsIndex.set(doc.id, doc)
        }
    }

    addPatient(patient: Patient, clientID: string) {
        const client = this.clientsIndex.get(clientID)

        // Don't use the normal mutator, because it sets the dirty flag. However,
        // we're simply updating the results to match what should be on the server.
        client._pets.add(patient.id)
        this.patients.set(patient.id, patient)
    }

    map<T>(f: (c: Client)=>T) {
        const result: T[] = []
        for(let id of this.clientIDs) {
            result.push(f(this.clientsIndex.get(id)))
        }

        return result
    }

    clear() {
        this.clients = []
        this.patients.clear()
        this.matchedPatients.clear()
        this.clientsIndex.clear()
    }

    static deserialize(data: any) {
        if(data.type !== 'search-results') {
            throw util.valueError.error(`Not a SearchResult instance: ${data.type}`)
        }

        const clients: Client[] = []
        for(let rawClient of data.clients) {
            const parsedClient = Client.deserialize(rawClient)
            clients.push(parsedClient)
        }

        const patients = new Map<string, Patient>()
        for(let rawPatient of data.patients) {
            const patient = Patient.deserialize(rawPatient)
            patients.set(patient.id, patient)
        }

        const visits = new Map<string, Visit>()
        for(let rawVisit of data.visits) {
            const visit = Visit.deserialize(rawVisit)
            visits.set(visit.id, visit)
        }

        const matchedPatients = new Set<string>()
        for(let petID of data['matched-patients']) {
            matchedPatients.add(petID)
        }

        const results = new SearchResults(clients, patients, visits, matchedPatients)
        return results
    }
}
