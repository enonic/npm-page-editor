import {ContextMenu as UiContextMenu} from '@enonic/ui';

import type {JSX} from 'preact';

import {useStoreValue} from '../../../hooks/use-store-value';
import {$contextMenuState, $dragState, closeContextMenu, getRecord} from '../../../stores/registry';
import {getActionsForPath, getComponentName, getLockedPageActions} from '../../../bridge';

import {ActionItems} from './ActionItems';
import {MenuHeader} from './MenuHeader';
import {PositionSetter} from './PositionSetter';

const CONTEXT_MENU_NAME = 'ContextMenu';

export type ContextMenuProps = {
    portalContainer?: HTMLElement;
};

export const ContextMenu = ({portalContainer}: ContextMenuProps): JSX.Element | null => {
    const state = useStoreValue($contextMenuState);
    const dragState = useStoreValue($dragState);

    if (dragState != null || state == null) return null;

    const actions = state.kind === 'locked-page' ? getLockedPageActions() : getActionsForPath(state.path);
    if (actions.length === 0) return null;

    const record = state.kind === 'component' ? getRecord(state.path) : undefined;
    const name = state.kind === 'component' ? getComponentName(state.path) : undefined;

    const handleOpenChange = (open: boolean): void => {
        if (!open) closeContextMenu();
    };

    // ! Stop pointerdown from crossing the shadow boundary.
    // The dismiss-on-outside listener runs on `document`, but `event.target`
    // retargets to the shadow host there — its `contains()` check misses the
    // menu and dismisses before the item's onSelect can fire.
    const stopPropagation = (event: Event): void => event.stopPropagation();

    return (
        <UiContextMenu open onOpenChange={handleOpenChange}>
            <PositionSetter x={state.x} y={state.y} />
            <UiContextMenu.Portal container={portalContainer}>
                <UiContextMenu.Content
                    className='pointer-events-auto z-50 max-w-60'
                    data-component={CONTEXT_MENU_NAME}
                    onPointerDown={stopPropagation}
                >
                    <MenuHeader kind={state.kind} type={record?.type} name={name} />
                    <ActionItems
                        actions={actions}
                        portalContainer={portalContainer}
                        onPointerDown={stopPropagation}
                    />
                </UiContextMenu.Content>
            </UiContextMenu.Portal>
        </UiContextMenu>
    );
};

ContextMenu.displayName = CONTEXT_MENU_NAME;
