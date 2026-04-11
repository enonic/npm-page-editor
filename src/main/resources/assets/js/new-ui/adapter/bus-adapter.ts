import {PageBuilder} from '@enonic/lib-contentstudio/app/page/Page';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';
import {AddComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/AddComponentViewEvent';
import {ComponentLoadedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentLoadedEvent';
import {DeselectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/DeselectComponentViewEvent';
import {DuplicateComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/DuplicateComponentViewEvent';
import {LoadComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/LoadComponentViewEvent';
import {MoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/MoveComponentViewEvent';
import {PageStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/common/PageStateEvent';
import {RemoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/RemoveComponentViewEvent';
import {ResetComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/ResetComponentViewEvent';
import {SelectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/SelectComponentViewEvent';
import {SetComponentStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetComponentStateEvent';
import {SetModifyAllowedEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetModifyAllowedEvent';
import {SetPageLockStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetPageLockStateEvent';
import {UpdateTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/UpdateTextComponentViewEvent';
import type {PageView} from '../../page-editor/PageView';
import {closeContextMenu, setLocked, setModifyAllowed, setSelectedPath} from '../stores/registry';
import {markLoading, reconcilePage, remapInteractionPath} from './reconcile';

export function registerBusHandlers(pageView: PageView): () => void {
    const cleanup: Array<() => void> = [];
    const reconcile = () => reconcilePage(pageView);

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
        setSelectedPath(undefined);
        closeContextMenu();
    };
    DeselectComponentViewEvent.on(onDeselect);
    cleanup.push(() => DeselectComponentViewEvent.un(onDeselect));

    const onAdd = (_event: AddComponentViewEvent) => reconcile();
    AddComponentViewEvent.on(onAdd);
    cleanup.push(() => AddComponentViewEvent.un(onAdd));

    const onRemove = (_event: RemoveComponentViewEvent) => reconcile();
    RemoveComponentViewEvent.on(onRemove);
    cleanup.push(() => RemoveComponentViewEvent.un(onRemove));

    const onMove = (event: MoveComponentViewEvent) => {
        remapInteractionPath(event.getFrom().toString(), event.getTo().toString());
        reconcile();
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
        reconcile();
    };
    ComponentLoadedEvent.on(onLoaded);
    cleanup.push(() => ComponentLoadedEvent.un(onLoaded));

    const onDuplicate = (_event: DuplicateComponentViewEvent) => reconcile();
    DuplicateComponentViewEvent.on(onDuplicate);
    cleanup.push(() => DuplicateComponentViewEvent.un(onDuplicate));

    const onReset = (_event: ResetComponentViewEvent) => reconcile();
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
        window.queueMicrotask(reconcile);
    };
    UpdateTextComponentViewEvent.on(onTextUpdate);
    cleanup.push(() => UpdateTextComponentViewEvent.un(onTextUpdate));

    const onComponentState = (event: SetComponentStateEvent) => {
        markLoading(event.getPath(), event.isProcessing());
    };
    SetComponentStateEvent.on(onComponentState);
    cleanup.push(() => SetComponentStateEvent.un(onComponentState));

    return () => cleanup.forEach((fn) => fn());
}
