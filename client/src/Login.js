// const Connection = require('./Connection')
// const util = require('./util')

export class ViewModel {
    constructor() {
        this.serverAddress = m.prop('')
        this.password = m.prop('')
    }

    connect() {}
}

export let vm = null

export const view = function() {
    return m('section#login-page', [
        m('section#login-pane', [
            m('input#login-bar', {
                value: vm.serverAddress(),
                placeholder: 'Server',
                onclick: m.withAttr('value', vm.serverAddress) }),
            m('div.small-button', {
                title: 'Connect',
                onclick: () => vm.connect() }, m('span.fa.fa-toggle-right')),
            m('input[type=password]#password-bar', {
                value: vm.password(),
                placeholder: 'Password',
                onclick: m.withAttr('value', vm.password) })
        ])
    ])
}

export const controller = function() {
    vm = new ViewModel()
}
