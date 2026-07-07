/**
 * Native DOM mutation engine: direct manipulation of the registry's element
 * references, followed by a reconcile so the records catch up.
 *
 * The protocol bus handlers in `bus-adapter.ts` drive every mutation here; the
 * post-mutation selection echoes also live there.
 */

import {ComponentPath, type InsertableComponentKind} from '../../protocol';
import {isBlank} from '../../util/string';
import {collectTrackedDescendants, isComponentElement} from '../parse/parse-page';
import {getRecord} from '../stores/registry';
import {resolvePreviewHtml} from '../text/preview-src';
import {prepareTextComponent} from '../text/text-component';
import {stripFragmentDescendants} from './fragment';

export {elementContainsLayout} from './fragment';

/**
 * Ordered tracked component elements directly inside a region's element, in the
 * same order `parseRegionSubtree` indexes them. Used to map a numeric child
 * index to an insertion reference.
 */
function getRegionComponentElements(regionElement: HTMLElement): HTMLElement[] {
    return collectTrackedDescendants(regionElement, isComponentElement);
}

/**
 * Creates the placeholder element for a freshly inserted component: a
 * `<div data-portal-component-type="<kind>">` with no content, so the
 * empty-state placeholder island renders until the host loads the real HTML.
 */
export function createComponentElement(kind: InsertableComponentKind): HTMLElement {
    const element = document.createElement('div');
    element.dataset.portalComponentType = kind;
    return element;
}

/**
 * Lifts a tracked element to the region's direct child that contains it, so an
 * insert anchored on it lands in the region's own markup rather than inside an
 * intermediate (server-rendered) wrapper. Returns the element unchanged when it
 * is already a direct region child.
 */
function regionChildAncestor(regionElement: HTMLElement, element: HTMLElement): HTMLElement {
    let current = element;
    while (current.parentElement && current.parentElement !== regionElement) {
        current = current.parentElement;
    }
    return current;
}

function insertAtIndex(regionElement: HTMLElement, element: HTMLElement, index: number): void {
    const siblings = getRegionComponentElements(regionElement).filter(sibling => sibling !== element);
    const reference = siblings[index];

    if (reference) {
        regionElement.insertBefore(element, regionChildAncestor(regionElement, reference));
        return;
    }

    // Append after the last tracked component's region-level ancestor so nested
    // wrapper/region markup is skipped; fall back to the region itself when empty.
    const last = siblings[siblings.length - 1];
    if (last) {
        const anchor = regionChildAncestor(regionElement, last);
        regionElement.insertBefore(element, anchor.nextSibling);
        return;
    }

    regionElement.appendChild(element);
}

/**
 * Inserts an empty typed component element at `path` inside its parent region.
 * Returns the inserted element (so the caller can select it).
 */
export function addComponentElement(path: ComponentPath, kind: InsertableComponentKind): HTMLElement | undefined {
    const parentPath = path.getParentPath();
    if (!parentPath) {
        return undefined;
    }

    const regionRecord = getRecord(parentPath.toString());
    const regionElement = regionRecord?.element;
    if (!regionElement) {
        return undefined;
    }

    const index = Number(path.getPath());
    const element = createComponentElement(kind);
    insertAtIndex(
        regionElement,
        element,
        Number.isNaN(index) ? getRegionComponentElements(regionElement).length : index,
    );

    return element;
}

export function removeComponentElement(path: string): void {
    getRecord(path)?.element?.remove();
}

/**
 * Moves a component element into the target region at the given index.
 */
export function moveComponentElement(fromPath: string, toPath: string): void {
    const toComponentPath = ComponentPath.fromString(toPath);
    const toParentPath = toComponentPath.getParentPath();
    if (!toParentPath) {
        return;
    }

    const sourceElement = getRecord(fromPath)?.element;
    const regionElement = getRecord(toParentPath.toString())?.element;
    if (!sourceElement || !regionElement) {
        return;
    }

    const toIndex = Number(toComponentPath.getPath());
    insertAtIndex(regionElement, sourceElement, Number.isNaN(toIndex) ? 0 : toIndex);
}

/**
 * Clones a component element as the next sibling and clears the clone's content
 * so it renders a loading/empty placeholder until the host drives the
 * follow-up `load-component`.
 */
