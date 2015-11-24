import Connection from './Connection'
import Client from './Client'
import Patient from './Patient'
import Visit from './Visit'
import * as util from './util'

type visitID = string
type patientID = string

export default class SearchResults {
    clientIDs: string[]
    patients: Map<string, Patient>
    visits: Map<visitID, Visit>
    visitIndex: Map<visitID, patientID>
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

        this.visitIndex = new Map<visitID, patientID>()
        for(let patient of this.patients.values()) {
            for(let visit of patient.visits) {
                this.visitIndex.set(visit.id, patient.id)
            }
        }
    }

    client(id: string): Client {
        const client = this.clientsIndex.get(id)
        if(!client) {
            throw util.keyError.error(`No such client: "${id}"`)
        }

        return client
    }

    patient(id: string): Patient {
        const patient = this.patients.get(id)
        if (!patient) {
            throw util.keyError.error(`No such patient: "${id}"`)
        }
        return patient
    }

    insertVisit(patientID: string, visit: Visit) {
        return Connection.theConnection.saveVisit(patientID, visit).then((x) => {
            this.visits.set(visit.id, visit)
            this.visitIndex.set(visit.id, patientID)

            // An updated visit means the patient due dates might change.
            return Connection.theConnection.getPatients([patientID])
        }).then((patients: Patient[]) => {
            const patient = patients[0]
            this.patients.set(patient.id, patient)
        })
    }

    updateVisit(visit: Visit) {
        const patientID = this.visitIndex.get(visit.id)
        if(!patientID) { throw util.valueError.error(`Couldn't find patient for visit ${visit.id}`) }

        return Connection.theConnection.saveVisit(patientID, visit).then((x) => {
            this.visits.set(visit.id, visit)

            // An updated visit means the patient due dates might change.
            return Connection.theConnection.getPatients([patientID])
        }).then((patients: Patient[]) => {
            const patient = patients[0]
            this.patients.set(patient.id, patient)
        })
    }

    updateClient(client: Client) {
        return Connection.theConnection.saveClient(client).then(() => {
            if(!this.clientsIndex.has(client.id)) {
                // New client; put it at the top of the clients list
                this.clientIDs.splice(0, 0, client.id)
            }

            this.clientsIndex.set(client.id, client)
            return client.id
        })
    }

    updatePatient(patient: Patient, options?: { addOwners: string[] }) {
        const toAdd = (options && options.addOwners)? options.addOwners : []
        return Connection.theConnection.savePatient(patient, toAdd).then((id: string) => {
            this.patients.set(patient.id, patient)
            return this.refreshClients(toAdd)
        }).then(() => {
            return patient.id
        })
    }

    refreshClients(clients: string[]) {
        return Connection.theConnection.getClients(clients).then((clients) => {
            for(let client of clients) {
                this.clientsIndex.set(client.id, client)
            }
        })
    }

    refreshPatients(ids: string[]) {
        return Connection.theConnection.getPatients(ids).then((patients) => {
            for (let patient of patients) {
                this.patients.set(patient.id, patient)
            }
        })
    }

    map<T>(f: (c: Client)=>T) {
        const result: T[] = []
        for(let id of this.clientIDs) {
            result.push(f(this.clientsIndex.get(id)))
        }

        return result
    }

    clear() {
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
