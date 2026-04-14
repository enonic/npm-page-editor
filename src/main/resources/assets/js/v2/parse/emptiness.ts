const OVERLAY_HOST_ID = 'pe-overlay-host';
const PLACEHOLDER_HOST_ATTR = 'data-pe-placeholder-host';
const DRAG_ANCHOR_ATTR = 'data-pe-drag-anchor';

export function isEditorInjectedElement(element: Element): boolean {
  return (
    element instanceof HTMLElement &&
    (element.hasAttribute(PLACEHOLDER_HOST_ATTR) ||
      element.hasAttribute(DRAG_ANCHOR_ATTR) ||
      element.id === OVERLAY_HOST_ID)
  );
}

export function isNodeEmpty(element: HTMLElement): boolean {
  for (const child of Array.from(element.children)) {
    if (isEditorInjectedElement(child)) continue;
    return false;
  }

  return element.textContent?.trim().length === 0;
}