export function duplicateComponentElement(sourcePath: string): HTMLElement | undefined {
    const source = getRecord(sourcePath)?.element;
    if (!source) {
        return undefined;
    }

    const clone = document.createElement(source.tagName.toLowerCase());
    const type = source.dataset.portalComponentType;
    if (type != null) {
        clone.dataset.portalComponentType = type;
    }

    source.parentElement?.insertBefore(clone, source.nextSibling);
    return clone;
}

/**
 * Empties a component back to a placeholder: removes the rendered children and
 * inner HTML, keeping the typed wrapper.
 */
export function resetComponentElement(path: string): void {
    const element = getRecord(path)?.element;
    if (!element) {
        return;
    }

    element.innerHTML = '';
    element.removeAttribute('data-portal-placeholder-error');
}

/**
 * Sets a text component's inner HTML to the incoming text, rewriting image
 * render URLs for preview.
 */
export function setTextComponentHtml(path: string, text: string): void {
    const element = getRecord(path)?.element;
    if (!element) {
        return;
    }

    element.innerHTML = resolvePreviewHtml(text);
}

/**
 * Replaces a component element's content with server-rendered HTML, preserving
 * the tracked wrapper and its identity. Returns `true` when the tracked element
 * was found.
 *
 * For fragments the descendant components' tracking attributes are stripped so
 * inner parts are not independently draggable.
 */
export function replaceComponentHtml(path: string, html: string): boolean {
    const element = getRecord(path)?.element;
    if (!element) {
        return false;
    }

    const type = element.dataset.portalComponentType;
    applyRenderedHtml(element, html);

    if (type === 'fragment') {
        stripFragmentDescendants(element);
    }

    // The portal re-render carries raw image render URLs and drops any text
    // direction; reapply both so the reloaded text matches the host's edits.
    if (type === 'text') {
        prepareTextComponent(element);
    }

    return true;
}

/**
 * Applies server-rendered single-component HTML to the tracked element.
 *
 * XP's portal renders a component (in edit mode) wrapped in its own
 * `data-portal-component-type` root element — the same element the editor
 * already tracks (e.g. `<aside data-portal-component-type="part">` for a real
 * part, `<div data-portal-component-type="part"></div>` for a reset one). A
 * plain `innerHTML` write would nest that duplicate wrapper inside the tracked
 * element, which both hides the empty-state placeholder (the wrapper is no
 * longer "empty") and breaks click hit-testing, since
 * `closest('[data-portal-component-type]')` then resolves to the untracked
 * inner wrapper. So the tracked node is kept (registry, element index and
 * geometry hold references to it) and the rendered wrapper's attributes and
 * children are adopted onto it instead. Falls back to a plain `innerHTML` write
 * when the payload is not a single same-type wrapper.
 */
function applyRenderedHtml(element: HTMLElement, html: string): void {
    const template = element.ownerDocument.createElement('template');
    template.innerHTML = html;

    const wrapper = extractRedundantWrapper(template.content, element.dataset.portalComponentType);
    if (!wrapper) {
        element.innerHTML = html;
        return;
    }

    syncElementAttributes(element, wrapper);
    element.replaceChildren(...Array.from(wrapper.childNodes));
}

/**
 * Returns the fragment's sole element child when it is a same-type
 * `data-portal-component-type` wrapper (a redundant duplicate of the tracked
 * element); `undefined` for any other shape, so the caller writes the HTML
 * verbatim. Whitespace and comment nodes around the root are ignored.
 */
function extractRedundantWrapper(fragment: DocumentFragment, type: string | undefined): HTMLElement | undefined {
    if (!type) {
        return undefined;
    }

    let wrapper: HTMLElement | undefined;
    for (const node of Array.from(fragment.childNodes)) {
        const blankText = node.nodeType === Node.TEXT_NODE && isBlank(node.textContent);
        if (blankText || node.nodeType === Node.COMMENT_NODE) {
            continue;
        }

        if (wrapper || !(node instanceof HTMLElement)) {
            return undefined;
        }

        wrapper = node;
    }

    return wrapper?.dataset.portalComponentType === type ? wrapper : undefined;
}

/** Adopts the freshly rendered root's attributes onto the tracked element. */
function syncElementAttributes(target: HTMLElement, source: HTMLElement): void {
    Array.from(target.attributes).forEach(attr => {
        if (!source.hasAttribute(attr.name)) {
            target.removeAttribute(attr.name);
        }
    });

    Array.from(source.attributes).forEach(attr => {
        target.setAttribute(attr.name, attr.value);
    });
}
