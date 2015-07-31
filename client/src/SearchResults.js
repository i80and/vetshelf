const Client = require('./Client')
const Patient = require('./Patient')
const util = require('./util.js')

export default class SearchResults {
    constructor(clients, patients, matchedPatients) {
        this.clientIDs = clients.map((doc) => doc.id) || []
        this.patients = patients || new Map()
        this.matchedPatientIDs = matchedPatients || new Set()

        this.clientsIndex = new Map()
        for(let client of clients) {
            this.clientsIndex.set(client.id, client)
        }
    }

    updateRecord(doc) {
        if(doc instanceof Patient) {
            this.patients.set(doc.id, doc)
        } else if(doc instanceof Client) {
            this.clientsIndex.set(doc.id, doc)
        }
    }

    addPatient(patient, clientID) {
        const client = this.clientsIndex.get(clientID)

        // Don't use the normal mutator, because it sets the dirty flag. However,
        // we're simply updating the results to match what should be on the server.
        client._pets.add(patient.id)
        this.patients.set(patient.id, patient)
    }

    map(f) {
        const result = []
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
}

SearchResults.deserialize = function(data) {
    if(data.type !== 'search-results') {
        throw util.error('ValueError', `Not a SearchResult instance: ${data.type}`)
    }

    const clients = []
    for(let rawClient of data.clients) {
        const parsedClient = Client.deserialize(rawClient)
        clients.push(parsedClient)
    }

    const patients = new Map()
    for(let rawPatient of data.patients) {
        const patient = Patient.deserialize(rawPatient)
        patients.set(patient.id, patient)
    }

    const matchedPatients = new Set()
    for(let petID of data['matched-patients']) {
        matchedPatients.add(petID)
    }

    const results = new SearchResults(clients, patients, matchedPatients)
    return results
}
