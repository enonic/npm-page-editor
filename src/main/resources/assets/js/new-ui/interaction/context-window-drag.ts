import {StringHelper} from '@enonic/lib-admin-ui/util/StringHelper';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {PageViewController} from '@enonic/lib-contentstudio/page-editor/PageViewController';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import {ComponentViewDragCanceledEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragCanceledEvent';
import {ComponentViewDragDroppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragDroppedEvent';
import {ComponentViewDragStartedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStartedEvent';
import {ComponentViewDragStoppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStoppedEvent';
import {CreateOrDestroyDraggableEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/CreateOrDestroyDraggableEvent';
import {SetDraggableVisibleEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetDraggableVisibleEvent';
import {AddComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/AddComponentEvent';
import {LayoutItemType} from '../../page-editor/layout/LayoutItemType';
import {FragmentItemType} from '../../page-editor/fragment/FragmentItemType';
import {PartItemType} from '../../page-editor/part/PartItemType';
import {TextItemType} from '../../page-editor/text/TextItemType';
import {FragmentComponentType} from '@enonic/lib-contentstudio/app/page/region/FragmentComponentType';
import {LayoutComponentType} from '@enonic/lib-contentstudio/app/page/region/LayoutComponentType';
import {PartComponentType} from '@enonic/lib-contentstudio/app/page/region/PartComponentType';
import {TextComponentType} from '@enonic/lib-contentstudio/app/page/region/TextComponentType';
import {DRAG_ANCHOR_ATTR, REGION_SELECTOR} from '../constants';
import {elementIndex} from '../stores/element-index';
import {closeContextMenu, getRecord, setDragState, setHoveredPath} from '../stores/registry';
import type {ComponentRecord} from '../types';

type Axis = 'x' | 'y';

interface ContextWindowDragSession {
    itemType: ItemType;
    itemLabel: string;
    visible: boolean;
    x: number | undefined;
    y: number | undefined;
    targetPath: string | undefined;
    targetIndex: number | undefined;
    dropAllowed: boolean;
    message: string | undefined;
    placeholderAnchor: HTMLElement | undefined;
}

function ensureDraggableItemTypesRegistered(): void {
    PartItemType.get();
    TextItemType.get();
    LayoutItemType.get();
    FragmentItemType.get();
    PartComponentType.get();
    TextComponentType.get();
    LayoutComponentType.get();
    FragmentComponentType.get();
}

function getElementsAtPoint(x: number, y: number): HTMLElement[] {
    if (typeof document.elementsFromPoint === 'function') {
        return document.elementsFromPoint(x, y).filter((value): value is HTMLElement => value instanceof HTMLElement);
    }

    const fallback = document.elementFromPoint?.(x, y);
    return fallback instanceof HTMLElement ? [fallback] : [];
}

function getItemLabel(itemType: ItemType): string {
    return StringHelper.capitalize(i18n(`field.${itemType.getShortName()}`));
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

function getDirectChildren(regionRecord: ComponentRecord): ComponentRecord[] {
    return regionRecord.children
        .map((path) => getRecord(path))
        .filter((record): record is ComponentRecord => !!record?.element);
}

function resolveHoveredChild(childRecords: ComponentRecord[], elements: HTMLElement[]): ComponentRecord | undefined {
    return childRecords.find((record) => {
        const element = record.element;

        return !!element && elements.some((value) => value === element || element.contains(value));
    });
}

function resolveInsertionIndex(regionRecord: ComponentRecord, elements: HTMLElement[], x: number, y: number): number {
    const childRecords = getDirectChildren(regionRecord);
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
): HTMLElement {
    const anchor = current ?? document.createElement('div');
    const regionElement = regionRecord.element as HTMLElement;
    const beforeElement = getDirectChildren(regionRecord)[targetIndex]?.element ?? null;

    anchor.setAttribute(DRAG_ANCHOR_ATTR, 'true');
    regionElement.insertBefore(anchor, beforeElement);

    return anchor;
}

function clearTarget(session: ContextWindowDragSession): void {
    session.targetPath = undefined;
    session.targetIndex = undefined;
    session.dropAllowed = false;
    session.message = undefined;
    session.placeholderAnchor?.remove();
    session.placeholderAnchor = undefined;
}

function publishState(session: ContextWindowDragSession): void {
    if (!session.visible) {
        setDragState(undefined);
        return;
    }

    setDragState({
        itemType: session.itemType.getShortName(),
        itemLabel: session.itemLabel,
        sourcePath: undefined,
        targetPath: session.targetPath,
        dropAllowed: session.dropAllowed,
        message: session.message,
        placeholderElement: session.placeholderAnchor,
        x: session.x,
        y: session.y,
    });
}

function resolveDropTarget(session: ContextWindowDragSession, x: number, y: number): void {
    const elements = getElementsAtPoint(x, y);
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

    const targetIndex = resolveInsertionIndex(regionRecord, elements, x, y);
    const parentRecord = getRecord(regionRecord.parentPath);
    const nestedLayout = LayoutItemType.get().equals(session.itemType) && parentRecord?.type === 'layout';

    session.targetPath = targetPath;
    session.targetIndex = targetIndex;
    session.dropAllowed = !nestedLayout;
    session.message = nestedLayout ? i18n('notify.nestedLayouts') : undefined;
    session.placeholderAnchor = ensurePlaceholderAnchor(session.placeholderAnchor, regionRecord, targetIndex);
}

function fireDragStopped(): void {
    new ComponentViewDragStoppedEvent(undefined as never).fire();
}

function fireDragCanceled(): void {
    new ComponentViewDragCanceledEvent(undefined as never).fire();
}

export function initContextWindowDrag(): () => void {
    let session: ContextWindowDragSession | undefined;

    const resetVisibleState = () => {
        if (!session) {
            return;
        }

        clearTarget(session);
        publishState(session);
    };

    const destroySession = (canceled: boolean) => {
        if (!session) {
            return;
        }

        clearTarget(session);
        setDragState(undefined);

        if (canceled) {
            fireDragCanceled();
        }

        fireDragStopped();
        session = undefined;
    };

    const handleCreateOrDestroy = (event: CreateOrDestroyDraggableEvent) => {
        if (event.isCreate()) {
            destroySession(true);
            ensureDraggableItemTypesRegistered();

            const itemType = ItemType.byShortName(event.getType());
            if (!itemType?.isComponentType()) {
                return;
            }

            session = {
                itemType,
                itemLabel: getItemLabel(itemType),
                visible: false,
                x: undefined,
                y: undefined,
                targetPath: undefined,
                targetIndex: undefined,
                dropAllowed: false,
                message: undefined,
                placeholderAnchor: undefined,
            };

            setHoveredPath(undefined);
            closeContextMenu();
            new ComponentViewDragStartedEvent(undefined as never).fire();
            return;
        }

        if (!session || session.itemType.getShortName() !== event.getType()) {
            return;
        }

        destroySession(true);
    };

    const handleVisible = (event: SetDraggableVisibleEvent) => {
        if (!session || session.itemType.getShortName() !== event.getType()) {
            return;
        }

        session.visible = event.isVisible();
        setHoveredPath(undefined);
        closeContextMenu();

        if (!session.visible) {
            resetVisibleState();
            return;
        }

        publishState(session);
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (!session?.visible) {
            return;
        }

        session.x = event.clientX;
        session.y = event.clientY;
        resolveDropTarget(session, event.clientX, event.clientY);
        publishState(session);
    };

    const handleMouseUp = (event: MouseEvent) => {
        if (!session?.visible) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (session.dropAllowed && session.targetPath && session.targetIndex != null) {
            const targetPath = new ComponentPath(session.targetIndex, ComponentPath.fromString(session.targetPath));
            new AddComponentEvent(targetPath, session.itemType.toComponentType()).fire();
            PageViewController.get().setNextClickDisabled(true);
            new ComponentViewDragDroppedEvent(undefined as never, targetPath).fire();
            destroySession(false);
            return;
        }

        destroySession(true);
    };

    CreateOrDestroyDraggableEvent.on(handleCreateOrDestroy);
    SetDraggableVisibleEvent.on(handleVisible);
    document.addEventListener('mousemove', handleMouseMove, {capture: true, passive: true});
    document.addEventListener('mouseup', handleMouseUp, {capture: true});

    return () => {
        CreateOrDestroyDraggableEvent.un(handleCreateOrDestroy);
        SetDraggableVisibleEvent.un(handleVisible);
        document.removeEventListener('mousemove', handleMouseMove, {capture: true});
        document.removeEventListener('mouseup', handleMouseUp, {capture: true});
        if (session) {
            clearTarget(session);
            session = undefined;
        }
        setDragState(undefined);
    };
}
