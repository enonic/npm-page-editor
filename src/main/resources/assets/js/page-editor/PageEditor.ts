/*global JQuery */
import 'jquery';
import 'jquery-ui/dist/jquery-ui.js';
import 'jquery-simulate/jquery.simulate.js';
import {StyleHelper} from '@enonic/lib-admin-ui/StyleHelper';
import {IframeEventBus} from '@enonic/lib-admin-ui/event/IframeEventBus';
import {LiveEditPage} from './LiveEditPage';
import {ItemViewPlaceholder} from './ItemViewPlaceholder';
import {type KeyBinding} from '@enonic/lib-admin-ui/ui/KeyBinding';
import {Store} from '@enonic/lib-admin-ui/store/Store';
import {KEY_BINDINGS_KEY} from '@enonic/lib-admin-ui/ui/KeyBindings';
import {IframeEvent} from '@enonic/lib-admin-ui/event/IframeEvent';
import {InitializeLiveEditEvent} from '@enonic/lib-contentstudio/page-editor/event/InitializeLiveEditEvent';
import {LiveEditParams} from '@enonic/lib-contentstudio/page-editor/LiveEditParams';
import {SkipLiveEditReloadConfirmationEvent} from '@enonic/lib-contentstudio/page-editor/event/SkipLiveEditReloadConfirmationEvent';
import {ChildOrder} from '@enonic/lib-contentstudio/app/resource/order/ChildOrder';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {ContentId} from '@enonic/lib-contentstudio/app/content/ContentId';
import {ContentName} from '@enonic/lib-contentstudio/app/content/ContentName';
import {ContentPath} from '@enonic/lib-contentstudio/app/content/ContentPath';
import {ContentSummary} from '@enonic/lib-contentstudio/app/content/ContentSummary';
import {ContentSummaryAndCompareStatus} from '@enonic/lib-contentstudio/app/content/ContentSummaryAndCompareStatus';
import {FragmentComponentType} from '@enonic/lib-contentstudio/app/page/region/FragmentComponentType';
import {IframeBeforeContentSavedEvent} from '@enonic/lib-contentstudio/app/event/IframeBeforeContentSavedEvent';
import {LayoutComponentType} from '@enonic/lib-contentstudio/app/page/region/LayoutComponentType';
import {PartComponentType} from '@enonic/lib-contentstudio/app/page/region/PartComponentType';
import {TextComponentType} from '@enonic/lib-contentstudio/app/page/region/TextComponentType';
import {Workflow} from '@enonic/lib-contentstudio/app/content/Workflow';
import {ContentTypeName} from '@enonic/lib-admin-ui/schema/content/ContentTypeName';
import {ApplicationKey} from '@enonic/lib-admin-ui/application/ApplicationKey';
import {PrincipalKey} from '@enonic/lib-admin-ui/security/PrincipalKey';
import {IdProviderKey} from '@enonic/lib-admin-ui/security/IdProviderKey';
import {FieldOrderExpr} from '@enonic/lib-admin-ui/query/expr/FieldOrderExpr';
import {AddComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/AddComponentViewEvent';
import {RemoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/RemoveComponentViewEvent';
import {PageStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/common/PageStateEvent';
import {SelectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/SelectComponentViewEvent';
import {DeselectComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/navigation/DeselectComponentViewEvent';
import {MoveComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/MoveComponentViewEvent';
import {LoadComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/LoadComponentViewEvent';
import {SetPageLockStateEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetPageLockStateEvent';
import {
    CreateOrDestroyDraggableEvent
} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/CreateOrDestroyDraggableEvent';
import {ResetComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/ResetComponentViewEvent';
import {UpdateTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/UpdateTextComponentViewEvent';
import {DuplicateComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/DuplicateComponentViewEvent';
import {MinimizeWizardPanelEvent} from '@enonic/lib-admin-ui/app/wizard/MinimizeWizardPanelEvent';
import {SetDraggableVisibleEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/SetDraggableVisibleEvent';

// ============================================================================
// Event Handlers
// ============================================================================

function shouldBubble(event: JQuery.TriggeredEvent): boolean {
    return (event.metaKey || event.ctrlKey || event.altKey) && !!event.keyCode;
}

function shouldBubbleEvent(event: JQuery.TriggeredEvent): boolean {
    switch (event.keyCode) {
    case 113:
        return true;
    default:
        return shouldBubble(event);
    }
}

function hasMatchingBinding(keys: KeyBinding[], event: JQuery.TriggeredEvent): boolean {
    const isMod = event.ctrlKey || event.metaKey;
    const isAlt = event.altKey;
    const eventKey = event.keyCode || event.which;

    for (const key of keys) {
        let matches = false;

        switch (key.getCombination()) {
        case 'backspace':
            matches = eventKey === 8;
            break;
        case 'del':
            matches = eventKey === 46;
            // eslint-disable-next-line no-fallthrough
        case 'mod+del':
            matches = matches && isMod;
            break;
        case 'mod+s':
            matches = eventKey === 83 && isMod;
            break;
        case 'mod+esc':
            matches = eventKey === 83 && isMod;
            break;
        case 'mod+alt+f4':
            matches = eventKey === 115 && isMod && isAlt;
            break;
        }

        if (matches) {
            return true;
        }
    }

    return false;
}

function stopBrowserShortcuts(event: JQuery.TriggeredEvent): void {
    const hasKeyBindings = Store.parentInstance().has(KEY_BINDINGS_KEY);
    const keyBindings = Store.parentInstance().get(KEY_BINDINGS_KEY);
    const activeBindings: KeyBinding[] = hasKeyBindings ? keyBindings.getActiveBindings() : [];

    const hasMatch = hasMatchingBinding(activeBindings, event);

    if (hasMatch) {
        event.preventDefault();
        console.log('Prevented default for event in live edit because it has binding in parent', event);
    }
}

function createDocumentKeyListener(): (event: JQuery.TriggeredEvent) => void {
    return (event: JQuery.TriggeredEvent) => {
        if (shouldBubbleEvent(event)) {
            stopBrowserShortcuts(event);

            const modifierEvent = new IframeEvent('editor-modifier-pressed').setData({
                type: event.type,
                config: {
                    bubbles: event.bubbles,
                    cancelable: event.cancelable,
                    ctrlKey: event.ctrlKey,
                    altKey: event.altKey,
                    shiftKey: event.shiftKey,
                    metaKey: event.metaKey,
                    keyCode: event.keyCode,
                    charCode: event.charCode
                }
            });
            IframeEventBus.get().fireEvent(modifierEvent);
        }
    };
}

function createWindowLoadListener(): () => void {
    return () => {
        IframeEventBus.get().fireEvent(new IframeEvent('editor-iframe-loaded'));
    };
}

// ============================================================================
// Initialization Helpers
// ============================================================================

function initializeEventBus(): void {
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
}

function initializeGlobalState(): void {
    Store.instance().set('$', $);
    StyleHelper.setCurrentPrefix(ItemViewPlaceholder.PAGE_EDITOR_PREFIX);
}

// ============================================================================
// PageEditor Class
// ============================================================================

export class PageEditor {
    private static liveEditPage: LiveEditPage | null = null;
    private static documentKeyListener: ((event: JQuery.TriggeredEvent) => void) | null = null;
    private static windowLoadListener: (() => void) | null = null;

    static init(): void {
        if (this.liveEditPage) {
            throw new Error('Page editor is already initialized.');
        }

        initializeEventBus();
        initializeGlobalState();

        this.initListeners();

        this.liveEditPage = new LiveEditPage();
    }


    private static initListeners(): void {
        if (!this.documentKeyListener) {
            this.documentKeyListener = createDocumentKeyListener();
        }
        if (!this.windowLoadListener) {
            this.windowLoadListener = createWindowLoadListener();
        }

        $(document).on('keypress keydown keyup', this.documentKeyListener);
        $(window).on('load', this.windowLoadListener);
    }
}
