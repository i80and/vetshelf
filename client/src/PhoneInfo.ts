export default class PhoneInfo {
    number: string
    note: string

    constructor(num: string, note: string) {
        this.number = num
        this.note = note || ''

        Object.freeze(this)
    }

    with(diff: {number?: string, note?: string}): PhoneInfo {
        return new PhoneInfo(
            diff.number === undefined? this.number : diff.number,
            diff.note === undefined? this.note : diff.note)
    }

    serialize() {
        return {
            number: this.number,
            note: this.note
        }
    }

    static deserialize(data: any): PhoneInfo {
        return new PhoneInfo(data.number, data.note)
    }
}
