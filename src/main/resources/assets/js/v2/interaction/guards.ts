const OVERLAY_HOST_ID = 'pe-overlay-host';
const TRACKED_SELECTOR = '[data-portal-component-type], [data-portal-region]';

export function isOverlayChromeEvent(event: Event): boolean {
  return event.composedPath().some(value => value instanceof HTMLElement && value.id === OVERLAY_HOST_ID);
}

export function getTrackedTarget(target: EventTarget | null): HTMLElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.closest(TRACKED_SELECTOR) ?? undefined;
}

export function suppressNativeEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}
