import Client from './Client'
import Patient from './Patient'
import * as util from './util'

type visitID = string
type patientID = string
type clientID = string

export default class SearchResults {
    private clientIDs: clientID[]
    private patients: Map<patientID, Patient>
    private visitIndex: Map<visitID, patientID>
    matchedPatients: Set<patientID>
    private clientsIndex: Map<clientID, Client>

    constructor(clients: Client[],
                patients: Map<patientID, Patient>=null,
                matchedPatients: Set<patientID>=null) {

        this.clientIDs = clients.map((doc) => doc.id) || []
        this.patients = patients || new Map<patientID, Patient>()
        this.matchedPatients = matchedPatients || new Set<patientID>()

        this.clientsIndex = new Map<clientID, Client>()
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

    get length(): number {
        return this.clientIDs.length
    }

    getClient(id: string): Client {
        return this.clientsIndex.get(id)
    }

    getPatient(id: string): Patient {
        return this.patients.get(id)
    }

    map<T>(f: (c: Client)=>T) {
        const result: T[] = []
        for(let id of this.clientIDs) {
            const client = this.clientsIndex.get(id)
            if(!client) { continue }
            result.push(f(client))
        }

        return result
    }

    refreshClient(client: Client): void {
        if(!this.clientsIndex.get(client._id)) {
            // Insert the new client at the top of the results list
            this.clientIDs.splice(0, 0, client._id)
        }

        this.clientsIndex.set(client._id, client)
    }

    refreshPatient(patient: Patient): void {
        const oldPatient = this.patients.get(patient._id)
        if(oldPatient) {
            // Remove any old visits
            for(let visit of oldPatient.visits) {
                if(patient.visits.findIndex((v) => v.id === visit.id) < 0) {
                    // We have to remove this visit
                    this.visitIndex.delete(visit.id)
                }
            }
        }

        this.patients.set(patient._id, patient)
        for(let visit of patient.visits) {
            this.visitIndex.set(visit.id, patient._id)
        }
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

        const matchedPatients = new Set<string>()
        for(let petID of data['matched-patients']) {
            matchedPatients.add(petID)
        }

        const results = new SearchResults(clients, patients, matchedPatients)
        return results
    }
}
