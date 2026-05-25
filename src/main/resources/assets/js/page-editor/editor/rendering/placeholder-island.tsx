import {render, type ComponentChildren} from 'preact';
import {PLACEHOLDER_HOST_ATTR} from '../constants';
import {injectEditorStyles} from './inject-styles';
import {registerThemeHost, unregisterThemeHost} from './theme-sync';
import type {PlaceholderIsland} from '../types';

export interface CreatePlaceholderIslandOptions {
    overlay?: boolean;
}

export function createPlaceholderIsland(
    container: HTMLElement,
    content: ComponentChildren,
    options: CreatePlaceholderIslandOptions = {},
): PlaceholderIsland {
    const host = document.createElement('div');
    host.setAttribute(PLACEHOLDER_HOST_ATTR, options.overlay ? 'overlay' : 'true');

    let savedContainerPosition: string | undefined;

    if (options.overlay) {
        const computed = container.ownerDocument.defaultView?.getComputedStyle(container);
        const currentPosition = computed?.position;
        const needsContainingBlock = !currentPosition
            || currentPosition === 'static'
            || currentPosition === '';
        if (needsContainingBlock) {
            savedContainerPosition = container.style.position;
            container.style.position = 'relative';
        }
        host.style.position = 'absolute';
        host.style.inset = '0';
    } else {
        host.style.display = 'block';
        host.style.width = '100%';
        host.style.height = '100%';
    }

    container.appendChild(host);

    const shadow = host.attachShadow({mode: 'open'});
    injectEditorStyles(shadow);
    registerThemeHost(host);

    const mount = document.createElement('div');
    mount.style.height = '100%';
    shadow.appendChild(mount);
    render(content, mount);

    return {
        container,
        host,
        shadow,
        unmount: () => {
            unregisterThemeHost(host);
            render(null, mount);
            host.remove();

            if (savedContainerPosition !== undefined) {
                if (savedContainerPosition === '') {
                    container.style.removeProperty('position');
                } else {
                    container.style.position = savedContainerPosition;
                }
            }
        },
    };
}
