/**
 * Editor boot module. On `initialize` it seeds the stores (host context,
 * phrases, params, page), boots the Preact runtime against the live-edit body,
 * and reports `ready` (or `init-error`). Every other host → editor message is
 * handled once in `bus-adapter.ts`.
 */

import type {EditorBus, InitializePayload, PageEditorParams} from '../protocol';

import {COMPONENT_SELECTOR} from './constants';
import {addPhrases} from './i18n';
import {initNewUi} from './init';
import {isComponentElement} from './parse/parse-page';
import {setHostContext} from './stores/host';
import {setPage} from './stores/page';
import {setParams} from './stores/params';
import {getRegistry} from './stores/registry';

function collectErrorPaths(): string[] {
    return Object.entries(getRegistry())
        .filter(([, record]) => record.error)
        .map(([path]) => path);
}

// A body without live-edit markup was not rendered by the page engine — e.g. a
// controller mapping matched the request in edit mode — so it cannot be edited.
function isLiveEditRender(body: HTMLElement, isFragment: boolean): boolean {
    return isFragment ? body.querySelector(COMPONENT_SELECTOR) != null : isComponentElement(body);
}

function resolveParams(params: PageEditorParams): PageEditorParams {
    return {
        ...params,
        locked: params.locked === true || !isLiveEditRender(document.body, params.isFragment === true),
    };
}

export class EditorBoot {
    private readonly bus: EditorBus;

    private destroyNewUi?: () => void;

    private readonly busCleanup: Array<() => void> = [];

    constructor(bus: EditorBus) {
        this.bus = bus;

        // The host owns the reload-confirmation prompt now; the iframe consumes
        // the message so it stays handled, but holds no state for it.
        this.busCleanup.push(this.bus.on('skip-reload-confirmation', () => undefined));

        this.busCleanup.push(this.bus.on('initialize', payload => this.init(payload)));
    }

    private init(payload: InitializePayload): void {
        // The contract says `initialize` is sent once, but nothing enforces it:
        // tear down the previous UI generation so a host re-handshake cannot
        // double-register bus handlers, listeners, and observers.
        this.destroyNewUi?.();
        this.destroyNewUi = undefined;

        setHostContext({
            hostDomain: payload.hostDomain,
            content: payload.content,
            project: payload.project,
            locale: payload.locale,
        });

        addPhrases(payload.phrases ?? {});
        setParams(resolveParams(payload.params));
        setPage(payload.page ?? undefined);

        try {
            this.destroyNewUi = initNewUi(document.body, this.bus);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.bus.post('init-error', {message: `The Live edit page could not be initialized. ${message}`});
            return;
        }

        this.bus.post('ready', {errorPaths: collectErrorPaths()});
    }

    destroy(): void {
        this.busCleanup.forEach(fn => fn());
        this.busCleanup.length = 0;

        this.destroyNewUi?.();
        this.destroyNewUi = undefined;
    }
}
