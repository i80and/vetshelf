export function fromNowMinimum(m: moment.Moment): string {
    const now = moment()
    if(m.diff(now, 'hours') <= 1) {
        return 'now'
    }

    return m.from(now)
}

export class Timeout {
    public promise: Promise<string>
    public timeoutID: number
    private resolve: (status:string)=>void

    constructor(ms: number) {
        this.promise = new Promise<string>((resolve) => {
            this.resolve = resolve
            this.timeoutID = window.setTimeout(() => {
                return resolve('')
            }, ms)
        })
    }

    cancel(): void {
        window.clearTimeout(this.timeoutID)
        this.resolve('canceled')
    }
}

export function timeout(ms: number): Timeout {
    return new Timeout(ms)
}

export function genID(prefix: string): string {
    const buf = new Uint32Array(8)
    const str: string[] = []
    crypto.getRandomValues(buf)
    for (let i = 0; i < buf.length; i += 2) {
        str.push(buf[i].toString(16))
    }

    return `${prefix}-${str.join('')}`
}

export function batchMap<T>(data: T[], batchSize: number, f: (x: T[])=>void) {
    let batch: T[] = []
    for (let element of data) {
        batch.push(element)

        if (batch.length > batchSize) {
            f(batch)
            batch = []
        }
    }

    if (batch) {
        f(batch)
    }
}

export class SimpleError {
    name: string
    private errors: Symbol[]

    constructor(name: string, errors: Symbol[]) {
        this.name = name
        this.errors = errors
        Object.freeze(this.errors)
        Object.freeze(this)
    }

    derive(name: string): SimpleError {
        const newErrors = this.errors.slice()
        newErrors.push(Symbol(name))
        return new SimpleError(name, newErrors)
    }

    check(error: Error): boolean {
        const _error: any = error
        if(_error.errorHierarchy === undefined) { return false }

        return _error.errorHierarchy.indexOf(this.class) >= 0
    }

    error(message: string): Error {
        const jsError: any = Error(`${this.name}: ${message}`)
        jsError.errorHierarchy = this.errors
        jsError.name = this.name
        return jsError
    }

    get class(): Symbol {
        if(this.errors.length === 0) {
            throw Error('Cannot get class of empty SimpleError')
        }

        return this.errors[this.errors.length - 1]
    }
}

export const baseError = new SimpleError('BaseError', [Symbol('BaseError')])
export const valueError = baseError.derive('ValueError')
export const typeError = baseError.derive('TypeError')
export const keyError = baseError.derive('KeyError')
export const assertionError = baseError.derive('AssertionError')
