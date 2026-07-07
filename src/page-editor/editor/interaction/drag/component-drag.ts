import type {ComponentRecord} from '../../types';

import {capitalize} from '../../../util/string';
import {elementContainsLayout} from '../../dom/mutate';
import {i18n} from '../../i18n';
import {elementIndex} from '../../stores/element-index';
import {
    $dragState,
    closeContextMenu,
    getRecord,
    setDragState,
    setHoveredPath,
    setSelectedPath,
} from '../../stores/registry';
import {getBus} from '../../transport/bus';
import {getTrackedTarget, isOverlayChromeEvent} from '../common/click-guard';
import {resolveTargetRegionPath} from '../common/drop-target';
import {setNextClickDisabled} from '../common/next-click';
import {clearTarget, ensurePlaceholderAnchor, getElementsAtPoint, resolveInsertionIndex} from './drop-positioning';
import {createEdgeAutoScroll} from './edge-auto-scroll';

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

function isComponentRecord(record: ComponentRecord | undefined): record is ComponentRecord {
    return !!record && record.type !== 'page' && record.type !== 'region';
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
    const targetPath = resolveTargetRegionPath(elements, session.x, session.y);

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
    const fragmentHasLayout = session.itemType === 'fragment' && elementContainsLayout(session.sourceElement);
    const nestedLayout = parentRecord?.type === 'layout' && (session.itemType === 'layout' || fragmentHasLayout);

    session.targetPath = targetPath;
    session.targetIndex = targetIndex;
    session.dropAllowed = !nestedLayout;
    session.message = nestedLayout ? i18n('notify.nestedLayouts') : undefined;
    session.placeholderAnchor = ensurePlaceholderAnchor(
        session.placeholderAnchor,
        regionRecord,
        targetIndex,
        session.path,
    );
}

function restoreSource(session: ActiveComponentDrag): void {
    session.sourceElement.style.display = session.sourceDisplay;
}

function fireDragStopped(path: string): void {
    getBus()?.post('drag-stopped', {path});
}

function fireDragCanceled(path: string): void {
    getBus()?.post('drag-canceled', {path});
}

let activeDragSession: ActiveComponentDrag | undefined;
let stopEdgeScroll: (() => void) | undefined;

function destroyActiveDrag(canceled: boolean): void {
    stopEdgeScroll?.();

    if (!activeDragSession) {
        setDragState(undefined);
        return;
    }

    const current = activeDragSession;
    activeDragSession = undefined;

    clearTarget(current);
    restoreSource(current);
    setDragState(undefined);

    if (canceled) {
        fireDragCanceled(current.path);
    }

    fireDragStopped(current.path);
}

export function cancelActiveDrag(): void {
    if (activeDragSession) {
        destroyActiveDrag(true);
    }
}

export function initComponentDrag(): () => void {
    let pending: PendingComponentDrag | undefined;

    const recomputeDropTarget = (): void => {
        if (!activeDragSession) return;
        resolveDropTarget(activeDragSession);
        publishState(activeDragSession);
    };

    const edgeScroll = createEdgeAutoScroll({onScrolled: recomputeDropTarget});
    stopEdgeScroll = () => edgeScroll.stop();

    const beginDrag = (path: string, x: number, y: number): void => {
        const record = getRecord(path);
        if (!isComponentRecord(record) || !record.element || !record.parentPath) {
            pending = undefined;
            return;
        }

        activeDragSession = {
            path,
            itemType: record.type,
            itemLabel: capitalize(record.type),
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
        activeDragSession.sourceElement.style.display = 'none';
        setHoveredPath(undefined);
        closeContextMenu();
        setSelectedPath(undefined);
        getBus()?.post('drag-started', {path});
        resolveDropTarget(activeDragSession);
        publishState(activeDragSession);
    };

    const handleMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0 || isOverlayChromeEvent(event) || $dragState.get()) {
            return;
        }

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;
        const record = getRecord(path);

        if (!target || path == null || !isComponentRecord(record) || target.classList.contains('not-draggable')) {
            pending = undefined;
            return;
        }

        pending = {
            path,
            startX: event.clientX,
            startY: event.clientY,
        };

        event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent): void => {
        if (activeDragSession) {
            activeDragSession.x = event.clientX;
            activeDragSession.y = event.clientY;
            edgeScroll.update(event.clientX, event.clientY);
            resolveDropTarget(activeDragSession);
            publishState(activeDragSession);
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

    const handleMouseUp = (event: MouseEvent): void => {
        pending = undefined;

        if (!activeDragSession) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const current = activeDragSession;
        const sourcePath = current.path;
        if (current.dropAllowed && current.targetPath && current.targetIndex != null) {
            const targetPath = `${current.targetPath}/${current.targetIndex}`;
            destroyActiveDrag(false);
            getBus()?.post('move-component-requested', {from: sourcePath, to: targetPath});
            setNextClickDisabled(true);
            getBus()?.post('drag-dropped', {from: sourcePath, to: targetPath});
            return;
        }

        destroyActiveDrag(true);
    };

    const handleWindowBlur = (): void => {
        pending = undefined;
        cancelActiveDrag();
    };

    // ? Best-effort stop signal — `mouseleave` is unreliable across browsers
    // when the pointer crosses an iframe boundary, so we treat it as a hint, not a guarantee.
    const handleDocumentMouseLeave = (): void => {
        edgeScroll.stop();
    };

    const handleVisibilityChange = (): void => {
        if (document.hidden) {
            edgeScroll.stop();
        }
    };

    document.addEventListener('mousedown', handleMouseDown, {capture: true});
    document.addEventListener('mousemove', handleMouseMove, {capture: true, passive: true});
    document.addEventListener('mouseup', handleMouseUp, {capture: true});
    document.addEventListener('mouseleave', handleDocumentMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
        pending = undefined;
        cancelActiveDrag();
        edgeScroll.stop();
        stopEdgeScroll = undefined;
        document.removeEventListener('mousedown', handleMouseDown, {capture: true});
        document.removeEventListener('mousemove', handleMouseMove, {capture: true});
        document.removeEventListener('mouseup', handleMouseUp, {capture: true});
        document.removeEventListener('mouseleave', handleDocumentMouseLeave);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        setDragState(undefined);
    };
}
