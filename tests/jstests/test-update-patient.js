'use strict'

// Our update operator should result in a merge if multiple connections modify
// the same document.

const assert = require('assert')
const Connection = require('../../client/.obj/Connection.js')
const Patient = require('../../client/.obj/Patient.js')

const keys = ['name', 'breed', 'species', 'description', 'note']

export async function test(connection) {
    const patient = Patient.emptyPatient()
    await connection.savePatient(patient, [])

    const notUpdated = new Set(keys)
    const updated = new Set()
    for(let key of keys) {
        const freshPatient = Patient.emptyPatient()
        freshPatient.id = patient.id
        freshPatient[key] = 'updated'
        await connection.savePatient(freshPatient)
        const updatedPatient = (await connection.getPatients([patient.id]))[0]

        notUpdated.delete(key)
        updated.add(key)
        for(let prestine of notUpdated) {
            assert.notEqual(updatedPatient[prestine], 'updated', `Field "${key}" updated`)
        }

        for(let prestine of updated) {
            assert.equal(updatedPatient[prestine], 'updated', `Field "${key}" not updated`)
        }
    }
}
