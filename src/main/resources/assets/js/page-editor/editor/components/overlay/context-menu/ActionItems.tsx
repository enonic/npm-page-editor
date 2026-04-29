import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {SelectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {Box, Columns2, PenLine, Puzzle} from 'lucide-preact';

import type {Action} from '@enonic/lib-admin-ui/ui/Action';
import type {LucideIcon} from 'lucide-preact';
import type {JSX} from 'preact';

import {
    SELECT_PARENT_ACTION_CLASS,
    deselectLegacyItemView,
    focusLegacyItemViewInstant,
    getLegacyParentPath,
    selectLegacyItemView,
} from '../../../bridge';
import {
    $contextMenuState,
    closeContextMenu,
    openContextMenu,
    pulseSelectParent,
    setSelectedPath,
} from '../../../stores/registry';

const INSERT_ICONS: Record<string, LucideIcon> = {
    part: Box,
    layout: Columns2,
    text: PenLine,
    fragment: Puzzle,
};

const sortActions = (actions: Action[]): Action[] =>
    [...actions].sort((left, right) => left.getSortOrder() - right.getSortOrder());

const ANCHOR_TOP_GAP = 4;

const resolveIcon = (action: Action): LucideIcon | undefined => {
    const iconClass = action.getIconClass();
    if (!iconClass) return undefined;

    const match = /icon-(part|layout|text|fragment)\b/.exec(iconClass);
    return match ? INSERT_ICONS[match[1]] : undefined;
};

export type ActionItemsProps = {
    actions: Action[];
    portalContainer?: HTMLElement;
    onPointerDown?: (event: Event) => void;
};

export const ActionItems = ({actions, portalContainer, onPointerDown}: ActionItemsProps): JSX.Element => {
    const sorted = sortActions(actions);

    return (
        <>
            {sorted.map(action => {
                const label = action.getLabel();

                if (action.hasChildActions()) {
                    return (
                        <UiContextMenu.Sub key={label}>
                            <UiContextMenu.SubTrigger>{label}</UiContextMenu.SubTrigger>
                            <UiContextMenu.Portal container={portalContainer}>
                                <UiContextMenu.SubContent
                                    className='pointer-events-auto z-50'
                                    onPointerDown={onPointerDown}
                                >
                                    <ActionItems
                                        actions={action.getChildActions()}
                                        portalContainer={portalContainer}
                                        onPointerDown={onPointerDown}
                                    />
                                </UiContextMenu.SubContent>
                            </UiContextMenu.Portal>
                        </UiContextMenu.Sub>
                    );
                }

                const Icon = resolveIcon(action);

                const isSelectParent = action.getClass() === SELECT_PARENT_ACTION_CLASS;

                return (
                    <UiContextMenu.Item
                        key={label}
                        disabled={!action.isEnabled()}
                        onSelect={(event) => {
                            const previous = $contextMenuState.get();
                            const parentPath = isSelectParent && previous != null
                                ? getLegacyParentPath(previous.path)
                                : undefined;

                            if (!isSelectParent || previous == null || parentPath == null) {
                                action.execute();
                                closeContextMenu();
                                return;
                            }

                            // ! preventDefault stops Radix's auto-close after onSelect,
                            // so the menu stays mounted while we re-target it at the parent.
                            event.preventDefault();

                            // ? Bypass the legacy `selectItemView` flow — its outgoing
                            //   DeselectComponentEvent triggers closeContextMenu in the bus
                            //   adapter, fighting our reopen. Drive the transition silently
                            //   here and fire only the SelectComponentEvent that ContentStudio
                            //   needs (which already arms the deselect-echo swallow).
                            deselectLegacyItemView(previous.path);
                            selectLegacyItemView(parentPath);
                            setSelectedPath(parentPath);
                            new SelectComponentEvent({
                                path: ComponentPath.fromString(parentPath),
                                position: null,
                                rightClicked: true,
                            }).fire();

                            // Instant scroll brings the parent's top into view; anchor the
                            // menu horizontally on the parent's center, 4px below its top.
                            const rect = focusLegacyItemViewInstant(parentPath);
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
                                {label}
                            </span>
                        ) : (
                            label
                        )}
                    </UiContextMenu.Item>
                );
            })}
        </>
    );
};
