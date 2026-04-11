import {IframeEvent} from '@enonic/lib-admin-ui/event/IframeEvent';
import {IframeEventBus} from '@enonic/lib-admin-ui/event/IframeEventBus';
import {Store} from '@enonic/lib-admin-ui/store/Store';
import {KEY_BINDINGS_KEY} from '@enonic/lib-admin-ui/ui/KeyBindings';
import type {KeyBinding} from '@enonic/lib-admin-ui/ui/KeyBinding';
import {$dragState, $textEditing} from '../stores/registry';

function shouldBubble(event: KeyboardEvent): boolean {
    return (event.metaKey || event.ctrlKey || event.altKey) && !!event.keyCode;
}

function shouldBubbleEvent(event: KeyboardEvent): boolean {
    return event.keyCode === 113 || shouldBubble(event);
}

function hasMatchingBinding(keys: KeyBinding[], event: KeyboardEvent): boolean {
    const isMod = event.ctrlKey || event.metaKey;
    const isAlt = event.altKey;
    const eventKey = event.keyCode || event.which;

    return keys.some((key) => {
        switch (key.getCombination()) {
        case 'backspace':
            return eventKey === 8;
        case 'del':
            return eventKey === 46;
        case 'mod+del':
            return eventKey === 46 && isMod;
        case 'mod+s':
            return eventKey === 83 && isMod;
        case 'mod+esc':
            return eventKey === 83 && isMod;
        case 'mod+alt+f4':
            return eventKey === 115 && isMod && isAlt;
        default:
            return false;
        }
    });
}

export function initKeyboardHandling(): () => void {
    const handleKeyEvent = (event: KeyboardEvent) => {
        if ($textEditing.get() || $dragState.get()) {
            return;
        }

        if (!shouldBubbleEvent(event)) {
            return;
        }

        const hasKeyBindings = Store.parentInstance().has(KEY_BINDINGS_KEY);
        const keyBindings = hasKeyBindings ? Store.parentInstance().get(KEY_BINDINGS_KEY) : undefined;
        const activeBindings: KeyBinding[] = keyBindings ? keyBindings.getActiveBindings() : [];
        if (!hasMatchingBinding(activeBindings, event)) {
            return;
        }

        event.preventDefault();

        IframeEventBus.get().fireEvent(new IframeEvent('editor-modifier-pressed').setData({
            type: event.type,
            config: {
                bubbles: event.bubbles,
                cancelable: event.cancelable,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey,
                keyCode: event.keyCode,
                charCode: event.charCode,
            },
        }));
    };

    document.addEventListener('keypress', handleKeyEvent);
    document.addEventListener('keydown', handleKeyEvent);
    document.addEventListener('keyup', handleKeyEvent);

    return () => {
        document.removeEventListener('keypress', handleKeyEvent);
        document.removeEventListener('keydown', handleKeyEvent);
        document.removeEventListener('keyup', handleKeyEvent);
    };
}
