import {elementIndex} from '../../stores/element-index';
import {
    $dragState,
    $selectedPath,
    closeContextMenu,
    getRecord,
    openContextMenu,
    setSelectedPath,
} from '../../stores/registry';
import {getBus} from '../../transport/bus';
import {dispatchComponentDeselected, dispatchComponentSelected} from '../../transport/dispatch';
import {getTrackedTarget, isOverlayChromeEvent, suppressNativeEvent} from '../common/click-guard';
import {isNextClickDisabled, setNextClickDisabled} from '../common/next-click';
import {TEXT_COMPONENT_DBL_CLICK_TIMEOUT} from './constants';

function remapSelection(path: string | undefined): void {
    setSelectedPath(path);
}

function fireSelect(path: string, x: number, y: number, rightClicked: boolean): void {
    dispatchComponentSelected(path, {x, y}, rightClicked);
}

function shouldIgnoreSelectionEvent(event: MouseEvent): boolean {
    if ($dragState.get()) {
        return true;
    }

    if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent && event.pointerType === 'touch') {
        return true;
    }

    if (isNextClickDisabled()) {
        setNextClickDisabled(false);
        return true;
    }

    return false;
}

export function initSelectionDetection(): () => void {
    let pendingTextClickTimer: number | undefined;
    let pendingTextClickPath: string | undefined;
    let lastTextClickPath: string | undefined;
    let lastTextClickTs = 0;

    const clearPendingTextClick = (): void => {
        if (pendingTextClickTimer != null) {
            window.clearTimeout(pendingTextClickTimer);
            pendingTextClickTimer = undefined;
        }

        pendingTextClickPath = undefined;
    };

    const commitTextClick = (path: string, x: number, y: number): void => {
        const current = $selectedPath.get();

        closeContextMenu();

        if (current === path) {
            remapSelection(undefined);
            dispatchComponentDeselected(path);
            return;
        }

        remapSelection(path);
        fireSelect(path, x, y, false);
    };

    const enterTextEdit = (path: string, x: number, y: number): void => {
        closeContextMenu();

        if ($selectedPath.get() !== path) {
            remapSelection(path);
            fireSelect(path, x, y, false);
        }

        getBus()?.post('text-edit-requested', {path});
    };

    const handleClick = (event: MouseEvent): void => {
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
                const isDoubleClick =
                    lastTextClickPath === path && now - lastTextClickTs <= TEXT_COMPONENT_DBL_CLICK_TIMEOUT;

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
                dispatchComponentDeselected(path);
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
            remapSelection(undefined);
            dispatchComponentDeselected(current);
        }
    };

    const handleContextMenu = (event: MouseEvent): void => {
        if ($dragState.get()) {
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
