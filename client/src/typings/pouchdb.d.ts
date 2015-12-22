// Type definitions for PouchDB 5.1.0
// Project: http://pouchdb.com/
// Definitions by: Andrew Aldridge

interface PouchResponse {
    ok?: boolean
    rev?: string
    id?: string
}

interface PouchQueryResponse {
    ok?: boolean
    rows: {doc?: any, id: string, key: string, value: any}[]
}

interface GetOptions {
    rev?: string,
    revs?: boolean
}

interface PouchOptions {
    name?: string

    // Local DB options
    auto_compaction?: boolean
    adapter?: string

    // Remote DB options
    skip_setup?: boolean
}

interface QueryOptions {
    include_docs?: boolean
    conflicts?: boolean
    startkey?: string
    endkey?: string
    key?: string
    keys?: string[]
    descending?: boolean
    limit?: number
    skip?: number
    inclusive_end?: boolean
    stale?: string
}

interface SearchOptions {
    query?: string,
    fields: any
    limit?: number
    skip?: number
    highlighting?: boolean
    filter?: (doc: any)=>boolean
    include_docs?: boolean
    mm?: number
}

declare class PouchDB {
    constructor(name?: string, options?: PouchOptions)
    destroy(): Promise<PouchResponse>

    put(doc: any, docId?: string, docRev?: string): Promise<PouchResponse>
    post(doc: any): Promise<PouchResponse>
    get(docId: string, options?: GetOptions): Promise<PouchResponse>
    query(view: string, options?: QueryOptions): Promise<PouchQueryResponse>
    allDocs(options?: QueryOptions): Promise<PouchQueryResponse>
    remove(doc: any): Promise<PouchResponse>
    bulkDocs(docs: any[]): Promise<PouchResponse>
    compact(): Promise<PouchResponse>

    // The quick-search plugin
    search(options: SearchOptions): Promise<any>
}
