import {StringHelper} from '@enonic/lib-admin-ui/util/StringHelper';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {PageViewController} from '@enonic/lib-contentstudio/page-editor/PageViewController';
import {ComponentViewDragCanceledEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragCanceledEvent';
import {ComponentViewDragDroppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragDroppedEvent';
import {ComponentViewDragStartedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStartedEvent';
import {ComponentViewDragStoppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStoppedEvent';
import {MoveComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/MoveComponentEvent';
import {DragAndDrop} from '../../page-editor/DragAndDrop';
import {
    deselectLegacyItemView,
    getLegacyItemViewLabel,
    legacyFragmentContainsLayout,
    resolveItemView,
    setLegacyItemViewMoving,
} from '../bridge';
import {DRAG_ANCHOR_ATTR, REGION_SELECTOR} from '../constants';
import {elementIndex} from '../stores/element-index';
import {
    $dragState,
    $textEditing,
    closeContextMenu,
    getRecord,
    setDragState,
    setHoveredPath,
    setSelectedPath,
} from '../stores/registry';
import type {ComponentRecord} from '../types';
import {getTrackedTarget, isOverlayChromeEvent} from './click-guard';

type Axis = 'x' | 'y';

const DRAG_START_DISTANCE = 8;

interface PendingComponentDrag {
    path: string;
    startX: number;
    startY: number;
}

interface ActiveComponentDrag {
    path: string;
    itemType: ComponentRecord['type'];
    itemLabel: string;
    sourceElement: HTMLElement;
    sourceDisplay: string;
    targetPath: string | undefined;
    targetIndex: number | undefined;
    dropAllowed: boolean;
    message: string | undefined;
    placeholderAnchor: HTMLElement | undefined;
    x: number;
    y: number;
}

function getElementsAtPoint(x: number, y: number): HTMLElement[] {
    if (typeof document.elementsFromPoint === 'function') {
        return document.elementsFromPoint(x, y).filter((value): value is HTMLElement => value instanceof HTMLElement);
    }

    const fallback = document.elementFromPoint?.(x, y);
    return fallback instanceof HTMLElement ? [fallback] : [];
}

function isComponentRecord(record: ComponentRecord | undefined): record is ComponentRecord {
    return !!record && record.type !== 'page' && record.type !== 'region';
}

function getDirectChildren(regionRecord: ComponentRecord, sourcePath?: string): ComponentRecord[] {
    return regionRecord.children
        .filter((path) => path !== sourcePath)
        .map((path) => getRecord(path))
        .filter((record): record is ComponentRecord => !!record?.element);
}

function inferAxis(regionElement: HTMLElement, childRecords: ComponentRecord[]): Axis {
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

    if (childRecords[0]?.element) {
        const rect = childRecords[0].element.getBoundingClientRect();
        return rect.width > rect.height ? 'x' : 'y';
    }

    return 'y';
}

function resolveHoveredChild(childRecords: ComponentRecord[], elements: HTMLElement[]): ComponentRecord | undefined {
    return childRecords.find((record) => {
        const element = record.element;

        return !!element && elements.some((value) => value === element || element.contains(value));
    });
}

function resolveInsertionIndex(
    regionRecord: ComponentRecord,
    elements: HTMLElement[],
    x: number,
    y: number,
    sourcePath: string,
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

function resolveTargetRegionPath(elements: HTMLElement[]): string | undefined {
    for (const element of elements) {
        const regionElement = element.matches(REGION_SELECTOR)
            ? element
            : element.closest(REGION_SELECTOR);
        if (!regionElement) {
            continue;
        }

        const path = elementIndex.get(regionElement as HTMLElement);
        if (getRecord(path)?.type === 'region') {
            return path;
        }
    }

    return undefined;
}

function ensurePlaceholderAnchor(
    current: HTMLElement | undefined,
    regionRecord: ComponentRecord,
    targetIndex: number,
    sourcePath: string,
): HTMLElement {
    const anchor = current ?? document.createElement('div');
    const regionElement = regionRecord.element as HTMLElement;
    const beforeElement = getDirectChildren(regionRecord, sourcePath)[targetIndex]?.element ?? null;

    anchor.setAttribute(DRAG_ANCHOR_ATTR, 'true');
    regionElement.insertBefore(anchor, beforeElement);

    return anchor;
}

function clearTarget(session: ActiveComponentDrag): void {
    session.targetPath = undefined;
    session.targetIndex = undefined;
    session.dropAllowed = false;
    session.message = undefined;
    session.placeholderAnchor?.remove();
    session.placeholderAnchor = undefined;
}

function publishState(session: ActiveComponentDrag): void {
    setDragState({
        itemType: session.itemType,
        itemLabel: session.itemLabel,
        sourcePath: session.path,
        targetPath: session.targetPath,
        dropAllowed: session.dropAllowed,
        message: session.message,
        placeholderElement: session.placeholderAnchor,
        x: session.x,
        y: session.y,
    });
}

function resolveDropTarget(session: ActiveComponentDrag): void {
    const elements = getElementsAtPoint(session.x, session.y);
    const targetPath = resolveTargetRegionPath(elements);

    if (!targetPath) {
        clearTarget(session);
        return;
    }

    const regionRecord = getRecord(targetPath);
    if (!regionRecord?.element) {
        clearTarget(session);
        return;
    }

    const targetIndex = resolveInsertionIndex(regionRecord, elements, session.x, session.y, session.path);
    const parentRecord = getRecord(regionRecord.parentPath);
    const nestedLayout = parentRecord?.type === 'layout' &&
        (session.itemType === 'layout' || (session.itemType === 'fragment' && legacyFragmentContainsLayout(session.path)));

    session.targetPath = targetPath;
    session.targetIndex = targetIndex;
    session.dropAllowed = !nestedLayout;
    session.message = nestedLayout ? i18n('notify.nestedLayouts') : undefined;
    session.placeholderAnchor = ensurePlaceholderAnchor(session.placeholderAnchor, regionRecord, targetIndex, session.path);
}

function restoreSource(session: ActiveComponentDrag): void {
    session.sourceElement.style.display = session.sourceDisplay;
    setLegacyItemViewMoving(session.path, false);
}

function fireDragStopped(path: string): void {
    new ComponentViewDragStoppedEvent(ComponentPath.fromString(path)).fire();
}

function fireDragCanceled(path: string): void {
    new ComponentViewDragCanceledEvent(resolveItemView(path) as never).fire();
}

export function initComponentDrag(): () => void {
    let pending: PendingComponentDrag | undefined;
    let active: ActiveComponentDrag | undefined;

    DragAndDrop.get().disableLegacySortables();

    const destroyActiveDrag = (canceled: boolean) => {
        if (!active) {
            setDragState(undefined);
            return;
        }

        const current = active;
        active = undefined;

        clearTarget(current);
        restoreSource(current);
        setDragState(undefined);

        if (canceled) {
            fireDragCanceled(current.path);
        }

        fireDragStopped(current.path);
    };

    const beginDrag = (path: string, x: number, y: number): void => {
        const record = getRecord(path);
        if (!isComponentRecord(record) || !record.element || !record.parentPath) {
            pending = undefined;
            return;
        }

        active = {
            path,
            itemType: record.type,
            itemLabel: getLegacyItemViewLabel(path) ?? StringHelper.capitalize(record.type),
            sourceElement: record.element,
            sourceDisplay: record.element.style.display,
            targetPath: undefined,
            targetIndex: undefined,
            dropAllowed: false,
            message: undefined,
            placeholderAnchor: undefined,
            x,
            y,
        };

        pending = undefined;
        setLegacyItemViewMoving(path, true);
        active.sourceElement.style.display = 'none';
        setHoveredPath(undefined);
        closeContextMenu();
        setSelectedPath(undefined);
        deselectLegacyItemView(path);
        new ComponentViewDragStartedEvent(ComponentPath.fromString(path)).fire();
        resolveDropTarget(active);
        publishState(active);
    };

    const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0 || isOverlayChromeEvent(event) || $textEditing.get() || $dragState.get()) {
            return;
        }

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;
        const record = getRecord(path);

        if (!target || !isComponentRecord(record) || target.classList.contains('not-draggable')) {
            pending = undefined;
            return;
        }

        pending = {
            path,
            startX: event.clientX,
            startY: event.clientY,
        };
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (active) {
            active.x = event.clientX;
            active.y = event.clientY;
            resolveDropTarget(active);
            publishState(active);
            return;
        }

        if (!pending) {
            return;
        }

        const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
        if (distance < DRAG_START_DISTANCE) {
            return;
        }

        beginDrag(pending.path, event.clientX, event.clientY);
    };

    const handleMouseUp = (event: MouseEvent) => {
        pending = undefined;

        if (!active) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const current = active;
        const sourcePath = ComponentPath.fromString(current.path);
        if (current.dropAllowed && current.targetPath && current.targetIndex != null) {
            const targetPath = new ComponentPath(current.targetIndex, ComponentPath.fromString(current.targetPath));
            destroyActiveDrag(false);
            new MoveComponentEvent(sourcePath, targetPath).fire();
            PageViewController.get().setNextClickDisabled(true);
            new ComponentViewDragDroppedEvent(sourcePath, targetPath).fire();
            return;
        }

        destroyActiveDrag(true);
    };

    const handleWindowBlur = () => {
        pending = undefined;

        if (active) {
            destroyActiveDrag(true);
        }
    };

    document.addEventListener('mousedown', handleMouseDown, {capture: true});
    document.addEventListener('mousemove', handleMouseMove, {capture: true, passive: true});
    document.addEventListener('mouseup', handleMouseUp, {capture: true});
    window.addEventListener('blur', handleWindowBlur);

    return () => {
        pending = undefined;
        if (active) {
            destroyActiveDrag(true);
        }
        document.removeEventListener('mousedown', handleMouseDown, {capture: true});
        document.removeEventListener('mousemove', handleMouseMove, {capture: true});
        document.removeEventListener('mouseup', handleMouseUp, {capture: true});
        window.removeEventListener('blur', handleWindowBlur);
        setDragState(undefined);
    };
}
