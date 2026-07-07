import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

import {ComponentPath} from '../../../protocol';
import {useStoreValue} from '../../hooks/use-store-value';
import {
    $contextMenuState,
    $dragState,
    $locked,
    $modifyAllowed,
    $selectedPath,
    closeContextMenu,
    openContextMenu,
} from '../../stores/registry';
import {dispatchComponentDeselected, dispatchComponentSelected} from '../../transport/dispatch';

const SHADER_NAME = 'Shader';

export const Shader = (): JSX.Element | null => {
    const locked = useStoreValue($locked);
    const dragState = useStoreValue($dragState);
    const modifyAllowed = useStoreValue($modifyAllowed);
    const selectedPath = useStoreValue($selectedPath);
    const contextMenuState = useStoreValue($contextMenuState);

    if (dragState || !locked) return null;

    const pagePath = ComponentPath.root().toString();
    const interacting = contextMenuState?.kind === 'locked-page' || selectedPath === pagePath;

    const toggleLockedMenu = (x: number, y: number): void => {
        if (contextMenuState?.kind === 'locked-page') {
            closeContextMenu();
            return;
        }

        openContextMenu({
            kind: 'locked-page',
            path: pagePath,
            x,
            y,
        });
    };

    const handleSelectionFallback = (x: number, y: number, rightClicked: boolean): void => {
        closeContextMenu();

        if (selectedPath !== pagePath || rightClicked) {
            dispatchComponentSelected(pagePath, {x, y}, rightClicked);
            return;
        }

        dispatchComponentDeselected(pagePath);
    };

    return (
        <div
            data-component={SHADER_NAME}
            className={cn('pointer-events-auto fixed inset-0 z-30', interacting && 'bg-black/50')}
            onPointerDown={event => {
                // ! Block the document-level outside-click dismiss in Radix's
                // ContextMenu. Otherwise Radix closes the menu on pointerdown
                // and the click below re-opens it at the new position, making
                // it impossible to dismiss by clicking the shader.
                event.stopPropagation();
            }}
            onClick={event => {
                event.preventDefault();
                event.stopPropagation();

                if (modifyAllowed) {
                    toggleLockedMenu(event.clientX, event.clientY);
                    return;
                }

                handleSelectionFallback(event.pageX, event.pageY, false);
            }}
            onContextMenu={event => {
                event.preventDefault();
                event.stopPropagation();

                if (modifyAllowed) {
                    toggleLockedMenu(event.clientX, event.clientY);
                    return;
                }

                handleSelectionFallback(event.pageX, event.pageY, true);
            }}
        />
    );
};

Shader.displayName = SHADER_NAME;
