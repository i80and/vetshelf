function nopFunc() { return }

function optionsWidget(attrs) {
    const states = attrs.states || []
    const onclick = attrs.onclick || nopFunc
    const value = attrs.value || false
    const allowNone = attrs.allowNone || false

    return m('div.options-widget', states.map((state) => {
        const classes = (state.name === value)? ' active' : ' inactive'
        const view = state.view()
        view.attrs.className += classes
        view.attrs.onclick = () => {
            if(allowNone && value === state.name) { onclick(null) }
            else { onclick(state.name) }}

        return view
    }))
}

class State {
    constructor(name, view) {
        this.name = name
        this.view = view
    }
}

optionsWidget.State = State
export default optionsWidget
