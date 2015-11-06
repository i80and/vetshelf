type Symbol = any

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
