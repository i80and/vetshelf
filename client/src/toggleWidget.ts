/// <reference path="typings/mithril/mithril.d.ts" />

function nopFunc() { return true }

export default function toggleWidget(attrs: any) {
    const onprompt = attrs.onprompt || nopFunc
    const ontoggle = attrs.ontoggle || nopFunc
    const value = attrs.value || false

    return m('div.toggle-widget', [
        m('span.fa', {
            class: value ? 'fa-toggle-on' : 'fa-toggle-off',
            onclick: () => onprompt() ? ontoggle(!value) : undefined
        })
    ])
}
