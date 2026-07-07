import {isRemovableComponent} from '../../actions/menu-items';
import {$dragState, $locked, $modifyAllowed, $selectedPath, getRecord} from '../../stores/registry';
import {getBus} from '../../transport/bus';
import {dispatchComponentDeselected} from '../../transport/dispatch';
import {cancelActiveDrag} from '../drag/component-drag';

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
    getBus()?.post('keyboard-relay', {
        type: event.type,
        init: {
            bubbles: event.bubbles,
            cancelable: event.cancelable,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            key: event.key,
            code: event.code,
            keyCode: event.keyCode,
            charCode: event.charCode,
        },
    });
}

function removeSelectedComponent(path: string): void {
    if (!$modifyAllowed.get() || $locked.get()) return;
    if (!isRemovableComponent(getRecord(path))) return;

    getBus()?.post('remove-component-requested', {path});
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
                dispatchComponentDeselected(selectedPath);
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
