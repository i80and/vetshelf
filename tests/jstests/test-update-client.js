'use strict'

// Our update operator should result in a merge if multiple connections modify
// the same document.

const assert = require('assert')
const Connection = require('../../client/.obj/Connection.js')
const Client = require('../../client/.obj/Client.js')

const keys = ['name', 'address', 'email', 'note']

export async function test(connection) {
    const client = Client.emptyClient()
    await connection.saveClient(client)

    const notUpdated = new Set(keys)
    const updated = new Set()
    for(let key of keys) {
        const freshClient = Client.emptyClient()
        freshClient.id = client.id
        freshClient[key] = 'updated'
        await connection.saveClient(freshClient)
        const updatedClient = (await connection.getClients([client.id]))[0]

        notUpdated.delete(key)
        updated.add(key)
        for(let prestine of notUpdated) {
            assert.notEqual(updatedClient[prestine], 'updated', `Field "${key}" updated`)
        }

        for(let prestine of updated) {
            assert.equal(updatedClient[prestine], 'updated', `Field "${key}" not updated`)
        }
    }
}
