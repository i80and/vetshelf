const util = require('./util.js')

class Event {
    constructor(type, date, note) {
        this.type = type
        this.date = date
        this.note = note
    }

    serialize() {
        return {
            type: this.type,
            date: this.date.toISOString(),
            note: this.note
        }
    }
}

Event.deserialize = function(data) {
    return new Event(data.type, new Date(data.date), data.note)
}

export default class Patient {
    constructor(id, options) {
        this._id = id
        this._name = options.name || '(unnamed)'
        this._sex = options.sex || ''
        this._species = options.species || ''
        this._breed = options.breed || ''
        this._description = options.description || ''
        this._note = options.note || ''
        this._active = options.active

        if(this._active === undefined) {
            this._active = true
        }

        this.events = []
        this.periodicals = []

        this.dirty = false
    }

    get id() { return this._id }
    set id(val) { this._id = val }

    get name() { return this._name }
    set name(val) { this.setAttr('_name', val) }

    get breed() { return this._breed }
    set breed(val) { this.setAttr('_breed', val) }

    get species() { return this._species }
    set species(val) { this.setAttr('_species', val) }

    get description() { return this._description }
    set description(val) { this.setAttr('_description', val) }

    get note() { return this._note }
    set note(val) { this.setAttr('_note', val) }

    get active() { return this._active }
    set active(val) { this.setAttr('_active', val) }

    get sex() { return this._sex[0] }
    set sex(val) {
        if(['f', 'm', 'i'].indexOf(val) < 0) {
            throw util.error('ValueError', `Invalid sex string: ${val}`)
        }

        this.dirty = true
        this._sex = `${val}${this._sex[1]}`
    }

    get intact() { return this._sex[1] === '+' }
    set intact(val) {
        this.dirty = true
        const newVal = val? '+' : '-'
        this._sex = `${this.sex}${newVal}`
    }

    setAttr(key, val) {
        this.dirty = true
        this[key] = val
    }

    serialize() {
        return {
            type: 'patient',
            id: this.id,
            name: this.name,
            sex: this._sex,
            species: this.species,
            breed: this.breed,
            description: this.description,
            note: this.note,
            active: this.active,

            events: this.events.map((ev) => ev.serialize())
        }
    }
}

Patient.deserialize = function(data) {
    if(data.type !== 'patient') {
        throw util.error('ValueError', `Not a client instance: ${data.type}`)
    }

    return new Patient(data.id, data)
}
