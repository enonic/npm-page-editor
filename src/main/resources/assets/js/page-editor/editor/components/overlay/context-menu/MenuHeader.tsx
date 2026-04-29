import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {Blocks, Box, Columns2, Globe, Lock, PenLine, Puzzle} from 'lucide-preact';

import type {LucideIcon} from 'lucide-preact';
import type {JSX} from 'preact';

import type {ComponentRecordType} from '../../../types';

const TYPE_ICONS: Partial<Record<ComponentRecordType, LucideIcon>> = {
    page: Globe,
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
    name?: string;
};

export const MenuHeader = ({kind, type, name}: MenuHeaderProps): JSX.Element | null => {
    if (kind === 'locked-page') {
        return (
            <UiContextMenu.Label className='flex w-full cursor-default items-center gap-2 py-2 font-bold'>
                <Lock className='size-4 shrink-0' strokeWidth={2} />
                <span className='min-w-0 flex-1 truncate'>Locked</span>
            </UiContextMenu.Label>
        );
    }

    if (type == null) return null;

    const Icon = TYPE_ICONS[type];
    if (Icon == null) return null;

    const label = type === 'page' ? i18n('field.page') : (name || capitalize(type));

    return (
        <UiContextMenu.Label className='flex w-full cursor-default items-center gap-2 py-2 font-bold'>
            <Icon className='size-4 shrink-0' strokeWidth={2} />
            <span className='min-w-0 flex-1 truncate'>{label}</span>
        </UiContextMenu.Label>
    );
};
