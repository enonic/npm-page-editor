import type {EditorBus, InsertableComponentKind, InsertMenuKind} from '../../../protocol';

import {capitalize} from '../../../util/string';
import {i18n} from '../../i18n';
import {closeContextMenu, getRecord, setDragState, setHoveredPath} from '../../stores/registry';
import {getBus} from '../../transport/bus';
import {resolveTargetRegionPath} from '../common/drop-target';
import {clearTarget, ensurePlaceholderAnchor, getElementsAtPoint, resolveInsertionIndex} from './drop-positioning';
import {createEdgeAutoScroll} from './edge-auto-scroll';

const DRAGGABLE_KINDS: ReadonlySet<string> = new Set<InsertMenuKind>(['part', 'layout', 'text', 'fragment']);

interface ContextWindowDragSession {
    kind: InsertMenuKind;
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

function isDraggableKind(kind: string): kind is InsertMenuKind {
    return DRAGGABLE_KINDS.has(kind);
}

function getItemLabel(kind: InsertMenuKind): string {
    return capitalize(i18n(`field.${kind}`));
}

function publishState(session: ContextWindowDragSession): void {
    if (!session.visible) {
        setDragState(undefined);
        return;
    }

    setDragState({
        itemType: session.kind,
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
    const targetPath = resolveTargetRegionPath(elements, x, y);

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
    const nestedLayout = session.kind === 'layout' && parentRecord?.type === 'layout';

    session.targetPath = targetPath;
    session.targetIndex = targetIndex;
    session.dropAllowed = !nestedLayout;
    session.message = nestedLayout ? i18n('notify.nestedLayouts') : undefined;
    session.placeholderAnchor = ensurePlaceholderAnchor(session.placeholderAnchor, regionRecord, targetIndex);
}

// Context-window (insert panel) drags have no source component, so the source
// fields are sent empty.
function fireDragStopped(): void {
    getBus()?.post('drag-stopped', {path: ''});
}

function fireDragCanceled(): void {
    getBus()?.post('drag-canceled', {path: ''});
}

export function initContextWindowDrag(bus: EditorBus): () => void {
    let session: ContextWindowDragSession | undefined;

    const recomputeDropTarget = (): void => {
        if (!session?.visible || session.x == null || session.y == null) return;
        resolveDropTarget(session, session.x, session.y);
        publishState(session);
    };

    const edgeScroll = createEdgeAutoScroll({onScrolled: recomputeDropTarget});

    const resetVisibleState = (): void => {
        if (!session) {
            return;
        }

        clearTarget(session);
        publishState(session);
    };

    const destroySession = (canceled: boolean): void => {
        edgeScroll.stop();

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

    const handleCreateOrDestroy = (payload: {kind: InsertableComponentKind; create: boolean}): void => {
        if (payload.create) {
            destroySession(true);

            if (!isDraggableKind(payload.kind)) {
                return;
            }

            session = {
                kind: payload.kind,
                itemLabel: getItemLabel(payload.kind),
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
            getBus()?.post('drag-started', {path: ''});
            return;
        }

        if (!session || session.kind !== payload.kind) {
            return;
        }

        destroySession(true);
    };

    const handleVisible = (payload: {kind: InsertableComponentKind; visible: boolean}): void => {
        if (!session || session.kind !== payload.kind) {
            return;
        }

        session.visible = payload.visible;
        setHoveredPath(undefined);
        closeContextMenu();

        if (!session.visible) {
            edgeScroll.stop();
            resetVisibleState();
            return;
        }

        publishState(session);
    };

    const handleMouseMove = (event: MouseEvent): void => {
        if (!session?.visible) {
            return;
        }

        session.x = event.clientX;
        session.y = event.clientY;
        edgeScroll.update(event.clientX, event.clientY);
        resolveDropTarget(session, event.clientX, event.clientY);
        publishState(session);
    };

    const handleMouseUp = (event: MouseEvent): void => {
        if (!session?.visible) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (session.dropAllowed && session.targetPath && session.targetIndex != null) {
            const targetPath = `${session.targetPath}/${session.targetIndex}`;
            const kind = session.kind;
            getBus()?.post('add-component-requested', {path: targetPath, kind});
            getBus()?.post('drag-dropped', {from: '', to: targetPath});
            destroySession(false);
            return;
        }

        destroySession(true);
    };

    const handleDocumentMouseLeave = (): void => {
        edgeScroll.stop();
    };

    const handleVisibilityChange = (): void => {
        if (document.hidden) {
            edgeScroll.stop();
        }
    };

    const offCreate = bus.on('create-or-destroy-draggable', handleCreateOrDestroy);
    const offVisible = bus.on('set-draggable-visible', handleVisible);
    document.addEventListener('mousemove', handleMouseMove, {capture: true, passive: true});
    document.addEventListener('mouseup', handleMouseUp, {capture: true});
    document.addEventListener('mouseleave', handleDocumentMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        offCreate();
        offVisible();
        document.removeEventListener('mousemove', handleMouseMove, {capture: true});
        document.removeEventListener('mouseup', handleMouseUp, {capture: true});
        document.removeEventListener('mouseleave', handleDocumentMouseLeave);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        edgeScroll.stop();
        if (session) {
            clearTarget(session);
            session = undefined;
        }
        setDragState(undefined);
    };
}
