self.importScripts('lunr.min.js',
                   'localforage.min.js',
                   'moment.min.js')

class TextSearch {
    constructor() {
        this.searchIndex = lunr(function() {
            this.ref('_id')
            this.field('name', { boost: 10 })
            this.field('address')
            this.field('email')
            this.field('phone')
            this.field('note')
            this.field('pet_name', { boost: 2 })
            this.field('pet_species')
            this.field('pet_breed')
            this.field('pet_sex')
            this.field('pet_description')
            this.field('pet_note')
        })
    }

    search(query) {
        return new Promise((resolve) => resolve(this.searchIndex.search(query)))
    }

    add(doc) {
        this.searchIndex.add(doc)
        return new Promise((resolve) => resolve())
    }

    update(doc) {
        this.searchIndex.update(doc)
        return new Promise((resolve) => resolve())
    }

    load() {
        return localforage.getItem('lunr-index').then((rawIndex) => {
            rawIndex = JSON.parse(rawIndex)
            if (!rawIndex || rawIndex.tokenStore.length === 0) {
                throw new Error('No index to load')
            }
            this.searchIndex = lunr.Index.load(rawIndex)
        })
    }

    persist() {
        const index = JSON.stringify(this.searchIndex.toJSON())
        return localforage.setItem('lunr-index', index)
    }

    debug(record) {
        if(record) {
            return new Promise((resolve) => resolve(this.searchIndex.documentStore.get(record)))
        }

        return localforage.getItem('lunr-index').then((rawIndex) => {
            let cacheSize = -1
            if(rawIndex) { cacheSize = JSON.parse(rawIndex).tokenStore.length }
            return {
                tokenStoreSize: this.searchIndex.tokenStore.length,
                cacheSize: cacheSize
            }
        })
    }

    clearCache() {
        localforage.removeItem('lunr-index')
        return new Promise((resolve) => resolve())
    }
}

const index = new TextSearch()

function reportError(id, err) {
    self.postMessage({
        id: id,
        error: err.toString()
    })
}

self.onmessage = function(e) {
    const method = e.data.args[0]
    const args = e.data.args.slice(1)

    try {
        index[method](...args).then((result) => {
            self.postMessage({
                id: e.data.id,
                result: result
            })
        }).catch((err) => {
            reportError(e.data.id, err)
        })
    } catch(err) {
        reportError(e.data.id, err)
    }
}
