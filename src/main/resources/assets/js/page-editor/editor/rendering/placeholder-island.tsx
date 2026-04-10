import {render, type ComponentChildren} from 'preact';
import {PLACEHOLDER_HOST_ATTR} from '../constants';
import {injectEditorStyles} from './inject-styles';
import type {PlaceholderIsland} from '../types';

export function createPlaceholderIsland(container: HTMLElement, content: ComponentChildren): PlaceholderIsland {
    const host = document.createElement('div');
    host.setAttribute(PLACEHOLDER_HOST_ATTR, 'true');
    host.style.display = 'block';
    host.style.width = '100%';
    host.style.height = '100%';
    container.appendChild(host);

    const shadow = host.attachShadow({mode: 'open'});
    injectEditorStyles(shadow);

    const mount = document.createElement('div');
    mount.style.height = '100%';
    shadow.appendChild(mount);
    render(content, mount);

    return {
        container,
        host,
        shadow,
        unmount: () => {
            render(null, mount);
            host.remove();
        },
    };
}
