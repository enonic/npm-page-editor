import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {Box, Columns2, PenLine, Puzzle} from 'lucide-preact';

import type {Action} from '@enonic/lib-admin-ui/ui/Action';
import type {LucideIcon} from 'lucide-preact';
import type {JSX} from 'preact';

import {closeContextMenu} from '../../../stores/registry';

const INSERT_ICONS: Record<string, LucideIcon> = {
    part: Box,
    layout: Columns2,
    text: PenLine,
    fragment: Puzzle,
};

const sortActions = (actions: Action[]): Action[] =>
    [...actions].sort((left, right) => left.getSortOrder() - right.getSortOrder());

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

                return (
                    <UiContextMenu.Item
                        key={label}
                        disabled={!action.isEnabled()}
                        onSelect={() => {
                            action.execute();
                            closeContextMenu();
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
