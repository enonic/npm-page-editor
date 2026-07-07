import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {Lock} from 'lucide-preact';

import type {ComponentRecordType} from '../../../types';
import type {JSX} from 'preact';

import {capitalize} from '../../../../util/string';
import {useI18n} from '../../../i18n';
import {getParams} from '../../../stores/params';
import {KIND_ICONS} from '../../kind-icons';

export type MenuHeaderProps = {
    kind: 'component' | 'locked-page';
    type: ComponentRecordType | undefined;
    name?: string;
};

export const MenuHeader = ({kind, type, name}: MenuHeaderProps): JSX.Element | null => {
    const t = useI18n();

    if (kind === 'locked-page') {
        return (
            <UiContextMenu.Label className='flex w-full cursor-default items-center gap-2 py-2 font-bold'>
                <Lock className='size-4 shrink-0' strokeWidth={2} />
                <span className='min-w-0 flex-1 truncate'>{t('live.view.page.locked')}</span>
            </UiContextMenu.Label>
        );
    }

    if (type == null) return null;

    const Icon = KIND_ICONS[type];
    if (Icon == null) return null;

    const label = type === 'page' ? getParams()?.displayName || t('field.page') : name || capitalize(type);

    return (
        <UiContextMenu.Label className='flex w-full cursor-default items-center gap-2 py-2 font-bold'>
            <Icon className='size-4 shrink-0' strokeWidth={2} />
            <span className='min-w-0 flex-1 truncate'>{label}</span>
        </UiContextMenu.Label>
    );
};
