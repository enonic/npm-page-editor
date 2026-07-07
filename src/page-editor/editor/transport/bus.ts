/**
 * Singleton owner of the editor-side protocol bus.
 *
 * The editor speaks the standalone postMessage protocol only. `initTransport`
 * pins the bus to the host origin; `getBus` is read by every fire site that
 * posts editor → host messages.
 *
 * SSR-safe: nothing touches `window` until `initTransport` runs.
 */

import {createEditorBus, type EditorBus} from '../../protocol';

export type InitTransportOptions = {
    /** Explicit host origin, e.g. `https://admin.example.com`. */
    hostOrigin?: string;
};

let bus: EditorBus | undefined;

/**
 * Resolves the origin to pin the bus to. Prefers the explicit `hostOrigin`,
 * then the `document.referrer` origin (the iframe was opened by the host),
 * and finally `'*'` with a single error: that fallback accepts messages from
 * any origin and is a misconfiguration outside tests/sandboxed docs.
 */
function resolveRemoteOrigin(hostOrigin: string | undefined): string {
    if (hostOrigin != null && hostOrigin.length > 0) {
        return hostOrigin;
    }

    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    if (referrer.length > 0) {
        try {
            return new URL(referrer).origin;
        } catch {
            // Fall through to the wildcard.
        }
    }

    console.error('[page-editor] no host origin available; accepting messages from any origin');
    return '*';
}

export function initTransport(options: InitTransportOptions = {}): EditorBus {
    if (bus != null) {
        return bus;
    }

    bus = createEditorBus({
        remote: window.parent,
        remoteOrigin: resolveRemoteOrigin(options.hostOrigin),
    });

    return bus;
}

export function getBus(): EditorBus | undefined {
    return bus;
}

export function destroyTransport(): void {
    bus?.destroy();
    bus = undefined;
}
