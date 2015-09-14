class BaseError {
    name: string
    message: string
    stack: any

    constructor(name: string, message: string, stack: any) {
        this.name = name
        this.message = message
        this.stack = stack
    }

    toString(): string {
        return `Error: ${this.name}: ${this.message}\n${this.stack}`
    }
}

// Lightweight custom error generator
export function error(name: string, message: string): any {
    const err: any = (new Error())
    return new BaseError(name, message, err.stack)
}
