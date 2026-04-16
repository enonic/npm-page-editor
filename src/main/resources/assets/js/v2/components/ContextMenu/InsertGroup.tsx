import {ContextMenu as UiContextMenu} from '@enonic/ui';

import type {ActionDef} from '../../actions';
import type {JSX} from 'preact';

import {useI18n} from '../../i18n';
import {useMenuAction} from './context';
import {INSERT_ICONS} from './helpers';

export type InsertGroupProps = {
  actions: ActionDef[];
};

export const InsertGroup = ({actions}: InsertGroupProps): JSX.Element => {
  const dispatch = useMenuAction();
  const t = useI18n();
  const sorted = actions.toSorted((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <UiContextMenu.Label>{t('action.insert')}</UiContextMenu.Label>
      {sorted.map(child => {
        const Icon = INSERT_ICONS[child.id];

        return (
          <UiContextMenu.Item key={child.id} disabled={child.enabled === false} onSelect={() => dispatch(child.id)}>
            <span className='flex items-center gap-2'>
              {Icon != null ? <Icon className='size-4' strokeWidth={1.5} /> : null}
              {child.label}
            </span>
          </UiContextMenu.Item>
        );
      })}
    </>
  );
};
