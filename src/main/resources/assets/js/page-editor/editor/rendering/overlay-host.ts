import {render, type ComponentChildren} from 'preact';
import {OVERLAY_HOST_ID, OVERLAY_ROOT_ATTR} from '../constants';
import {injectEditorStyles} from './inject-styles';
import {registerThemeHost, unregisterThemeHost} from './theme-sync';

export interface OverlayHost {
    host: HTMLElement;
    shadow: ShadowRoot;
    mount: HTMLElement;
    unmount: () => void;
}

export function createOverlayHost(content: ComponentChildren): OverlayHost {
    const host = document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483646';
    document.body.appendChild(host);

    const shadow = host.attachShadow({mode: 'open'});
    injectEditorStyles(shadow);
    registerThemeHost(host);

    const mount = document.createElement('div');
    mount.setAttribute(OVERLAY_ROOT_ATTR, 'true');
    shadow.appendChild(mount);
    render(content, mount);

    return {
        host,
        shadow,
        mount,
        unmount: () => {
            unregisterThemeHost(host);
            render(null, mount);
            host.remove();
        },
    };
}
