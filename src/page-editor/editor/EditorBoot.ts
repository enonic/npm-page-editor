/**
 * Editor boot module. On `initialize` it seeds the stores (host context,
 * phrases, params, page), boots the Preact runtime against the live-edit body,
 * and reports `ready` (or `init-error`). Every other host → editor message is
 * handled once in `bus-adapter.ts`.
 */

import type {EditorBus, InitializePayload} from '../protocol';

import {addPhrases} from './i18n';
import {initNewUi} from './init';
import {setHostContext} from './stores/host';
import {setPage} from './stores/page';
import {setParams} from './stores/params';

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
        setParams(payload.params);
        setPage(payload.page ?? undefined);

        try {
            this.destroyNewUi = initNewUi(document.body, this.bus);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.bus.post('init-error', {message: `The Live edit page could not be initialized. ${message}`});
            return;
        }

        this.bus.post('ready', {});
    }

    destroy(): void {
        this.busCleanup.forEach(fn => fn());
        this.busCleanup.length = 0;

        this.destroyNewUi?.();
        this.destroyNewUi = undefined;
    }
}
