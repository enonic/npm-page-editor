import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {PageViewController} from '@enonic/lib-contentstudio/page-editor/PageViewController';
import {DeselectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent';
import {EditTextComponentViewEvent} from '@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/EditTextComponentViewEvent';
import {SelectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {DragAndDrop} from '../../../DragAndDrop';
import {TEXT_COMPONENT_DBL_CLICK_TIMEOUT} from '../../../text/constants';
import {elementIndex} from '../../stores/element-index';
import {
    $dragState,
    $selectedPath,
    $textEditing,
    closeContextMenu,
    getRecord,
    openContextMenu,
    setSelectedPath,
} from '../../stores/registry';
import {deselectLegacyItemView, selectLegacyItemView} from '../../bridge';
import {getTrackedTarget, isOverlayChromeEvent, suppressNativeEvent} from '../common/click-guard';

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
    let pendingTextClickTimer: number | undefined;
    let pendingTextClickPath: string | undefined;
    let lastTextClickPath: string | undefined;
    let lastTextClickTs = 0;

    const clearPendingTextClick = () => {
        if (pendingTextClickTimer != null) {
            window.clearTimeout(pendingTextClickTimer);
            pendingTextClickTimer = undefined;
        }

        pendingTextClickPath = undefined;
    };

    const commitTextClick = (path: string, x: number, y: number) => {
        const current = $selectedPath.get();

        closeContextMenu();

        if (current === path) {
            remapSelection(undefined);
            new DeselectComponentEvent(ComponentPath.fromString(path)).fire();
            return;
        }

        remapSelection(path);
        fireSelect(path, x, y, false);
    };

    const enterTextEdit = (path: string, x: number, y: number) => {
        closeContextMenu();

        if ($selectedPath.get() !== path) {
            remapSelection(path);
            fireSelect(path, x, y, false);
        }

        new EditTextComponentViewEvent(ComponentPath.fromString(path)).fire();
    };

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
        const record = getRecord(path);

        if (target && path) {
            suppressNativeEvent(event);

            if (record?.type === 'text') {
                const now = Date.now();
                const clickX = event.pageX;
                const clickY = event.pageY;
                const isDoubleClick = lastTextClickPath === path &&
                    now - lastTextClickTs <= TEXT_COMPONENT_DBL_CLICK_TIMEOUT;

                if (isDoubleClick) {
                    clearPendingTextClick();
                    lastTextClickPath = undefined;
                    lastTextClickTs = 0;
                    enterTextEdit(path, clickX, clickY);
                    return;
                }

                clearPendingTextClick();
                lastTextClickPath = path;
                lastTextClickTs = now;
                pendingTextClickPath = path;
                pendingTextClickTimer = window.setTimeout(() => {
                    if (pendingTextClickPath === path) {
                        commitTextClick(path, clickX, clickY);
                    }

                    clearPendingTextClick();
                }, TEXT_COMPONENT_DBL_CLICK_TIMEOUT);
                return;
            }

            clearPendingTextClick();
            lastTextClickPath = undefined;
            lastTextClickTs = 0;
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

        clearPendingTextClick();
        lastTextClickPath = undefined;
        lastTextClickTs = 0;

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

        clearPendingTextClick();
        lastTextClickPath = undefined;
        lastTextClickTs = 0;

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
            x: event.clientX,
            y: event.clientY,
        });
        fireSelect(path, event.pageX, event.pageY, true);
    };

    document.addEventListener('click', handleClick, {capture: true});
    document.addEventListener('contextmenu', handleContextMenu, {capture: true});

    return () => {
        clearPendingTextClick();
        document.removeEventListener('click', handleClick, {capture: true});
        document.removeEventListener('contextmenu', handleContextMenu, {capture: true});
    };
}
