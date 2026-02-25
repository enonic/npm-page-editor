import {ObjectHelper} from '@enonic/lib-admin-ui/ObjectHelper';
import {Body} from '@enonic/lib-admin-ui/dom/Body';
import {Exception} from '@enonic/lib-admin-ui/Exception';
import {Tooltip} from '@enonic/lib-admin-ui/ui/Tooltip';
import {WindowDOM} from '@enonic/lib-admin-ui/dom/WindowDOM';
import {CONFIG} from '@enonic/lib-admin-ui/util/Config';
import {Messages} from '@enonic/lib-admin-ui/util/Messages';
import {AuthContext} from '@enonic/lib-admin-ui/auth/AuthContext';
import {Principal} from '@enonic/lib-admin-ui/security/Principal';
import {UriHelper} from '@enonic/lib-admin-ui/util/UriHelper';

import {type PageView, PageViewBuilder} from './PageView';
import {InitializeLiveEditEvent} from '@enonic/lib-contentstudio/page-editor/event/InitializeLiveEditEvent';
import {SkipLiveEditReloadConfirmationEvent} from '@enonic/lib-contentstudio/page-editor/event/SkipLiveEditReloadConfirmationEvent';
import {ComponentLoadedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentLoadedEvent';
import {ItemViewIdProducer} from './ItemViewIdProducer';
import {LiveEditPageInitializationErrorEvent} from '@enonic/lib-contentstudio/page-editor/event/LiveEditPageInitializationErrorEvent';
import {DragAndDrop} from './DragAndDrop';
import {LiveEditPageViewReadyEvent} from '@enonic/lib-contentstudio/page-editor/event/LiveEditPageViewReadyEvent';
import {Highlighter} from './Highlighter';
import {SelectedHighlighter} from './SelectedHighlighter';
import {Shader} from './Shader';
import {Cursor} from './Cursor';
import {ComponentViewDragStartedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStartedEvent';
import {ComponentViewDragStoppedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentViewDragStoppedEvent';
import {DefaultItemViewFactory} from './ItemViewFactory';
import {ItemViewContextMenuPosition} from './ItemViewContextMenuPosition';
import {SelectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/SelectComponentViewEvent';
import {type ItemView} from './ItemView';
import {DeselectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/DeselectComponentViewEvent';
import {TextComponentView} from './text/TextComponentView';
import {AddComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/AddComponentViewEvent';
import {RegionView} from './RegionView';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import {RemoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/RemoveComponentViewEvent';
import {ComponentView} from './ComponentView';
import {LoadComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/LoadComponentViewEvent';
import {DuplicateComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/DuplicateComponentViewEvent';
import {MoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/MoveComponentViewEvent';
import {SetPageLockStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetPageLockStateEvent';
import {SetModifyAllowedEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetModifyAllowedEvent';
import {
    CreateOrDestroyDraggableEvent
} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/CreateOrDestroyDraggableEvent';
import {SetDraggableVisibleEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetDraggableVisibleEvent';
import {ResetComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/ResetComponentViewEvent';
import {PageStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/common/PageStateEvent';
import {UpdateTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/UpdateTextComponentViewEvent';
import {SetComponentStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetComponentStateEvent';
import {LayoutItemType} from './layout/LayoutItemType';

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {ComponentType} from '@enonic/lib-contentstudio/app/page/region/ComponentType';
import {ContentContext} from '@enonic/lib-contentstudio/app/wizard/ContentContext';
import {IframeBeforeContentSavedEvent} from '@enonic/lib-contentstudio/app/event/IframeBeforeContentSavedEvent';
import {PageBuilder} from '@enonic/lib-contentstudio/app/page/Page';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';
import {Project} from '@enonic/lib-contentstudio/app/settings/data/project/Project';
import {ProjectContext} from '@enonic/lib-contentstudio/app/project/ProjectContext';
import {SessionStorageHelper} from '@enonic/lib-contentstudio/app/util/SessionStorageHelper';
import {EditorEvent, EditorEvents} from './event/EditorEvent';
import type {ContentSummaryAndCompareStatus} from '@enonic/lib-contentstudio/app/content/ContentSummaryAndCompareStatus';


export class LiveEditPage {

    private pageView: PageView;

    private skipNextReloadConfirmation: boolean = false;

    private initializeListener: (event: InitializeLiveEditEvent) => void;

    private skipConfirmationListener: (event: SkipLiveEditReloadConfirmationEvent) => void;

    private unloadListener: (event: UIEvent) => void;

    private componentLoadedListener: (event: ComponentLoadedEvent) => void;

    private dragStartedListener: () => void;

    private dragStoppedListener: () => void;

    private selectComponentRequestedListener: (event: SelectComponentViewEvent) => void;

    private deselectComponentRequestedListener: (event: DeselectComponentViewEvent) => void;

    private setComponentStateEventListener: (event: SetComponentStateEvent) => void;

    private addItemViewRequestListener: (event: AddComponentViewEvent) => void;

    private removeItemViewRequestListener: (event: RemoveComponentViewEvent) => void;

    private loadComponentRequestListener: (event: LoadComponentViewEvent) => void;

    private duplicateComponentViewRequestedListener: (event: DuplicateComponentViewEvent) => void;

    private moveComponentViewRequestedListener: (event: MoveComponentViewEvent) => void;

    private beforeContentSavedListener: () => void;

    private setPageLockStateListener: (event: SetPageLockStateEvent) => void;

    private setModifyAllowedListener: (event: SetModifyAllowedEvent) => void;

    private createOrDestroyDraggableListener: (event: CreateOrDestroyDraggableEvent) => void;

    private resetComponentViewRequestListener: (event: ResetComponentViewEvent) => void;

    private pageStateListener: (event: PageStateEvent) => void;

    private updateTextComponentViewListener: (event: UpdateTextComponentViewEvent) => void;

    private setDraggableVisibleEventListener: (event: SetDraggableVisibleEvent) => void;

    private static debug: boolean = false;

    private content: ContentSummaryAndCompareStatus;

    constructor() {
        this.skipConfirmationListener = (event: SkipLiveEditReloadConfirmationEvent) => {
            this.skipNextReloadConfirmation = event.isSkip();
        };

        SkipLiveEditReloadConfirmationEvent.on(this.skipConfirmationListener);

        this.initializeListener = this.init.bind(this);

        InitializeLiveEditEvent.on(this.initializeListener);
    }

    private init(event: InitializeLiveEditEvent): void {
        const startTime = Date.now();
        if (LiveEditPage.debug) {
            console.debug('LiveEditPage: starting live edit initialization', event);
        }

        this.content = event.getContent();

        // Setting up parent-like environment inside iframe
        UriHelper.setDomain(event.getHostDomain());

        CONFIG.setConfig(event.getConfig());
        Messages.addMessages(JSON.parse(CONFIG.getString('phrasesAsJson')) as object);
        AuthContext.init(Principal.fromJson(event.getUserJson()), event.getPrincipalsJson().map(Principal.fromJson));

        ProjectContext.get().setProject(Project.fromJson(event.getProjectJson()));
        PageState.setState(event.getPageJson() ? new PageBuilder().fromJson(event.getPageJson()).build() : null);

        ContentContext.get().setContent(event.getContent());


        const body = Body.get().loadExistingChildren();
        try {
            this.pageView = new PageViewBuilder()
                .setItemViewIdProducer(new ItemViewIdProducer())
                .setItemViewFactory(new DefaultItemViewFactory())
                .setLiveEditParams(event.getParams())
                .setElement(body).build();
        } catch (error) {
            if (LiveEditPage.debug) {
                console.error('LiveEditPage: error initializing live edit in ' + (Date.now() - startTime) + 'ms');
            }
            if (ObjectHelper.iFrameSafeInstanceOf(error, Exception)) {
                new LiveEditPageInitializationErrorEvent('The Live edit page could not be initialized. ' +
                                                         error.getMessage()).fire();
            } else {
                new LiveEditPageInitializationErrorEvent('The Live edit page could not be initialized. ' +
                                                         error).fire();
            }
            return;
        }

        DragAndDrop.init(this.pageView);

        Tooltip.allowMultipleInstances(false);

        this.registerGlobalListeners();

        this.restoreSelection(event.getParams().contentId);

        if (LiveEditPage.debug) {
            console.debug('LiveEditPage: done live edit initializing in ' + (Date.now() - startTime) + 'ms');
        }

        new LiveEditPageViewReadyEvent().fire();
    }

    private restoreSelection(contentId: string): void {
        const selectedItemViewPath: ComponentPath = SessionStorageHelper.getSelectedPathFromStorage(contentId);

        const selected: ItemView = selectedItemViewPath && this.pageView.getComponentViewByPath(selectedItemViewPath);

        if (selected) {
            selected.selectWithoutMenu();
            selected.scrollComponentIntoView();
        }
    }

    public getContent(): ContentSummaryAndCompareStatus | undefined {
        return this.content;
    }

    public destroy(win: Window = window): void {
        if (LiveEditPage.debug) {
            console.debug('LiveEditPage.destroy', win);
        }

        SkipLiveEditReloadConfirmationEvent.un(this.skipConfirmationListener, win);

        InitializeLiveEditEvent.un(this.initializeListener, win);

        this.unregisterGlobalListeners();
    }

    private registerGlobalListeners(): void {
        this.unloadListener = () => {
            if (!this.skipNextReloadConfirmation) {
                // do remove to trigger model unbinding
            } else {
                this.skipNextReloadConfirmation = false;
            }
            this.pageView.remove();
        };

        WindowDOM.get().onUnload(this.unloadListener);

        this.componentLoadedListener = (event: ComponentLoadedEvent) => {
            const componentView: ComponentView = this.getItemViewByPath(event.getPath()) as ComponentView;
            const componentType = componentView.getType();

            if (LayoutItemType.get().equals(componentType)) {
                DragAndDrop.get().createSortableLayout(componentView);
            } else {
                DragAndDrop.get().refreshSortable();
            }
        };

        ComponentLoadedEvent.on(this.componentLoadedListener);

        this.dragStartedListener = () => {
            Highlighter.get().hide();
            SelectedHighlighter.get().hide();
            Shader.get().hide();
            Cursor.get().hide();

            // dragging anything should exit the text edit mode
            //this.exitTextEditModeIfNeeded();
        };

        ComponentViewDragStartedEvent.on(this.dragStartedListener);

        this.dragStoppedListener = () => {
            Cursor.get().reset();

            if (this.pageView.isLocked()) {
                Highlighter.get().hide();
                Shader.get().shade(this.pageView);
            }
        };

        ComponentViewDragStoppedEvent.on(this.dragStoppedListener);

        this.selectComponentRequestedListener = (event: SelectComponentViewEvent): void => {
            if (!event.getPath()) {
                return;
            }

            const path: ComponentPath = ComponentPath.fromString(event.getPath());
            const itemView: ItemView = this.getItemViewByPath(path);

            if (itemView && !itemView.isSelected()) {
                itemView.select(null, ItemViewContextMenuPosition.NONE, event.isSilent());
                itemView.scrollComponentIntoView();
            }
        };

        SelectComponentViewEvent.on(this.selectComponentRequestedListener);

        this.deselectComponentRequestedListener = (event: DeselectComponentViewEvent): void => {
            const path: ComponentPath = event.getPath() ? ComponentPath.fromString(event.getPath()) : null;

            if (path) {
                const itemView = this.getItemViewByPath(path);

                if (itemView && !itemView.isSelected()) {
                    itemView.deselect(true);
                }
            } else {
                this.pageView.getSelectedView()?.deselect(true);
            }
        };

        DeselectComponentViewEvent.on(this.deselectComponentRequestedListener);

        this.setComponentStateEventListener = (event: SetComponentStateEvent): void => {
            const path: ComponentPath = event.getPath() ? ComponentPath.fromString(event.getPath()) : null;
            const itemView: ItemView = path ? this.getItemViewByPath(path) : null;

            if (itemView?.isText()) {
                if (event.isProcessing()) {
                    itemView.showLoadingSpinner();
                } else {
                    itemView.hideLoadingSpinner();
                }
            }
        };

        SetComponentStateEvent.on(this.setComponentStateEventListener);

        this.addItemViewRequestListener = (event: AddComponentViewEvent) => {
            const path: ComponentPath = event.getComponentPath();
            const type: ComponentType = ComponentType.byShortName(event.getComponentType().getShortName());
            const viewType: ItemType = ItemType.fromComponentType(type);
            const parentView: ItemView = this.getItemViewByPath(path.getParentPath());

            if (parentView) {
                parentView.addComponentView(parentView.createView(viewType), path.getPath() as number, true);
            }
        };

        AddComponentViewEvent.on(this.addItemViewRequestListener);

        this.removeItemViewRequestListener = (event: RemoveComponentViewEvent) => {
            const path: ComponentPath = event.getComponentPath();
            const view: ItemView = this.getItemViewByPath(path);

            if (view) {
                if (view.isSelected()) {
                    view.deselect(true);
                }

                view.remove();
            }
        };

        RemoveComponentViewEvent.on(this.removeItemViewRequestListener);

        this.loadComponentRequestListener = (event: LoadComponentViewEvent) => {
            const path: ComponentPath = event.getComponentPath();
            const view: ItemView = this.getItemViewByPath(path);

            if (!view) {
                return;
            }

            new EditorEvent(EditorEvents.ComponentLoadRequest, {
                view,
                isExisting: event.isExisting(),
            }).fire();
        };

        LoadComponentViewEvent.on(this.loadComponentRequestListener);

        this.duplicateComponentViewRequestedListener = (event: DuplicateComponentViewEvent) => {
            const newItemPath: ComponentPath = event.getComponentPath();
            const sourceItemPath: ComponentPath = new ComponentPath(newItemPath.getPath() as number - 1, newItemPath.getParentPath());
            const view: ItemView = this.getItemViewByPath(sourceItemPath);

            if (view instanceof ComponentView) {
                view.duplicate();
            }
        };

        DuplicateComponentViewEvent.on(this.duplicateComponentViewRequestedListener);

        this.moveComponentViewRequestedListener = (event: MoveComponentViewEvent) => {
            const from: ComponentPath = ComponentPath.fromString(event.getFrom().toString());
            const to: ComponentPath = ComponentPath.fromString(event.getTo().toString());

            const itemToMove: ItemView = this.getItemViewByPath(from);
            const regionViewTo: ItemView = this.getItemViewByPath(to.getParentPath());

            if (itemToMove instanceof ComponentView && regionViewTo instanceof RegionView) {
                itemToMove.moveToRegion(regionViewTo, to.getPath() as number);
            }
        };

        MoveComponentViewEvent.on(this.moveComponentViewRequestedListener);

        const contentId = this.pageView?.getLiveEditParams().contentId;

        this.beforeContentSavedListener = (): void => {
            SessionStorageHelper.removeSelectedPathInStorage(contentId);
            SessionStorageHelper.removeSelectedTextCursorPosInStorage(contentId);

            if (!this.pageView) {
                return;
            }

            const selected: ItemView = this.pageView.getSelectedView();

            if (selected instanceof ComponentView) {
                SessionStorageHelper.updateSelectedPathInStorage(contentId, selected.getPath());

            } else if (selected instanceof RegionView) {
                SessionStorageHelper.updateSelectedPathInStorage(contentId, selected.getPath());
            }
        };

        IframeBeforeContentSavedEvent.on(this.beforeContentSavedListener);

        this.setPageLockStateListener = (event: SetPageLockStateEvent): void => {
            this.pageView?.setLocked(event.isToLock());
        };

        SetPageLockStateEvent.on(this.setPageLockStateListener);

        this.setModifyAllowedListener = (event: SetModifyAllowedEvent): void => {
            this.pageView?.setModifyPermissions(event.isModifyAllowed());
        };

        SetModifyAllowedEvent.on(this.setModifyAllowedListener);

        this.createOrDestroyDraggableListener = (event: CreateOrDestroyDraggableEvent): void => {

            const idAttr = `drag-helper-${event.getType()}`;
            const dataAttr = `data-${ItemType.ATTRIBUTE_TYPE}="${event.getType()}"`;
            if (event.isCreate()) {
                const item = jQuery(`<div id="${idAttr}" ${dataAttr}}></div>`).appendTo(jQuery('body'));
                this.pageView?.createDraggable(item);
                item.simulate('mousedown').hide();
            } else {
                const item = jQuery(`div#${idAttr}[${dataAttr}]`);
                if (item.length === 0) {
                    return;
                }
                item.simulate('mouseup');
                this.pageView?.destroyDraggable(item);
                item.remove();
            }
        };

        CreateOrDestroyDraggableEvent.on(this.createOrDestroyDraggableListener);

        this.setDraggableVisibleEventListener = (event: SetDraggableVisibleEvent): void => {

            const idAttr = `drag-helper-${event.getType()}`;
            const dataAttr = `data-${ItemType.ATTRIBUTE_TYPE}="${event.getType()}"`;

            const item = jQuery(`div#${idAttr}[${dataAttr}]`);
            if (item.length === 0) {
                return;
            }

            jQuery(item.draggable('option', 'helper')()).toggle(event.isVisible());
        };

        SetDraggableVisibleEvent.on(this.setDraggableVisibleEventListener);

        this.resetComponentViewRequestListener = (event: ResetComponentViewEvent): void => {
            const path: ComponentPath = event.getComponentPath();
            const view: ItemView = this.getItemViewByPath(path);

            if (view instanceof ComponentView) {
                view.reset();
            }
        };

        ResetComponentViewEvent.on(this.resetComponentViewRequestListener);

        this.pageStateListener = (event: PageStateEvent): void => {
            PageState.setState(event.getPageJson() ? new PageBuilder().fromJson(event.getPageJson()).build() : null);
        };

        PageStateEvent.on(this.pageStateListener);

        this.updateTextComponentViewListener = (event: UpdateTextComponentViewEvent): void => {
            if (event.getOrigin() === 'live') {
                return;
            }

            const path: ComponentPath = event.getComponentPath();
            const view: ItemView = this.getItemViewByPath(path);

            if (view instanceof TextComponentView) {
                view.setText(event.getText());
            }
        };

        UpdateTextComponentViewEvent.on(this.updateTextComponentViewListener);
    }

    private getItemViewByPath(path: ComponentPath): ItemView {
        if (!path) {
            return;
        }

        return this.pageView?.getComponentViewByPath(path);
    }

    private unregisterGlobalListeners(): void {

        WindowDOM.get().unUnload(this.unloadListener);

        ComponentViewDragStartedEvent.un(this.dragStartedListener);

        ComponentViewDragStoppedEvent.un(this.dragStoppedListener);

        SelectComponentViewEvent.un(this.selectComponentRequestedListener);

        DeselectComponentViewEvent.un(this.deselectComponentRequestedListener);

        SetComponentStateEvent.un(this.setComponentStateEventListener);

        AddComponentViewEvent.un(this.addItemViewRequestListener);

        RemoveComponentViewEvent.un(this.removeItemViewRequestListener);

        LoadComponentViewEvent.un(this.loadComponentRequestListener);

        DuplicateComponentViewEvent.un(this.duplicateComponentViewRequestedListener);

        MoveComponentViewEvent.un(this.moveComponentViewRequestedListener);

        IframeBeforeContentSavedEvent.un(this.beforeContentSavedListener);

        SetPageLockStateEvent.un(this.setPageLockStateListener);

        SetModifyAllowedEvent.un(this.setModifyAllowedListener);

        CreateOrDestroyDraggableEvent.un(this.createOrDestroyDraggableListener);

        ResetComponentViewEvent.un(this.resetComponentViewRequestListener);

        PageStateEvent.un(this.pageStateListener);

        UpdateTextComponentViewEvent.un(this.updateTextComponentViewListener);
    }

    private getComponentErrorText(error) {
        if (!error || !error.message) {
            return '';
        }

        return new DOMParser().parseFromString(error.message, 'text/html').title ?? '';
    }
}
