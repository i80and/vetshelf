export default class Hopps {
    public onchange: (objectStore: string, value: any) => void
    private db: IDBDatabase

    constructor(db: IDBDatabase) {
        this.onchange = () => { }
        this.db = db
    }

    rawTransaction(objectStores: string[]): IDBTransaction {
        return this.db.transaction(objectStores, 'readonly')
    }

    get<T>(objectStore: string, indexName: string, queries: string[]): Promise<T[]> {
        const store = this.rawTransaction([objectStore]).objectStore(objectStore)
        const index = indexName ? store.index(indexName) : store

        const results: T[] = []

        return new Promise((resolve, reject) => {
            if (queries.length === 0) {
                return resolve([])
            }

            for (let query of queries) {
                const request = index.get(query)
                request.onsuccess = () => {
                    if (request.result === undefined) {
                        return reject(new Error(`Missing document: "${query}"`))
                    }

                    results.push(request.result)

                    if (results.length === queries.length) {
                        return resolve(results)
                    }
                }
                request.onerror = () => {
                    return reject(new Error(`Unknown error loading: "${query}"`))
                }
            }
        })
    }

    put(objectStore: string, object: {}) {
        const map = new Map()
        map.set(objectStore, [object])
        return this.putAll(map)
    }

    putAll(objects: Map<string, {}[]>): Promise<void> {
        const keys = Array.from(objects.keys())
        const transaction = this.db.transaction(keys, 'readwrite')
        for (let storeName of keys) {
            const store = transaction.objectStore(storeName)
            for (let doc of objects.get(storeName)) {
                store.put(doc)
            }
        }

        return new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => {
                for (let [storeName, docs] of objects.entries()) {
                    for (let doc of docs) {
                        this.onchange(storeName, doc)
                    }
                }

                return resolve()
            }

            transaction.onerror = (err) => {
                return reject(new Error(`Error saving document`))
            }
        })
    }

    forEach<T>(objectStore: string, indexName: string, f: (key: string, value: T) => boolean, options?: { range?: IDBKeyRange, direction?: string }): Promise<void> {
        const store = this.rawTransaction([objectStore]).objectStore(objectStore)
        const index = indexName ? store.index(indexName) : store
        const range = (options && options.range !== undefined) ? options.range : undefined
        const direction = (options && options.direction !== undefined) ? options.direction : undefined
        const cursor = index.openCursor(range, direction)

        return new Promise<void>((resolve, reject) => {
            cursor.onsuccess = () => {
                if (!cursor.result) { return resolve() }

                if (f(cursor.result.key, cursor.result.value) === false) {
                    return resolve()
                }

                cursor.result.continue()
            }

            cursor.onerror = (err) => {
                return reject(err)
            }
        })
    }

    query<T>(objectStore: string, indexName: string, range: IDBKeyRange, options: { limit: number, direction: string }): Promise<T[]> {
        const limit = (options && options.limit !== undefined) ? options.limit : Infinity
        const results: {}[] = []
        let i = 0

        return new Promise((resolve, reject) => {
            this.forEach(objectStore, indexName, (key, value) => {
                if (i > limit) {
                    resolve(results)
                    return false
                }

                i += 1
                results.push(value)
                return true
            }, { range: range, direction: options.direction }).then(() => {
                return resolve(results)
            }).catch((err) => {
                return reject(err)
            })
        })
    }

    destroy(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.db.close()
            const request = window.indexedDB.deleteDatabase(this.db.name)
            request.onsuccess = () => resolve()
            request.onerror = (err) => reject(err)
        })
    }

    static connect(name: string, version: number, upgradeFunction: (db: IDBOpenDBRequest) => void): Promise<Hopps> {
        const openRequest = indexedDB.open(name, version)
        openRequest.onupgradeneeded = () => { upgradeFunction(openRequest) }
        return new Promise((resolve, reject) => {
            openRequest.onsuccess = () => {
                return resolve(new Hopps(openRequest.result))
            }

            openRequest.onerror = (err) => {
                return reject(new Error(`${err}`))
            }
        })
    }
}
