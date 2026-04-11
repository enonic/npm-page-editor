import {TextEditModeChangedEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/TextEditModeChangedEvent';
import {PageViewController} from '@enonic/lib-contentstudio/page-editor/PageViewController';
import {closeContextMenu, setHoveredPath, setTextEditing} from '../stores/registry';

function applyTextEditingState(value: boolean): void {
    setTextEditing(value);

    if (value) {
        setHoveredPath(undefined);
        closeContextMenu();
    }
}

export function initTextEditingSync(): () => void {
    applyTextEditingState(PageViewController.get().isTextEditMode());

    const handleTextEditMode = (event: TextEditModeChangedEvent) => {
        applyTextEditingState(event.isEditMode());
    };

    TextEditModeChangedEvent.on(handleTextEditMode);

    return () => {
        TextEditModeChangedEvent.un(handleTextEditMode);
        applyTextEditingState(false);
    };
}
