/// <reference path="typings/mithril/mithril.d.ts" />

import Database from './Database'

export class ViewModel {
    database: Database

    constructor(database: Database) {
        this.database = database
    }

    getFile(files: FileList): void {
        if (files.length <= 0) { return }
        const file = files[0]
        const reader = new FileReader()
        reader.onload = async (): Promise<void> => {
            console.log('Parsing JSON')
            const data = JSON.parse(reader.result)
            console.log('Starting import')
            await this.database.importData(data)
            console.log('Done importing! Building indexes...')
            await this.database.ensureIndexes()
            console.log('Done building indexes!')
        }
        reader.readAsText(file)
    }
}

export let vm: ViewModel = null

export const view = function() {
    return m('input[type="file"]', {
        onchange: function() { vm.getFile(this.files) }
    })
}

export const controller = function() {
    const database = new Database()
    m.startComputation()
    database.ensureIndexes().then(() => {
        vm = new ViewModel(database)
        m.endComputation()
    })
}
