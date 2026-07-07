/**
 * One-shot "suppress the next click" flag, set by a drag drop and consumed by
 * the selection handler so the mouseup that ends a drag does not also toggle
 * selection.
 */

let nextClickDisabled = false;

export function setNextClickDisabled(value: boolean): void {
    nextClickDisabled = value;
}

export function isNextClickDisabled(): boolean {
    return nextClickDisabled;
}
