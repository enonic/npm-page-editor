import {StyleHelper} from '@enonic/lib-admin-ui/StyleHelper';
import {MinimizeWizardPanelEvent} from '@enonic/lib-admin-ui/app/wizard/MinimizeWizardPanelEvent';
import {ApplicationKey} from '@enonic/lib-admin-ui/application/ApplicationKey';
import {Event} from '@enonic/lib-admin-ui/event/Event';
import {IframeEvent} from '@enonic/lib-admin-ui/event/IframeEvent';
import {IframeEventBus} from '@enonic/lib-admin-ui/event/IframeEventBus';
import {FieldOrderExpr} from '@enonic/lib-admin-ui/query/expr/FieldOrderExpr';
import {ContentTypeName} from '@enonic/lib-admin-ui/schema/content/ContentTypeName';
import {IdProviderKey} from '@enonic/lib-admin-ui/security/IdProviderKey';
import {PrincipalKey} from '@enonic/lib-admin-ui/security/PrincipalKey';
import {Store} from '@enonic/lib-admin-ui/store/Store';
import {UriHelper} from '@enonic/lib-admin-ui/util/UriHelper';
import {ContentId} from '@enonic/lib-contentstudio/app/content/ContentId';
import {ContentName} from '@enonic/lib-contentstudio/app/content/ContentName';
import {ContentPath} from '@enonic/lib-contentstudio/app/content/ContentPath';
import {ContentSummary} from '@enonic/lib-contentstudio/app/content/ContentSummary';
import {ContentSummaryAndCompareStatus} from '@enonic/lib-contentstudio/app/content/ContentSummaryAndCompareStatus';
import {Workflow} from '@enonic/lib-contentstudio/app/content/Workflow';
import {IframeBeforeContentSavedEvent} from '@enonic/lib-contentstudio/app/event/IframeBeforeContentSavedEvent';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {FragmentComponentType} from '@enonic/lib-contentstudio/app/page/region/FragmentComponentType';
import {LayoutComponentType} from '@enonic/lib-contentstudio/app/page/region/LayoutComponentType';
import {PartComponentType} from '@enonic/lib-contentstudio/app/page/region/PartComponentType';
import {TextComponentType} from '@enonic/lib-contentstudio/app/page/region/TextComponentType';
import {RenderingMode} from '@enonic/lib-contentstudio/app/rendering/RenderingMode';
import {ChildOrder} from '@enonic/lib-contentstudio/app/resource/order/ChildOrder';
import {ContentPreviewPathChangedEvent} from '@enonic/lib-contentstudio/app/view/ContentPreviewPathChangedEvent';
import {LiveEditParams} from '@enonic/lib-contentstudio/page-editor/LiveEditParams';
import {ComponentLoadedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentLoadedEvent';
import {InitializeLiveEditEvent} from '@enonic/lib-contentstudio/page-editor/event/InitializeLiveEditEvent';
import {SkipLiveEditReloadConfirmationEvent} from '@enonic/lib-contentstudio/page-editor/event/SkipLiveEditReloadConfirmationEvent';
import {PageStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/common/PageStateEvent';
import {AddComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/AddComponentViewEvent';
import {
    CreateOrDestroyDraggableEvent
} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/CreateOrDestroyDraggableEvent';
import {DuplicateComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/DuplicateComponentViewEvent';
import {LoadComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/LoadComponentViewEvent';
import {MoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/MoveComponentViewEvent';
import {RemoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/RemoveComponentViewEvent';
import {ResetComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/ResetComponentViewEvent';
import {SetDraggableVisibleEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetDraggableVisibleEvent';
import {SetPageLockStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetPageLockStateEvent';
import {UpdateTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/UpdateTextComponentViewEvent';
import {DeselectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/DeselectComponentViewEvent';
import {SelectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/SelectComponentViewEvent';
import {LoadComponentFailedEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/LoadComponentFailedEvent';
import {PageReloadRequestedEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/PageReloadRequestedEvent';
import 'jquery';
import 'jquery-ui/dist/jquery-ui.js';
import {LiveEditPage} from './LiveEditPage';
import {markComponentError, markComponentLoading, renderComponentHtml} from './componentRendering';
import {getRecord, getRegistry} from './editor/stores/registry';
import type {ComponentRecord} from './editor/types';
import {EditorEvent, EditorEvents} from './event/EditorEvent';

// ============================================================================
// Event Handlers
// ============================================================================

function createWindowLoadListener(): () => void {
    return () => {
        IframeEventBus.get().fireEvent(new IframeEvent('editor-iframe-loaded'));
    };
}

function createWindowClickListener(window: Window): (event: JQuery.ClickEvent) => void {
    return (event: JQuery.ClickEvent): void => {
        const clickedLink: string = getClickedLink(event);

        if (clickedLink) {
            if (!!window && !UriHelper.isNavigatingOutsideOfXP(clickedLink, window)) {
                const contentPreviewPath = '/' + UriHelper.trimUrlParams(
                    UriHelper.trimAnchor(UriHelper.trimWindowProtocolAndPortFromHref(clickedLink,
                        window)));

                if (!UriHelper.isNavigatingWithinSamePage(contentPreviewPath, window) &&
                    !UriHelper.isDownloadLink(contentPreviewPath)) {
                    new ContentPreviewPathChangedEvent(contentPreviewPath).fire();
                }
            }
        }
    }
}

function getClickedLink(event: JQuery.ClickEvent): string {
    const findPath = (a: HTMLLinkElement): string | undefined => {
        return a.dataset.contentPath || a.href;
    };

    if (event.target && (event.target as HTMLElement).tagName.toLowerCase() === 'a') {
        return findPath(event.target);
    }

    let el = event.target as HTMLElement;
    if (el) {
        while (el.parentNode) {
            el = el.parentNode as HTMLElement;
            if (el.tagName?.toLowerCase() === 'a') {
                return findPath(el as HTMLLinkElement);
            }
        }
    }
    return '';
}

// ============================================================================
// Initialization Helpers
// ============================================================================

function initializeEventBus(): IframeEventBus {
    const eventBus = IframeEventBus.get();

    eventBus.addReceiver(parent).setId('iframe-bus');

    eventBus.registerClass('ContentSummaryAndCompareStatus', ContentSummaryAndCompareStatus);
    eventBus.registerClass('ContentSummary', ContentSummary);
    eventBus.registerClass('ContentPath', ContentPath);
    eventBus.registerClass('ContentName', ContentName);
    eventBus.registerClass('ContentTypeName', ContentTypeName);
    eventBus.registerClass('ApplicationKey', ApplicationKey);
    eventBus.registerClass('PrincipalKey', PrincipalKey);
    eventBus.registerClass('IdProviderKey', IdProviderKey);
    eventBus.registerClass('ContentId', ContentId);
    eventBus.registerClass('ChildOrder', ChildOrder);
    eventBus.registerClass('FieldOrderExpr', FieldOrderExpr);
    eventBus.registerClass('Workflow', Workflow);
    eventBus.registerClass('ComponentPath', ComponentPath);
    eventBus.registerClass('PartComponentType', PartComponentType);
    eventBus.registerClass('LayoutComponentType', LayoutComponentType);
    eventBus.registerClass('FragmentComponentType', FragmentComponentType);

    eventBus.registerClass('AddComponentViewEvent', AddComponentViewEvent);
    eventBus.registerClass('MoveComponentViewEvent', MoveComponentViewEvent);
    eventBus.registerClass('RemoveComponentViewEvent', RemoveComponentViewEvent);
    eventBus.registerClass('SelectComponentViewEvent', SelectComponentViewEvent);
    eventBus.registerClass('DeselectComponentViewEvent', DeselectComponentViewEvent);
    eventBus.registerClass('DuplicateComponentViewEvent', DuplicateComponentViewEvent);
    eventBus.registerClass('LoadComponentViewEvent', LoadComponentViewEvent);
    eventBus.registerClass('ResetComponentViewEvent', ResetComponentViewEvent);
    eventBus.registerClass('UpdateTextComponentViewEvent', UpdateTextComponentViewEvent);

    eventBus.registerClass('SkipLiveEditReloadConfirmationEvent', SkipLiveEditReloadConfirmationEvent);
    eventBus.registerClass('LiveEditParams', LiveEditParams);
    eventBus.registerClass('InitializeLiveEditEvent', InitializeLiveEditEvent);
    eventBus.registerClass('PageStateEvent', PageStateEvent);
    eventBus.registerClass('SetPageLockStateEvent', SetPageLockStateEvent);
    eventBus.registerClass('IframeBeforeContentSavedEvent', IframeBeforeContentSavedEvent);
    eventBus.registerClass('CreateOrDestroyDraggableEvent', CreateOrDestroyDraggableEvent);
    eventBus.registerClass('SetDraggableVisibleEvent', SetDraggableVisibleEvent);
    eventBus.registerClass('TextComponentType', TextComponentType);
    eventBus.registerClass('MinimizeWizardPanelEvent', MinimizeWizardPanelEvent);

    return eventBus
}

function initializeGlobalState(): void {
    Store.instance().set('$', $);
    StyleHelper.setCurrentPrefix('xp-page-editor-');
}

// ============================================================================
// PageEditor Class
// ============================================================================

export class PageEditor {
    private static mode: RenderingMode;
    private static liveEditPage: LiveEditPage | null = null;
    private static iframeEventBus: IframeEventBus;
    private static windowClickListener: ((event: JQuery.ClickEvent) => void) | null = null;
    private static windowLoadListener: (() => void) | null = null;

    static isInitialized(): boolean {
        return !!this.mode;
    }

    static getContent(): ContentSummaryAndCompareStatus | undefined {
        return this.liveEditPage?.getContent();
    }

    static on(eventName: EditorEvents, handler: (event: EditorEvent) => void): void {
        Event.bind(eventName, handler);
    }

    static un(eventName: EditorEvents, handler: (event: EditorEvent) => void): void {
        Event.unbind(eventName, handler);
    }

    static renderLoadingComponent(path: ComponentPath): void {
        markComponentLoading(path);
        new EditorEvent(EditorEvents.ComponentLoadStarted, {path}).fire();
    }

    static renderComponent(path: ComponentPath, html: string): void {
        if (!renderComponentHtml(path, html)) {
            return;
        }
        this.iframeEventBus?.fireEvent(new ComponentLoadedEvent(path));
    }

    static renderErrorComponent(path: ComponentPath, reason: Error): void {
        console.warn(`PageEditor: component load at [${path.toString()}] failed:`, reason);
        markComponentError(path);
        this.iframeEventBus?.fireEvent(new LoadComponentFailedEvent(path, reason));
    }

    static reloadPage(): void {
        this.iframeEventBus?.fireEvent(new PageReloadRequestedEvent());
    }

    static getComponentAt(path: ComponentPath): ComponentRecord | undefined {
        return getRecord(path?.toString());
    }

    static getAllComponents(): readonly ComponentRecord[] {
        return Object.values(getRegistry());
    }

    static init(editMode: boolean): void {
        if (this.mode) {
            throw new Error(`Page editor is already initialized in "${this.mode}" mode.`);
        }
        this.mode = editMode ? RenderingMode.EDIT : RenderingMode.INLINE;

        initializeGlobalState();
        this.iframeEventBus = initializeEventBus();
        this.initListeners(editMode);

        if (editMode) {
            this.liveEditPage = new LiveEditPage();
        }
    }

    private static initListeners(editMode: boolean): void {
        if (!this.windowLoadListener && editMode) {
            this.windowLoadListener = createWindowLoadListener();
            $(window).on('load', this.windowLoadListener);
        }
        if (!this.windowClickListener) {
            this.windowClickListener = createWindowClickListener(window);
            $(window).on('click', this.windowClickListener)
        }
    }
}
