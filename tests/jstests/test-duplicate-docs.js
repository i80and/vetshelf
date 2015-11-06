'use strict'

// Our random ID generator should never make a dup, but we need to make sure
// the server catches the case where we do.

const assert = require('assert')
const Connection = require('../../client/.obj/Connection.js')
const Client = require('../../client/.obj/Client.js')
const Patient = require('../../client/.obj/Patient.js')

export async function test(connection) {

    // We'll gimp our ID generator, then restore it at the end of this test.
    const origGenID = Connection.prototype.genID
    let caught = 0
    try {
        Connection.prototype.genID = () => { return '' }

        await connection.clear()
        await connection.saveClient(new Client(null, {}))
        await connection.savePatient(new Patient(null, {}))

        try {
            await connection.saveClient(new Client(null, {}))
        } catch(err) {
            caught += 1
        }

        try {
            await connection.savePatient(new Patient(null, {}))
        } catch(err) {
            caught += 1
        }
    } finally {
        Connection.prototype.genID = origGenID
    }

    assert.equal(caught, 2, 'Duplicate records not caught')
}