// ? `:host(.dark)` activates the @enonic/ui dark token cascade inside the
// shadow root; `<html>.dark` set by the host page does not pierce the
// shadow boundary, so the class must live on every shadow host element.
//
// One matchMedia listener feeds a registry of hosts so that placeholder
// islands (one shadow per placeholder) do not each spin up their own.

const hosts = new Set<Element>();
let media: MediaQueryList | undefined;

function applyTheme(): void {
    const isDark = media?.matches === true;
    for (const host of hosts) {
        host.classList.toggle('dark', isDark);
    }
}

function subscribe(): void {
    if (media != null) return;
    media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', applyTheme);
}

function unsubscribe(): void {
    if (media == null) return;
    media.removeEventListener('change', applyTheme);
    media = undefined;
}

export function registerThemeHost(host: Element): void {
    hosts.add(host);
    subscribe();
    host.classList.toggle('dark', media?.matches === true);
}

export function unregisterThemeHost(host: Element): void {
    hosts.delete(host);
    if (hosts.size === 0) unsubscribe();
}
