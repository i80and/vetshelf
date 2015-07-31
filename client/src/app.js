const Connection = require('./Connection')
const Search = require('./Search')
const Login = require('./Login')

document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('root-container')

    Connection.init().then(() => {
        window.conn = Connection.theConnection

        m.route(body, '/search', {
            '/login': Login,
            '/search': Search,
        })
    })
})

window.addEventListener('unload', () => {
    Connection.theConnection.close()
})
