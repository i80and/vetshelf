// Lightweight custom error generator
export function error(name, message) {
    return {
        name: name,
        message: message,
        stack: (new Error()).stack,
        toString: function() {
            return `Error: ${this.name}: ${this.message}\n${this.stack}`
        }
    }
}
