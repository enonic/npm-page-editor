import {IframeEvent} from '@enonic/lib-admin-ui/event/IframeEvent';
import {IframeEventBus} from '@enonic/lib-admin-ui/event/IframeEventBus';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {RemoveComponentRequest} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/RemoveComponentRequest';
import {
    $dragState,
    $locked,
    $modifyAllowed,
    $selectedPath,
    setSelectedPath,
} from '../../stores/registry';
import {cancelActiveDrag} from '../drag/component-drag';

const RELAY_EVENT_NAME = 'editor-modifier-pressed';

function isPrintableChar(event: KeyboardEvent): boolean {
    return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function hasModifier(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey || event.altKey;
}

function shouldRelay(event: KeyboardEvent): boolean {
    return hasModifier(event) || event.key === 'F2';
}

function relayToParent(event: KeyboardEvent): void {
    const relayed = new IframeEvent(RELAY_EVENT_NAME).setData({
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
    });

    IframeEventBus.get().fireEvent(relayed);
}

function removeSelectedComponent(path: string): void {
    if (!$modifyAllowed.get() || $locked.get()) return;

    new RemoveComponentRequest(ComponentPath.fromString(path)).fire();
}

export function initKeyboardHandling(): () => void {
    const handleKeyDown = (event: KeyboardEvent): void => {
        if ($dragState.get()) {
            if (event.key === 'Escape') {
                cancelActiveDrag();
                event.preventDefault();
            }
            return;
        }

        const selectedPath = $selectedPath.get();
        if (selectedPath) {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                removeSelectedComponent(selectedPath);
                event.preventDefault();
                return;
            }

            if (event.key === 'Escape') {
                setSelectedPath(undefined);
                event.preventDefault();
                return;
            }
        }

        if (isPrintableChar(event)) return;
        if (!shouldRelay(event)) return;

        relayToParent(event);

        if (hasModifier(event)) {
            event.preventDefault();
        }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
}
