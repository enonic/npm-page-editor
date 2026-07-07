import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {useEffect, useRef} from 'preact/hooks';

import type {JSX} from 'preact';

import {buildLockedPageMenuItems, buildMenuItems} from '../../../actions/menu-items';
import {getComponentName} from '../../../dom/component-name';
import {useStoreValue} from '../../../hooks/use-store-value';
import {$contextMenuState, $dragState, closeContextMenu, getRecord} from '../../../stores/registry';
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
    const contentRef = useRef<HTMLDivElement>(null);

    // ! Outside clicks land in the parent (Content Studio) and never reach
    // this iframe's document, so Radix's dismiss-on-outside never fires.
    // Mirror the same pointerdown semantics by listening on the parent's
    // document directly — reachable only in same-origin embedding; a
    // cross-origin parent throws on access, and its clicks can't be observed
    // at all. Tracking the real dismissal cause avoids false positives from
    // focus shifts caused by the parent's own reaction to the opening
    // SelectComponentEvent.
    const open = state != null;
    useEffect(() => {
        if (!open) return;

        let parentDoc: Document;
        try {
            parentDoc = window.parent.document;
        } catch {
            return;
        }
        if (parentDoc === document) return;

        const handlePointerDown = (): void => closeContextMenu();
        parentDoc.addEventListener('pointerdown', handlePointerDown);
        return () => parentDoc.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    if (dragState != null || state == null) return null;

    const items = state.kind === 'locked-page' ? buildLockedPageMenuItems() : buildMenuItems(state.path);
    if (items.length === 0) return null;

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

    // ! Re-key on bumpKey so each "Select parent" step remounts Content
    // and replays the Radix open animation, signalling a new menu.
    const contentKey = state.bumpKey ?? 0;

    return (
        <UiContextMenu open onOpenChange={handleOpenChange}>
            <PositionSetter key={contentKey} x={state.x} y={state.y} centerX={state.centerX} contentRef={contentRef} />
            <UiContextMenu.Portal container={portalContainer}>
                <UiContextMenu.Content
                    ref={contentRef}
                    key={contentKey}
                    className='pointer-events-auto z-50 max-w-60'
                    data-component={CONTEXT_MENU_NAME}
                    onPointerDown={stopPropagation}
                >
                    <MenuHeader kind={state.kind} type={record?.type} name={name} />
                    <ActionItems items={items} portalContainer={portalContainer} onPointerDown={stopPropagation} />
                </UiContextMenu.Content>
            </UiContextMenu.Portal>
        </UiContextMenu>
    );
};

ContextMenu.displayName = CONTEXT_MENU_NAME;
