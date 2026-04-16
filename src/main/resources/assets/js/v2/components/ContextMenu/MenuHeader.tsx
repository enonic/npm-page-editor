import {ContextMenu as UiContextMenu} from '@enonic/ui';
import {Lock} from 'lucide-preact';

import type {ComponentType} from '../../protocol';
import type {JSX} from 'preact';

import {TYPE_ICONS, capitalize} from './helpers';

export type MenuHeaderProps = {
  kind: 'component' | 'locked-page';
  type: ComponentType;
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

  const Icon = TYPE_ICONS[type];
  if (Icon == null) return null;

  return (
    <UiContextMenu.Label className='flex items-center gap-2 py-2 font-bold'>
      <Icon className='size-4' strokeWidth={2} />
      {capitalize(type)}
    </UiContextMenu.Label>
  );
};
