const Client = require('./Client')
const Patient = require('./Patient')
const SearchResults = require('./SearchResults')

const TIMEOUT_INTERVAL = 5000

function genID() {
    const buf = new Uint32Array(8)
    const str = []
    self.crypto.getRandomValues(buf)
    for(let i = 0; i < buf.length; i += 2) {
        str.push(buf[i].toString(16))
    }

    return str.join('')
}

class PendingContext {
    constructor(resolve, reject, removeFunc) {
        this.resolve = resolve
        this.reject = reject
        this.removeFunc = removeFunc
        this.timeoutIndex = setTimeout(() => {
            removeFunc()

            return reject({error: 'timeout'})
        }, TIMEOUT_INTERVAL)
    }

    expire() {
        clearTimeout(this.timeoutIndex)
        this.removeFunc()
    }
}

export default class Connection {
    constructor(host) {
        this.host = host
        this.sock = null

        this.pending = new Map()
        this.messageCounter = 0
    }

    genID() { return genID() }

    connect() {
        this.sock = new self.WebSocket(this.host, 'vetclix')

        this.sock.onmessage = (event) => {
            let data = null

            try {
                data = JSON.parse(event.data)
            } catch(err) {
                console.warn('Received bad message', event.data)
                return
            }

            if(!Number.isInteger(data.i)) {
                console.warn('Received unknown message', data)
            }

            const pending = this.pending.get(data.i)
            pending.expire()
            if(data.m === 'error') { return pending.reject(data.m) }
            else { return pending.resolve(data.m) }
        }

        return new Promise((resolve, reject) => {
            this.sock.onopen = () => {
                return resolve()
            }

            this.sock.onerror = (msg) => {
                return reject(msg)
            }
        })
    }

    search(query) {
        return this.__send_message(['search', query]).then((results) => {
            return SearchResults.deserialize(results)
        })
    }

    showUpcoming() {
        return this.__send_message(['show-upcoming']).then((results) => {
            return SearchResults.deserialize(results)
        })
    }

    getClients(ids) {
        return this.__send_message(['get-clients', ids]).then((results) => {
            return results.map((raw) => Client.deserialize(raw))
        })
    }

    getPatients(ids) {
        return this.__send_message(['get-patients', ids]).then((results) => {
            return results.map((raw) => Patient.deserialize(raw))
        })
    }

    /// Save a patient to the database, generating a new ID if it isn't already
    /// set. Specifies a list of client IDs for to add this patient as a pet.
    savePatient(patient, clientIDs=[]) {
        const newDoc = patient.id === undefined || patient.id === null
        if(newDoc) {
            patient.id = this.genID()
        }

        return this.__send_message(['save-patient', patient.serialize(), clientIDs, newDoc])
    }

    saveClient(client) {
        const newDoc = client.id === undefined || client.id === null
        if(newDoc) {
            client.id = this.genID()
        }

        return this.__send_message(['save-client', client.serialize(), newDoc])
    }

    login(username, password) {
        return this.__send_message(['login', username, password])
    }

    logout() {
        return this.__send_message(['logout'])
    }

    clear() {
        return this.__send_message(['clear'])
    }

    close() {
        this.sock.close()
    }

    __send_message(message) {
        this.messageCounter += 1

        return new Promise((resolve, reject) => {
            this.sock.send(JSON.stringify({
                i: this.messageCounter,
                m: message
            }))

            // Set up a pending action that associates the given messageCounter
            // with the Promise. If the request expires, remove from the pending
            // list.
            const pending = new PendingContext(resolve, reject, (i) => {
                this.pending.delete(i)
            }.bind(undefined, this.messageCounter))

            this.pending.set(this.messageCounter, pending)
        })
    }
}

Connection.theConnection = null
Connection.init = function() {
    Connection.theConnection = new Connection('ws://localhost')
    return Connection.theConnection.connect()
}
