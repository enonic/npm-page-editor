import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {Blocks, Box, Columns2, Lock, PenLine, Puzzle} from 'lucide-preact';

import type {LucideIcon} from 'lucide-preact';
import type {JSX} from 'preact';

import type {ComponentRecordType} from '../../../types';

const TYPE_ICONS: Partial<Record<ComponentRecordType, LucideIcon>> = {
    region: Blocks,
    text: PenLine,
    part: Box,
    layout: Columns2,
    fragment: Puzzle,
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export type MenuHeaderProps = {
    kind: 'component' | 'locked-page';
    type: ComponentRecordType | undefined;
};

export const MenuHeader = ({kind, type}: MenuHeaderProps): JSX.Element | null => {
    if (kind === 'locked-page') {
        return (
            <UiContextMenu.Label className='flex items-center gap-2 py-2 font-bold'>
                <Lock className='size-4' strokeWidth={2} />
                Locked
            </UiContextMenu.Label>
        );
    }

    if (type == null) return null;

    const Icon = TYPE_ICONS[type];
    if (Icon == null) return null;

    return (
        <UiContextMenu.Label className='flex items-center gap-2 py-2 font-bold'>
            <Icon className='size-4' strokeWidth={2} />
            {capitalize(type)}
        </UiContextMenu.Label>
    );
};
