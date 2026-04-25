import {StringHelper} from '@enonic/lib-admin-ui/util/StringHelper';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import {ComponentViewDragCanceledEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragCanceledEvent';
import {ComponentViewDragDroppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragDroppedEvent';
import {ComponentViewDragStartedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStartedEvent';
import {ComponentViewDragStoppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStoppedEvent';
import {CreateOrDestroyDraggableEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/CreateOrDestroyDraggableEvent';
import {SetDraggableVisibleEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetDraggableVisibleEvent';
import {AddComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/AddComponentEvent';
import {LayoutItemType} from '../../../layout/LayoutItemType';
import {FragmentItemType} from '../../../fragment/FragmentItemType';
import {PartItemType} from '../../../part/PartItemType';
import {TextItemType} from '../../../text/TextItemType';
import {FragmentComponentType} from '@enonic/lib-contentstudio/app/page/region/FragmentComponentType';
import {LayoutComponentType} from '@enonic/lib-contentstudio/app/page/region/LayoutComponentType';
import {PartComponentType} from '@enonic/lib-contentstudio/app/page/region/PartComponentType';
import {TextComponentType} from '@enonic/lib-contentstudio/app/page/region/TextComponentType';
import {closeContextMenu, getRecord, setDragState, setHoveredPath} from '../../stores/registry';
import {resolveTargetRegionPath} from '../common/drop-target';
import {
    clearTarget,
    ensurePlaceholderAnchor,
    getElementsAtPoint,
    resolveInsertionIndex,
} from './drop-positioning';

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

function getItemLabel(itemType: ItemType): string {
    return StringHelper.capitalize(i18n(`field.${itemType.getShortName()}`));
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
