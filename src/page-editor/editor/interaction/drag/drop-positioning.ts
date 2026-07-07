import type {ComponentRecord} from '../../types';

import {DRAG_ANCHOR_ATTR} from '../../constants';
import {getRecord} from '../../stores/registry';

export type Axis = 'x' | 'y';

export type DragTarget = {
    targetPath: string | undefined;
    targetIndex: number | undefined;
    dropAllowed: boolean;
    message: string | undefined;
    placeholderAnchor: HTMLElement | undefined;
};

export function getElementsAtPoint(x: number, y: number): HTMLElement[] {
    if (typeof document.elementsFromPoint === 'function') {
        return document.elementsFromPoint(x, y).filter((value): value is HTMLElement => value instanceof HTMLElement);
    }

    const fallback = document.elementFromPoint?.(x, y);
    return fallback instanceof HTMLElement ? [fallback] : [];
}

export function getDirectChildren(regionRecord: ComponentRecord, sourcePath?: string): ComponentRecord[] {
    return regionRecord.children
        .filter(path => path !== sourcePath)
        .map(path => getRecord(path))
        .filter((record): record is ComponentRecord => !!record?.element);
}

export function inferAxis(regionElement: HTMLElement, childRecords: ComponentRecord[]): Axis {
    const style = window.getComputedStyle(regionElement);

    if (style.display.includes('flex')) {
        return style.flexDirection.startsWith('row') ? 'x' : 'y';
    }

    if (childRecords.length >= 2) {
        const first = childRecords[0].element?.getBoundingClientRect();
        const second = childRecords[1].element?.getBoundingClientRect();
        if (first && second) {
            return Math.abs(second.left - first.left) > Math.abs(second.top - first.top) ? 'x' : 'y';
        }
    }

    if (style.display.includes('grid')) {
        return style.gridAutoFlow.startsWith('column') ? 'x' : 'y';
    }

    // ! A single child (e.g. the only sibling left after excluding the dragged
    //   source) gives no offset to compare, and its aspect ratio says nothing
    //   about flow direction — a full-width section is wide, yet the next
    //   sibling still lands below it. Only inline-level or floated children
    //   imply horizontal flow; everything else stacks vertically.
    const childElement = childRecords[0]?.element;
    if (childElement) {
        const childStyle = window.getComputedStyle(childElement);
        const floated = childStyle.cssFloat === 'left' || childStyle.cssFloat === 'right';
        if (floated || childStyle.display.startsWith('inline')) {
            return 'x';
        }
    }

    return 'y';
}

export function resolveHoveredChild(
    childRecords: ComponentRecord[],
    elements: HTMLElement[],
): ComponentRecord | undefined {
    return childRecords.find(record => {
        const element = record.element;

        return !!element && elements.some(value => value === element || element.contains(value));
    });
}

export function resolveInsertionIndex(
    regionRecord: ComponentRecord,
    elements: HTMLElement[],
    x: number,
    y: number,
    sourcePath?: string,
): number {
    const childRecords = getDirectChildren(regionRecord, sourcePath);
    if (childRecords.length === 0) {
        return 0;
    }

    const axis = inferAxis(regionRecord.element as HTMLElement, childRecords);
    const coordinate = axis === 'x' ? x : y;
    const hoveredChild = resolveHoveredChild(childRecords, elements);

    if (hoveredChild?.element) {
        const rect = hoveredChild.element.getBoundingClientRect();
        const midpoint = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        const hoveredIndex = childRecords.indexOf(hoveredChild);

        return hoveredIndex + (coordinate >= midpoint ? 1 : 0);
    }

    for (let index = 0; index < childRecords.length; index++) {
        const element = childRecords[index].element;
        if (!element) {
            continue;
        }

        const rect = element.getBoundingClientRect();
        const midpoint = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        if (coordinate < midpoint) {
            return index;
        }
    }

    return childRecords.length;
}

export function ensurePlaceholderAnchor(
    current: HTMLElement | undefined,
    regionRecord: ComponentRecord,
    targetIndex: number,
    sourcePath?: string,
): HTMLElement {
    const anchor = current ?? document.createElement('div');
    const regionElement = regionRecord.element as HTMLElement;
    const beforeElement = getDirectChildren(regionRecord, sourcePath)[targetIndex]?.element ?? null;

    anchor.setAttribute(DRAG_ANCHOR_ATTR, 'true');
    // ! Anchor is a light-DOM child of the edited region; neutralize the host
    //   page's child-spacing rules so the drag placeholder is not pushed off.
    anchor.style.setProperty('margin', '0', 'important');
    anchor.style.setProperty('padding', '0', 'important');
    // ! Tracked components are not always direct DOM children of their region —
    //   host markup may wrap them — so insert beside the component in its real
    //   parent; `regionElement.insertBefore` throws for wrapped children.
    const parentElement = beforeElement?.parentElement ?? regionElement;
    parentElement.insertBefore(anchor, beforeElement);

    return anchor;
}

export function clearTarget(session: DragTarget): void {
    session.targetPath = undefined;
    session.targetIndex = undefined;
    session.dropAllowed = false;
    session.message = undefined;
    session.placeholderAnchor?.remove();
    session.placeholderAnchor = undefined;
}
