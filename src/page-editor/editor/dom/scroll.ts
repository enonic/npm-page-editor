/**
 * Scroll/focus helpers over the registry's element references.
 */

import {getRecord} from '../stores/registry';

/**
 * Smoothly scrolls the component's element into view.
 */
export function scrollComponentIntoView(path: string): void {
    getRecord(path)?.element?.scrollIntoView({behavior: 'smooth'});
}

/**
 * Aligns the component's *top edge* with the viewport top (instantly) and
 * returns its post-scroll bounding rect. Used by the context menu's
 * "Select parent" flow so the menu can be anchored to the parent's top without
 * waiting for scrollend.
 */
export function focusComponentInstant(path: string): DOMRect | undefined {
    const element = getRecord(path)?.element;
    if (!element) {
        return undefined;
    }

    element.scrollIntoView({behavior: 'auto', block: 'start'});
    return element.getBoundingClientRect();
}
