import {OVERLAY_HOST_ID, TRACKED_SELECTOR} from '../constants';

export function isOverlayChromeEvent(event: Event): boolean {
    return event.composedPath().some((value) => value instanceof HTMLElement && value.id === OVERLAY_HOST_ID);
}

export function getTrackedTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    return target.closest(TRACKED_SELECTOR);
}

export function suppressNativeEvent(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
}
