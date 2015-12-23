// Type definitions for PouchDB 5.1.0
// Project: http://pouchdb.com/
// Definitions by: Andrew Aldridge

declare class LocalForage {
    setItem(key: string, value: any): Promise<void>
    getItem(key: string): Promise<any>
    removeItem(key: string): Promise<void>
    clear(): Promise<void>
}

declare const localforage: LocalForage
