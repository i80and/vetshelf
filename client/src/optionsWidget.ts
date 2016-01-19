/// <reference path="typings/mithril/mithril.d.ts" />

function nopFunc() { return }

export class State {
    public name: string
    public view: () => MithrilVirtualElement

    constructor(name: string, view: () => MithrilVirtualElement) {
        this.name = name
        this.view = view
    }
}

export function optionsWidget(attrs: { states: State[], onclick: any, value: any, allowNone?: boolean }) {
    const states = attrs.states || []
    const onclick = attrs.onclick || nopFunc
    const value = attrs.value || false
    const allowNone = attrs.allowNone || false

    return m('div.options-widget', states.map((state) => {
        const classes = (state.name === value) ? ' active' : ' inactive'
        const view = state.view()
        view.attrs.className += classes
        view.attrs.onclick = () => {
            if (allowNone && value === state.name) { onclick(null) }
            else { onclick(state.name) }
        }

        return view
    }))
}
