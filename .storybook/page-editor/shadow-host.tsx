import {createPortal} from 'preact/compat';
import type {ComponentChildren} from 'preact';
import {useEffect, useState} from 'preact/hooks';

import pageEditorUiCss from './page-editor-ui.css?inline';

interface ShadowHostProps {
    children: ComponentChildren;
}

export function ShadowHost({children}: ShadowHostProps) {
    const [host, setHost] = useState<HTMLDivElement | null>(null);
    const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!host) {
            return;
        }

        const shadowRoot = host.shadowRoot ?? host.attachShadow({mode: 'open'});
        let styleEl = shadowRoot.querySelector<HTMLStyleElement>('style[data-page-editor-ui]');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.dataset.pageEditorUi = 'true';
            styleEl.textContent = pageEditorUiCss;
            shadowRoot.appendChild(styleEl);
        }

        let rootEl = shadowRoot.querySelector<HTMLDivElement>('div[data-page-editor-root]');
        if (!rootEl) {
            rootEl = document.createElement('div');
            rootEl.dataset.pageEditorRoot = 'true';
            shadowRoot.appendChild(rootEl);
        }

        setMountNode(rootEl);
    }, [host]);

    return <div ref={setHost}>{mountNode ? createPortal(children, mountNode) : null}</div>;
}
