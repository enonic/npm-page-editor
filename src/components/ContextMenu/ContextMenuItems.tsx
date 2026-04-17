import {ContextMenu as UiContextMenu} from '@enonic/ui';

import type {ActionId} from '../../actions';
import type {ComponentPath} from '../../protocol';
import type {JSX} from 'preact';

import {executeAction, resolveActions} from '../../actions';
import {closeContextMenu} from '../../state';
import {getChannel} from '../../transport';
import {MenuActionProvider} from './context';
import {buildActionContext, buildLockedContext, TYPE_ICONS} from './helpers';
import {InsertGroup} from './InsertGroup';
import {MenuHeader} from './MenuHeader';

export type ContextMenuItemsProps = {
  path: ComponentPath;
  kind: 'component' | 'locked-page';
};

export const ContextMenuItems = ({path, kind}: ContextMenuItemsProps): JSX.Element | null => {
  const context = kind === 'locked-page' ? buildLockedContext(path) : buildActionContext(path);

  if (context == null) return null;

  const actions = resolveActions(context);
  if (actions.length === 0) return null;

  const dispatch = (actionId: ActionId): void => {
    executeAction(actionId, path, getChannel());
    closeContextMenu();
  };

  const sorted = actions.toSorted((a, b) => a.sortOrder - b.sortOrder);

  const showHeader = kind === 'locked-page' || TYPE_ICONS[context.type] != null;
  const selectParent = sorted.find(a => a.id === 'select-parent');
  const insertChildren = sorted.find(a => a.id === 'insert')?.children;
  const remaining = sorted.filter(a => a.id !== 'select-parent' && a.id !== 'insert');

  const hasSelectParent = selectParent != null;
  const hasInsert = insertChildren != null;
  const hasRemaining = remaining.length > 0;

  return (
    <MenuActionProvider value={dispatch}>
      {showHeader && <MenuHeader kind={kind} type={context.type} />}

      {hasSelectParent && (
        <>
          <UiContextMenu.Item onSelect={() => dispatch('select-parent')}>{selectParent.label}</UiContextMenu.Item>
          {(hasInsert || hasRemaining) && <UiContextMenu.Separator />}
        </>
      )}

      {insertChildren != null && (
        <>
          <InsertGroup actions={insertChildren} />
          {hasRemaining && <UiContextMenu.Separator />}
        </>
      )}

      {hasRemaining &&
        remaining.map(action => (
          <UiContextMenu.Item key={action.id} disabled={action.enabled === false} onSelect={() => dispatch(action.id)}>
            {action.label}
          </UiContextMenu.Item>
        ))}
    </MenuActionProvider>
  );
};
