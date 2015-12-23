import PhoneInfo from './PhoneInfo'
import * as util from './util'

interface ISummary {
    [index: string]: string

    _id: string,
    name: string,
    address: string,
    phone: string,
    email: string,
    note: string,
}

export default class Client {
    _id: string
    _rev: string
    private _name: string
    private _address: string
    private _email: string
    private _phone: PhoneInfo[]
    private _pets: Set<string>
    private _note: string

    private dirty: Set<string>

    constructor(_id: string, options: any) {
        this._id = _id
        this._rev = options._rev
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

        this.dirty = new Set<string>()

        Object.seal(this)
    }

    get id(): string { return this._id }
    set id(val: string) { this._id = val }

    get isDirty(): boolean { return this.dirty.size > 0 }

    get name() { return this._name }
    set name(val) {
        this.dirty.add('name')
        this._name = val
    }

    get address() { return this._address }
    set address(val) {
        this.dirty.add('address')
        this._address = val
    }

    get email() { return this._email }
    set email(val) {
        this.dirty.add('email')
        this._email = val
    }

    get phone() { return [...this._phone] }

    savePhone(oldPhone: PhoneInfo, newPhone: PhoneInfo) {
        this.dirty.add('phone')

        // If the new phone number has no number associated with it, remove
        // from the list.
        const deletePhone = (newPhone.number === '')
        if(deletePhone) {
            this._phone = this._phone.filter((p) => p.number !== oldPhone.number)
            return
        }

        // Otherwise, see if we can update an existing entry
        const index = this._phone.findIndex((p) => p.number === oldPhone.number)
        if(index >= 0) {
            this._phone[index] = newPhone
            return
        }

        // If oldPhone wasn't found, just insert the dang thing
        this._phone.push(newPhone)
    }

    removePhone(phoneInfo: PhoneInfo) {
        this.dirty.add('phone')
        this._phone = this._phone.filter((p) => p !== phoneInfo)
    }

    get note() { return this._note }
    set note(val) {
        this.dirty.add('note')
        this._note = val
    }

    get pets() { return [...this._pets.values()] }

    addPet(petID: string) {
        this.dirty.add('_pets')
        this._pets.add(petID)
    }

    removePet(petID: string) {
        this.dirty.add('_pets')
        this._pets.delete(petID)
    }

    hasPet(petID: string) { return this._pets.has(petID) }

    clearDirty(): void {
        this.dirty.clear()
    }

    serialize() {
        return {
            type: 'client',
            _id: this._id,
            _rev: this._rev,
            name: this.name,
            address: this.address,
            email: this.email,
            phone: this.phone.map((p) => p.serialize()),
            pets: this.pets,
            note: this.note
        }
    }

    summarize(): ISummary {
        return {
            _id: this._id,
            name: this.name,
            address: this.address,
            phone: this._phone.map((info) => info.pureNumber()).join(' '),
            email: this.email,
            note: this.note,
        }
    }

    static deserialize(data: any) {
        if (data.type !== 'client') {
            throw util.valueError.error(`Not a client instance: ${data.type}`)
        }

        if(data.phone === null) { data.phone = [] }
        data.phone = data.phone.map((c: any) => PhoneInfo.deserialize(c))

        return new Client(data._id, data)
    }

    static emptyClient(): Client {
        return new Client(null, {})
    }
}
