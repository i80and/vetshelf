const util = require('./util.js')

export default class Client {
    constructor(id, options) {
        this._id = id
        this._name = options.name || '(unnamed)'
        this._address = options.address || ''
        this._pets = new Set()
        this._note = options.note || ''

        if(options.pets) {
            for(let petID of options.pets) {
                this._pets.add(petID)
            }
        }

        this.dirty = false
    }

    get id() { return this._id }
    set id(val) { this._id = val }

    get name() { return this._name }
    set name(val) { this.setAttr('_name', val) }

    get address() { return this._address }
    set address(val) { this.setAttr('_address', val) }

    get note() { return this._note }
    set note(val) { this.setAttr('_note', val) }

    get pets() { return [...this._pets.values()] }

    addPet(petID) {
        this.dirty = true
        this._pets.add(petID)
    }

    removePet(petID) {
        this.dirty = true
        this._pets.remove(petID)
    }

    hasPet(petID) { return this._pets.has(petID) }

    setAttr(key, val) {
        this.dirty = true
        this[key] = val
    }

    serialize() {
        return {
            type: 'client',
            id: this.id,
            name: this.name,
            address: this.address,
            pets: this.pets,
            note: this.note
        }
    }
}

Client.deserialize = function(data) {
    if(data.type !== 'client') {
        throw util.error('ValueError', `Not a client instance: ${data.type}`)
    }

    return new Client(data.id, data)
}
