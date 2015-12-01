import PhoneInfo from './PhoneInfo'
import * as util from './util'

export default class Client {
    _id: string
    _name: string
    _address: string
    _email: string
    _phone: PhoneInfo[]
    _pets: Set<string>
    _note: string

    dirty: boolean

    constructor(id: string, options: any) {
        this._id = id
        this._name = options.name || '(unnamed)'
        this._address = options.address || ''
        this._email = options.email || ''
        this._phone = options.phone || []
        this._pets = new Set<string>()
        this._note = options.note || ''

        if(options.pets) {
            for(let petID of options.pets) {
                this._pets.add(petID)
            }
        }

        this.dirty = false

        Object.seal(this)
    }

    get id() { return this._id }
    set id(val) { this._id = val }

    get name() { return this._name }
    set name(val) {
        this.dirty = true;
        this._name = val
    }

    get address() { return this._address }
    set address(val) {
        this.dirty = true;
        this._address = val
    }

    get email() { return this._email }
    set email(val) {
        this.dirty = true;
        this._email = val
    }

    get phone() { return [...this._phone] }

    addPhone(phoneInfo: PhoneInfo) {
        this.dirty = true
        this._phone.push(phoneInfo)
    }

    updatePhone(oldPhone: PhoneInfo, newPhone: PhoneInfo) {
        this.dirty = true
        this._phone = this._phone.map((p) => {
            if(p === oldPhone) {
                return newPhone
            }

            return p
        })
    }

    removePhone(phoneInfo: PhoneInfo) {
        this.dirty = true
        this._phone = this._phone.filter((p) => p !== phoneInfo)
    }

    get note() { return this._note }
    set note(val) {
        this.dirty = true;
        this._note = val
    }

    get pets() { return [...this._pets.values()] }

    addPet(petID: string) {
        this.dirty = true
        this._pets.add(petID)
    }

    removePet(petID: string) {
        this.dirty = true
        this._pets.delete(petID)
    }

    hasPet(petID: string) { return this._pets.has(petID) }

    serialize() {
        return {
            type: 'client',
            id: this.id,
            name: this.name,
            address: this.address,
            email: this.email,
            phone: this.phone.map((p) => p.serialize()),
            pets: this.pets,
            note: this.note
        }
    }

    static deserialize(data: any) {
        if (data.type !== 'client') {
            throw util.valueError.error(`Not a client instance: ${data.type}`)
        }

        if(data.phone === null) { data.phone = [] }
        data.phone = data.phone.map((c: any) => PhoneInfo.deserialize(c))

        return new Client(data.id, data)
    }
}
