import {ContextMenu as UiContextMenu} from '@enonic/ui';

import type {MenuItem} from '../../../actions/menu-items';
import type {JSX} from 'preact';

import {focusComponentInstant} from '../../../dom/scroll';
import {
    $contextMenuState,
    closeContextMenu,
    getRecord,
    openContextMenu,
    pulseSelectParent,
} from '../../../stores/registry';
import {dispatchComponentSelected} from '../../../transport/dispatch';
import {KIND_ICONS} from '../../kind-icons';

const ANCHOR_TOP_GAP = 4;

export type ActionItemsProps = {
    items: MenuItem[];
    portalContainer?: HTMLElement;
    onPointerDown?: (event: Event) => void;
};

export const ActionItems = ({items, portalContainer, onPointerDown}: ActionItemsProps): JSX.Element => {
    return (
        <>
            {items.map(item => {
                if (item.children != null) {
                    return (
                        <UiContextMenu.Sub key={item.id}>
                            <UiContextMenu.SubTrigger>{item.label}</UiContextMenu.SubTrigger>
                            <UiContextMenu.Portal container={portalContainer}>
                                <UiContextMenu.SubContent
                                    className='pointer-events-auto z-50'
                                    onPointerDown={onPointerDown}
                                >
                                    <ActionItems
                                        items={item.children}
                                        portalContainer={portalContainer}
                                        onPointerDown={onPointerDown}
                                    />
                                </UiContextMenu.SubContent>
                            </UiContextMenu.Portal>
                        </UiContextMenu.Sub>
                    );
                }

                const Icon = item.icon != null ? KIND_ICONS[item.icon] : undefined;

                const isSelectParent = item.id === 'select-parent';

                return (
                    <UiContextMenu.Item
                        key={item.id}
                        disabled={item.disabled === true}
                        onSelect={event => {
                            const previous = $contextMenuState.get();
                            const parentPath =
                                isSelectParent && previous != null ? getRecord(previous.path)?.parentPath : undefined;

                            if (!isSelectParent || previous == null || parentPath == null) {
                                item.run?.();
                                closeContextMenu();
                                return;
                            }

                            // ! preventDefault stops Radix's auto-close after onSelect,
                            // so the menu stays mounted while we re-target it at the parent.
                            event.preventDefault();

                            // ? Drive the transition silently here: post
                            //   `component-selected` (which mirrors the store) so Content
                            //   Studio retargets its panel without routing through the
                            //   normal select flow.
                            dispatchComponentSelected(parentPath, undefined, true);

                            // Instant scroll brings the parent's top into view; anchor the
                            // menu horizontally on the parent's center, 4px below its top.
                            const rect = focusComponentInstant(parentPath);
                            const anchorX = rect != null ? rect.left + rect.width / 2 : previous.x;
                            const anchorY = rect != null ? rect.top + ANCHOR_TOP_GAP : previous.y;

                            openContextMenu({
                                kind: 'component',
                                path: parentPath,
                                x: anchorX,
                                y: anchorY,
                                centerX: rect != null,
                                bumpKey: (previous.bumpKey ?? 0) + 1,
                            });

                            pulseSelectParent(parentPath);
                        }}
                    >
                        {Icon ? (
                            <span className='flex items-center gap-2'>
                                <Icon className='size-4' strokeWidth={1.5} />
                                {item.label}
                            </span>
                        ) : (
                            item.label
                        )}
                    </UiContextMenu.Item>
                );
            })}
        </>
    );
};
