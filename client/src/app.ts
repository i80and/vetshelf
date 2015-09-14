import Connection from './Connection'
import * as Search from './Search'
import * as Login from './Login'

document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('root-container')

    Connection.init().then(() => {
        m.route(body, '/search', {
            '/login': Login,
            '/search': Search,
        })
    })
})

window.addEventListener('unload', () => {
    Connection.theConnection.close()
})
