import * as Search from './Search'
import * as Login from './Login'

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
    const body = document.getElementById('root-container')

    m.route(body, '/search', {
        '/login': Login,
        '/search': Search,
    })
})
