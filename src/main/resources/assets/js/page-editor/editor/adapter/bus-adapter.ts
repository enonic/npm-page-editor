import {PageBuilder} from '@enonic/lib-contentstudio/app/page/Page';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';
import {AddComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/AddComponentViewEvent';
import {ComponentLoadedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentLoadedEvent';
import {DeselectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/DeselectComponentViewEvent';
import {DeselectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent';
import {DuplicateComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/DuplicateComponentViewEvent';
import {LoadComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/LoadComponentViewEvent';
import {MoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/MoveComponentViewEvent';
import {PageStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/common/PageStateEvent';
import {RemoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/RemoveComponentViewEvent';
import {ResetComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/ResetComponentViewEvent';
import {SelectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/SelectComponentViewEvent';
import {SelectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {SetComponentStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetComponentStateEvent';
import {SetModifyAllowedEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetModifyAllowedEvent';
import {SetPageLockStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetPageLockStateEvent';
import {UpdateTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/UpdateTextComponentViewEvent';
import type {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {PageView} from '../../PageView';
import {closeContextMenu, setLocked, setModifyAllowed, setSelectedPath} from '../stores/registry';
import {markLoading, reconcilePage, reconcileSubtree, remapInteractionPath} from './reconcile';

export function registerBusHandlers(pageView: PageView): () => void {
    const cleanup: Array<() => void> = [];
    const reconcile = () => reconcilePage(pageView);
    const reconcilePath = (path: ComponentPath | string | undefined) => {
        if (!path) {
            reconcile();
            return;
        }

        reconcileSubtree(pageView, typeof path === 'string' ? path : path.toString());
    };
    const reconcileParentPath = (path: ComponentPath | undefined) => {
        reconcilePath(path?.getParentPath());
    };

    // ! Outgoing SelectComponentEvent is echoed back to the iframe via the
    // IframeEventBus (the iframe is a receiver of its own postMessages), but
    // Content Studio's PageNavigationMediator skips LiveEditPageProxy.handle
    // when it is the source, so no matching SelectComponentViewEvent returns.
    // Legacy-originated selections (e.g. the "Select parent" action) are
    // invisible to the new UI unless we mirror the outgoing event ourselves.
    //
    // The same outgoing SelectComponentEvent also causes PageComponentsView to
    // call deselectAll on the tree, which echoes a stray DeselectComponentViewEvent
    // back. Armed here, consumed in onDeselect — without that, the context
    // menu would open and then immediately close.
    let swallowDeselectEcho = false;
    let swallowClearTimer: ReturnType<typeof setTimeout> | undefined;
    const clearSwallowTimer = () => {
        if (swallowClearTimer != null) {
            clearTimeout(swallowClearTimer);
            swallowClearTimer = undefined;
        }
    };
    const armSwallow = () => {
        swallowDeselectEcho = true;
        clearSwallowTimer();
        // ? Generous window — the echo round-trip (iframe → parent → iframe)
        //   is typically <20ms, but timer fires can slip under event-loop load.
        //   Legit user-triggered deselects within this window are rare.
        swallowClearTimer = setTimeout(() => {
            swallowDeselectEcho = false;
            swallowClearTimer = undefined;
        }, 100);
    };

    const onOutgoingSelect = (event: SelectComponentEvent) => {
        const path = event.getPath()?.toString();
        if (path) {
            setSelectedPath(path);
        }
        armSwallow();
    };
    SelectComponentEvent.on(onOutgoingSelect);
    cleanup.push(() => SelectComponentEvent.un(onOutgoingSelect));

    const onOutgoingDeselect = (_event: DeselectComponentEvent) => {
        setSelectedPath(undefined);
        closeContextMenu();
    };
    DeselectComponentEvent.on(onOutgoingDeselect);
    cleanup.push(() => DeselectComponentEvent.un(onOutgoingDeselect));

    const onSelect = (event: SelectComponentViewEvent) => {
        const path = event.getPath();
        if (!path) {
            return;
        }

        setSelectedPath(path);
    };
    SelectComponentViewEvent.on(onSelect);
    cleanup.push(() => SelectComponentViewEvent.un(onSelect));

    const onDeselect = (_event: DeselectComponentViewEvent) => {
        if (swallowDeselectEcho) {
            swallowDeselectEcho = false;
            clearSwallowTimer();
            return;
        }

        setSelectedPath(undefined);
        closeContextMenu();
    };
    DeselectComponentViewEvent.on(onDeselect);
    cleanup.push(() => DeselectComponentViewEvent.un(onDeselect));

    const onAdd = (event: AddComponentViewEvent) => reconcileParentPath(event.getComponentPath());
    AddComponentViewEvent.on(onAdd);
    cleanup.push(() => AddComponentViewEvent.un(onAdd));

    const onRemove = (event: RemoveComponentViewEvent) => reconcileParentPath(event.getComponentPath());
    RemoveComponentViewEvent.on(onRemove);
    cleanup.push(() => RemoveComponentViewEvent.un(onRemove));

    const onMove = (event: MoveComponentViewEvent) => {
        remapInteractionPath(event.getFrom().toString(), event.getTo().toString());

        const fromParent = event.getFrom().getParentPath()?.toString();
        const toParent = event.getTo().getParentPath()?.toString();
        if (!fromParent || fromParent === toParent) {
            reconcilePath(fromParent);
            return;
        }

        reconcilePath(fromParent);
        reconcilePath(toParent);
    };
    MoveComponentViewEvent.on(onMove);
    cleanup.push(() => MoveComponentViewEvent.un(onMove));

    const onLoad = (event: LoadComponentViewEvent) => {
        markLoading(event.getComponentPath().toString(), true);
    };
    LoadComponentViewEvent.on(onLoad);
    cleanup.push(() => LoadComponentViewEvent.un(onLoad));

    const onLoaded = (event: ComponentLoadedEvent) => {
        markLoading(event.getPath().toString(), false);
        reconcilePath(event.getPath());
    };
    ComponentLoadedEvent.on(onLoaded);
    cleanup.push(() => ComponentLoadedEvent.un(onLoaded));

    const onDuplicate = (event: DuplicateComponentViewEvent) => reconcileParentPath(event.getComponentPath());
    DuplicateComponentViewEvent.on(onDuplicate);
    cleanup.push(() => DuplicateComponentViewEvent.un(onDuplicate));

    const onReset = (event: ResetComponentViewEvent) => reconcilePath(event.getComponentPath());
    ResetComponentViewEvent.on(onReset);
    cleanup.push(() => ResetComponentViewEvent.un(onReset));

    const onLock = (event: SetPageLockStateEvent) => {
        setLocked(event.isToLock());
    };
    SetPageLockStateEvent.on(onLock);
    cleanup.push(() => SetPageLockStateEvent.un(onLock));

    const onModifyAllowed = (event: SetModifyAllowedEvent) => {
        setModifyAllowed(event.isModifyAllowed());

        if (!event.isModifyAllowed()) {
            setLocked(true);
        }
    };
    SetModifyAllowedEvent.on(onModifyAllowed);
    cleanup.push(() => SetModifyAllowedEvent.un(onModifyAllowed));

    const onPageState = (event: PageStateEvent) => {
        PageState.setState(event.getPageJson() ? new PageBuilder().fromJson(event.getPageJson()).build() : null);
        reconcile();
    };
    PageStateEvent.on(onPageState);
    cleanup.push(() => PageStateEvent.un(onPageState));

    const onTextUpdate = (_event: UpdateTextComponentViewEvent) => {
        window.queueMicrotask(() => reconcilePath(_event.getComponentPath()));
    };
    UpdateTextComponentViewEvent.on(onTextUpdate);
    cleanup.push(() => UpdateTextComponentViewEvent.un(onTextUpdate));

    const onComponentState = (event: SetComponentStateEvent) => {
        markLoading(event.getPath(), event.isProcessing());
    };
    SetComponentStateEvent.on(onComponentState);
    cleanup.push(() => SetComponentStateEvent.un(onComponentState));

    return () => {
        clearSwallowTimer();
        cleanup.forEach((fn) => fn());
    };
}
