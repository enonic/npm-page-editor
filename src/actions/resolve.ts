import type {ComponentPath, ComponentType} from '../protocol';
import type {ActionDef} from './definitions';

import {translate} from '../i18n';

export type ActionContext = {
  type: ComponentType;
  path: ComponentPath;
  empty: boolean;
  error: boolean;
  locked: boolean;
  fragment: boolean;
  fragmentAllowed: boolean;
  resetEnabled: boolean;
  pageTemplate: boolean;
  hasParentLayout: boolean;
  isTopFragment: boolean;
};

function buildInsertSubmenu(hasParentLayout: boolean): ActionDef {
  const children: ActionDef[] = [{id: 'insert-part', label: translate('field.part'), sortOrder: 0}];

  if (!hasParentLayout) {
    children.push({id: 'insert-layout', label: translate('field.layout'), sortOrder: 10});
  }

  children.push(
    {id: 'insert-text', label: translate('field.text'), sortOrder: 20},
    {id: 'insert-fragment', label: translate('field.fragment'), sortOrder: 30},
  );

  return {id: 'insert', label: translate('action.insert'), sortOrder: 10, children};
}

function resolvePageActions(context: ActionContext): ActionDef[] {
  const actions: ActionDef[] = [{id: 'inspect', label: translate('action.inspect'), sortOrder: 0}];

  if (context.resetEnabled) {
    actions.push({id: 'reset', label: translate('action.reset'), sortOrder: 10});
  }

  if (!context.pageTemplate) {
    actions.push({id: 'save-as-template', label: translate('action.saveAsTemplate'), sortOrder: 20});
  }

  return actions;
}

function resolveRegionActions(context: ActionContext): ActionDef[] {
  const actions: ActionDef[] = [
    {id: 'select-parent', label: translate('action.selectParent'), sortOrder: 0},
    buildInsertSubmenu(context.hasParentLayout),
  ];

  if (!context.empty) {
    actions.push({id: 'reset', label: translate('action.reset'), sortOrder: 20});
  }

  return actions;
}

function resolveComponentActions(context: ActionContext): ActionDef[] {
  const actions: ActionDef[] = [{id: 'select-parent', label: translate('action.selectParent'), sortOrder: 0}];

  if (context.type === 'text' && !context.empty) {
    actions.push({id: 'edit-text', label: translate('action.edit'), sortOrder: 5, enabled: !context.error});
  }

  if (context.type === 'fragment' && !context.empty) {
    actions.push({id: 'edit-content', label: translate('action.edit'), sortOrder: 5, enabled: !context.error});
  }

  actions.push(buildInsertSubmenu(context.hasParentLayout), {
    id: 'inspect',
    label: translate('action.inspect'),
    sortOrder: 20,
  });

  if (!context.empty) {
    actions.push({id: 'reset', label: translate('action.reset'), sortOrder: 30, enabled: !context.error});
  }

  if (!context.isTopFragment) {
    actions.push({id: 'remove', label: translate('action.remove'), sortOrder: 40});
  }

  actions.push({id: 'duplicate', label: translate('action.duplicate'), sortOrder: 50});

  if (context.type === 'fragment' && !context.empty) {
    actions.push({
      id: 'detach-fragment',
      label: translate('action.detachFragment'),
      sortOrder: 55,
      enabled: !context.error,
    });
  }

  if (context.fragmentAllowed && !context.hasParentLayout) {
    actions.push({id: 'create-fragment', label: translate('action.createFragment'), sortOrder: 60});
  }

  return actions;
}

export function resolveActions(context: ActionContext): ActionDef[] {
  if (context.locked) {
    return [{id: 'page-settings', label: translate('action.pageSettings'), sortOrder: 0}];
  }

  if (context.type === 'page') return resolvePageActions(context);
  if (context.type === 'region') return resolveRegionActions(context);

  return resolveComponentActions(context);
}
