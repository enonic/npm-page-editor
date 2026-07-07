import {COMPONENT_SELECTOR, ERROR_ATTR} from '../constants';
import {prepareTextComponent} from '../text/text-component';

/** Marks a fragment whose stripped descendants included a layout. */
const CONTAINS_LAYOUT_ATTR = 'data-pe-contains-layout';

/**
 * Strips `data-portal-*` tracking attributes from a fragment's descendants so
 * its inner components are not independently tracked, selectable, or draggable —
 * a fragment is a single opaque unit on the page. Records whether a layout was
 * present (before stripping, for `elementContainsLayout`) and propagates a
 * descendant placeholder error onto the fragment wrapper.
 *
 * Runs both when a fragment is rendered via `replaceComponentHtml` and when one
 * is first parsed from the initial page: otherwise an inner
 * `data-portal-component-type` element shadows the fragment in
 * `closest('[data-portal-component-type]')` hit-testing and the fragment reads
 * as unselectable. Idempotent — a second pass finds nothing left to strip.
 */
export function stripFragmentDescendants(fragmentElement: HTMLElement): void {
    if (fragmentElement.querySelector('[data-portal-component-type="layout"]') != null) {
        fragmentElement.setAttribute(CONTAINS_LAYOUT_ATTR, 'true');
    }

    fragmentElement.querySelectorAll<HTMLElement>(`${COMPONENT_SELECTOR}, [data-portal-region]`).forEach(descendant => {
        if (descendant.getAttribute(ERROR_ATTR)) {
            fragmentElement.setAttribute(ERROR_ATTR, 'true');
        }

        // Embedded text loses its record along with the attribute, so the
        // registry-keyed preparation passes never see it — prepare it here,
        // before the identifying attribute is stripped.
        if (descendant.dataset.portalComponentType === 'text') {
            prepareTextComponent(descendant);
        }

        delete descendant.dataset.portalComponentType;
        delete descendant.dataset.portalRegion;
    });
}

/**
 * True when the element (a fragment) contains a layout descendant. Reads the
 * marker recorded by `stripFragmentDescendants`, falling back to a live scan
 * for a fragment that has not been stripped yet.
 */
export function elementContainsLayout(element: HTMLElement | undefined): boolean {
    if (!element) {
        return false;
    }

    return (
        element.getAttribute(CONTAINS_LAYOUT_ATTR) === 'true' ||
        element.querySelector('[data-portal-component-type="layout"]') != null
    );
}
