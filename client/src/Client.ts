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

    private dirty: Set<string>

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

        this.dirty = new Set<string>()

        Object.seal(this)
    }

    get isDirty(): boolean { return this.dirty.size > 0 }

    get id() { return this._id }
    set id(val) { this._id = val }

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
        if(index > 0) {
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
            id: this.id,
            name: this.name,
            address: this.address,
            email: this.email,
            phone: this.phone.map((p) => p.serialize()),
            pets: this.pets,
            note: this.note,

            // Filter out dirty fields that are for our own use
            dirty: Array.from(this.dirty).filter((x) => x[0] !== '_')
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

    static emptyClient(): Client {
        return new Client(null, {})
    }
}
