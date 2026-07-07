import {OVERLAY_HOST_ID, TRACKED_SELECTOR} from '../../constants';

export function isOverlayChromeEvent(event: Event): boolean {
    return event.composedPath().some(value => value instanceof HTMLElement && value.id === OVERLAY_HOST_ID);
}

export function getTrackedTarget(target: EventTarget | null): HTMLElement | null {
    // Events landing on inline `<svg>` content carry an SVGElement target, not
    // an HTMLElement — tracked wrappers are always HTML, so `closest` is safe.
    if (!(target instanceof Element)) {
        return null;
    }

    return target.closest<HTMLElement>(TRACKED_SELECTOR);
}

export function suppressNativeEvent(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
}
