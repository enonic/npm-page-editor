import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {PageViewController} from '@enonic/lib-contentstudio/page-editor/PageViewController';
import {DeselectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent';
import {SelectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {DragAndDrop} from '../../page-editor/DragAndDrop';
import {elementIndex} from '../stores/element-index';
import {
    $dragState,
    $selectedPath,
    $textEditing,
    closeContextMenu,
    openContextMenu,
    setSelectedPath,
} from '../stores/registry';
import {deselectLegacyItemView, selectLegacyItemView} from '../bridge';
import {getTrackedTarget, isOverlayChromeEvent, suppressNativeEvent} from './click-guard';

function remapSelection(path: string | undefined): void {
    const current = $selectedPath.get();
    if (current && current !== path) {
        deselectLegacyItemView(current);
    }

    setSelectedPath(path);

    if (path) {
        selectLegacyItemView(path);
    }
}

function fireSelect(path: string, x: number, y: number, rightClicked: boolean): void {
    new SelectComponentEvent({
        path: ComponentPath.fromString(path),
        position: {x, y},
        rightClicked,
    }).fire();
}

function shouldIgnoreSelectionEvent(event: MouseEvent): boolean {
    if ($textEditing.get() || $dragState.get()) {
        return true;
    }

    if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent && event.pointerType === 'touch') {
        return true;
    }

    if (DragAndDrop.get().isNewlyDropped()) {
        return true;
    }

    if (PageViewController.get().isNextClickDisabled()) {
        PageViewController.get().setNextClickDisabled(false);
        return true;
    }

    return false;
}

export function initSelectionDetection(): () => void {
    const handleClick = (event: MouseEvent) => {
        if (shouldIgnoreSelectionEvent(event)) {
            return;
        }

        if (isOverlayChromeEvent(event)) {
            return;
        }

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;
        const current = $selectedPath.get();

        if (target && path) {
            suppressNativeEvent(event);
            closeContextMenu();

            if (current === path) {
                remapSelection(undefined);
                new DeselectComponentEvent(ComponentPath.fromString(path)).fire();
                return;
            }

            remapSelection(path);
            fireSelect(path, event.pageX, event.pageY, false);
            return;
        }

        if (current) {
            closeContextMenu();
            remapSelection(undefined);
            new DeselectComponentEvent(ComponentPath.fromString(current)).fire();
        }
    };

    const handleContextMenu = (event: MouseEvent) => {
        if ($textEditing.get() || $dragState.get()) {
            return;
        }

        if (isOverlayChromeEvent(event)) {
            return;
        }

        const target = getTrackedTarget(event.target);
        const path = target ? elementIndex.get(target) : undefined;
        if (!target || !path) {
            return;
        }

        suppressNativeEvent(event);
        remapSelection(path);
        openContextMenu({
            kind: 'component',
            path,
            x: event.pageX,
            y: event.pageY,
        });
        fireSelect(path, event.pageX, event.pageY, true);
    };

    document.addEventListener('click', handleClick, {capture: true});
    document.addEventListener('contextmenu', handleContextMenu, {capture: true});

    return () => {
        document.removeEventListener('click', handleClick, {capture: true});
        document.removeEventListener('contextmenu', handleContextMenu, {capture: true});
    };
}
