#!/usr/bin/env babel-node --stage 1
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Connection = require('../client/src/Connection.js')

// Shims to simulate a browser-like environment
global.self = {}
global.self.WebSocket = require('ws')
global.self.crypto = crypto
global.self.crypto.getRandomValues = function(buf) {
    const rnd = crypto.randomBytes(buf.byteLength)
    for(let i = 0; i < buf.length; i += 1) {
        buf[i] = 0

        for(let bytei = 0; bytei < buf.BYTES_PER_ELEMENT; bytei += 1) {
            buf[i] |= rnd[i+bytei] << (bytei * 8)
        }
    }
}

function runTests(connection) {
    const tests = []

    const testRoot = path.join(__dirname, 'jstests')
    const files = fs.readdirSync(testRoot)
    for(let file of files) {
        console.log(file)
        try {
            if(file.endsWith('.js')) {
                tests.push(require(path.join(testRoot, file)).test)
            }
        } catch(err) {
            console.error(err)
        }
    }

    const runTest = function(i) {
        if(i >= tests.length) {
            return
        }

        return tests[i](connection).catch((err) => {
            console.error(err)
        }).then(() => {
            return runTest(i+1)
        })
    }

    return runTest(0).then(() => {
        console.log('Done!')
    })
}

Connection.init()
    .then(() => runTests(Connection.theConnection))
    .then(()=> Connection.theConnection.close())
    .catch((err) => {
        console.error(err)
        console.error(`Failed to connect: ${err.code}`)
    })
