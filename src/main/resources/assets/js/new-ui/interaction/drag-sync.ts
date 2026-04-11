import {DragAndDrop, type LegacyDragState} from '../../page-editor/DragAndDrop';
import {
    $dragState,
    closeContextMenu,
    setDragState,
    setHoveredPath,
} from '../stores/registry';

function applyDragState(state: LegacyDragState | undefined): void {
    if (!state) {
        setDragState(undefined);
        return;
    }

    const current = $dragState.get();

    setDragState({
        ...state,
        x: current?.x,
        y: current?.y,
    });
    setHoveredPath(undefined);
    closeContextMenu();
}

export function initDragSync(): () => void {
    const dragAndDrop = DragAndDrop.get();
    const handleStateChange = (state: LegacyDragState | undefined) => {
        applyDragState(state);
    };
    const handleMouseMove = (event: MouseEvent) => {
        const current = $dragState.get();
        if (!current) {
            return;
        }

        setDragState({
            ...current,
            x: event.clientX,
            y: event.clientY,
        });
    };

    applyDragState(dragAndDrop.getState());
    dragAndDrop.onStateChanged(handleStateChange);
    document.addEventListener('mousemove', handleMouseMove, {capture: true, passive: true});

    return () => {
        dragAndDrop.unStateChanged(handleStateChange);
        document.removeEventListener('mousemove', handleMouseMove, {capture: true});
        setDragState(undefined);
    };
}
