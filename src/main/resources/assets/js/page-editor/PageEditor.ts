/*global JQuery */
import 'jquery'; // ensure jQuery is loaded, but use the global one
import "jquery-ui/dist/jquery-ui.js";
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

function initEventBus() {

// Initialize the live edit iframe event bus on this window
// to receive my own events(like LiveEditPageViewReadyEvent)
// and add the parent window as receiver too
    IframeEventBus.get().addReceiver(parent).setId('iframe-bus');

// Register events coming from CS here to be able to revive them in the iframe
    IframeEventBus.get().registerClass('ContentSummaryAndCompareStatus', ContentSummaryAndCompareStatus);
    IframeEventBus.get().registerClass('ContentSummary', ContentSummary);
    IframeEventBus.get().registerClass('ContentPath', ContentPath);
    IframeEventBus.get().registerClass('ContentName', ContentName);
    IframeEventBus.get().registerClass('ContentTypeName', ContentTypeName);
    IframeEventBus.get().registerClass('ApplicationKey', ApplicationKey);
    IframeEventBus.get().registerClass('PrincipalKey', PrincipalKey);
    IframeEventBus.get().registerClass('IdProviderKey', IdProviderKey);
    IframeEventBus.get().registerClass('ContentId', ContentId);
    IframeEventBus.get().registerClass('ChildOrder', ChildOrder);
    IframeEventBus.get().registerClass('FieldOrderExpr', FieldOrderExpr);
    IframeEventBus.get().registerClass('Workflow', Workflow);
    IframeEventBus.get().registerClass('ComponentPath', ComponentPath);
    IframeEventBus.get().registerClass('PartComponentType', PartComponentType);
    IframeEventBus.get().registerClass('LayoutComponentType', LayoutComponentType);
    IframeEventBus.get().registerClass('FragmentComponentType', FragmentComponentType);

    IframeEventBus.get().registerClass('AddComponentViewEvent', AddComponentViewEvent);
    IframeEventBus.get().registerClass('MoveComponentViewEvent', MoveComponentViewEvent);
    IframeEventBus.get().registerClass('RemoveComponentViewEvent', RemoveComponentViewEvent);
    IframeEventBus.get().registerClass('SelectComponentViewEvent', SelectComponentViewEvent);
    IframeEventBus.get().registerClass('DeselectComponentViewEvent', DeselectComponentViewEvent);
    IframeEventBus.get().registerClass('DuplicateComponentViewEvent', DuplicateComponentViewEvent);
    IframeEventBus.get().registerClass('LoadComponentViewEvent', LoadComponentViewEvent);
    IframeEventBus.get().registerClass('ResetComponentViewEvent', ResetComponentViewEvent);
    IframeEventBus.get().registerClass('UpdateTextComponentViewEvent', UpdateTextComponentViewEvent);

    IframeEventBus.get().registerClass('SkipLiveEditReloadConfirmationEvent', SkipLiveEditReloadConfirmationEvent);
    IframeEventBus.get().registerClass('LiveEditParams', LiveEditParams);
    IframeEventBus.get().registerClass('InitializeLiveEditEvent', InitializeLiveEditEvent);
    IframeEventBus.get().registerClass('PageStateEvent', PageStateEvent);
    IframeEventBus.get().registerClass('SetPageLockStateEvent', SetPageLockStateEvent);
    IframeEventBus.get().registerClass('IframeBeforeContentSavedEvent', IframeBeforeContentSavedEvent);
    IframeEventBus.get().registerClass('CreateOrDestroyDraggableEvent', CreateOrDestroyDraggableEvent);
    IframeEventBus.get().registerClass('SetDraggableVisibleEvent', SetDraggableVisibleEvent);
    IframeEventBus.get().registerClass('TextComponentType', TextComponentType);
    IframeEventBus.get().registerClass('MinimizeWizardPanelEvent', MinimizeWizardPanelEvent);
}

function initListeners() {

    Store.instance().set('$', $);
    /*
     Prefix must match @_CLS_PREFIX in assets\page-editor\styles\main.less
     */
    StyleHelper.setCurrentPrefix(ItemViewPlaceholder.PAGE_EDITOR_PREFIX);


    window.onload = function () {
        // ...send a message to the parent window.
        // The '*' is a wildcard, but for security, it's better to specify the parent's origin.
        // e.g., 'https://parent-domain.com'

        IframeEventBus.get().fireEvent(new IframeEvent('editor-iframe-loaded'))
    };

    // Notify parent frame if any modifier except shift is pressed
    // For the parent shortcuts to work if the inner iframe has focus
    $(document).on('keypress keydown keyup', (event: JQuery.TriggeredEvent) => {

        if (shouldBubbleEvent(event)) {

            stopBrowserShortcuts(event);

            // Cannot simulate events on parent document due to cross-origin restrictions
            // Use postMessage to notify parent about the modifier key event details

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
    });

    function shouldBubble(event: JQuery.TriggeredEvent): boolean {
        return (event.metaKey || event.ctrlKey || event.altKey) && !!event.keyCode;
    }

    function shouldBubbleEvent(event: JQuery.TriggeredEvent): boolean {
        switch (event.keyCode) {
        case 113:  // F2 global help shortcut
            return true;
        default:
            return shouldBubble(event);
        }
    }

    function stopBrowserShortcuts(event: JQuery.TriggeredEvent) {
        // get the parent's frame bindings
        const hasKeyBindings = Store.parentInstance().has(KEY_BINDINGS_KEY);
        const keyBindings = Store.parentInstance().get(KEY_BINDINGS_KEY);
        const activeBindings: KeyBinding[] = hasKeyBindings ? keyBindings.getActiveBindings() : [];

        const hasMatch = hasMatchingBinding(activeBindings, event);

        if (hasMatch) {
            event.preventDefault();
            console.log('Prevented default for event in live edit because it has binding in parent', event);
        }
    }

    function hasMatchingBinding(keys: KeyBinding[], event: JQuery.TriggeredEvent) {
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
}

export class PageEditor {

    private static liveEditPage: LiveEditPage;

    static init(): void {
        initEventBus();
        initListeners();
        PageEditor.liveEditPage = new LiveEditPage();
    }

}
