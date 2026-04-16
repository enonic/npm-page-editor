import type {ComponentPath, ComponentType} from '../protocol';
import type {ActionDef} from './definitions';

export type ActionContext = {
  type: ComponentType;
  path: ComponentPath;
  empty: boolean;
  error: boolean;
  locked: boolean;
  modifyAllowed: boolean;
  fragment: boolean;
  fragmentAllowed: boolean;
  resetEnabled: boolean;
  pageTemplate: boolean;
  hasParentLayout: boolean;
  isTopFragment: boolean;
};

function buildInsertSubmenu(hasParentLayout: boolean): ActionDef {
  const children: ActionDef[] = [{id: 'insert-part', label: 'Part', sortOrder: 0}];

  if (!hasParentLayout) {
    children.push({id: 'insert-layout', label: 'Layout', sortOrder: 10});
  }

  children.push(
    {id: 'insert-text', label: 'Text', sortOrder: 20},
    {id: 'insert-fragment', label: 'Fragment', sortOrder: 30},
  );

  return {id: 'insert', label: 'Insert', sortOrder: 10, children};
}

function resolvePageActions(context: ActionContext): ActionDef[] {
  const actions: ActionDef[] = [{id: 'inspect', label: 'Inspect', sortOrder: 0}];

  if (context.resetEnabled) {
    actions.push({id: 'reset', label: 'Reset', sortOrder: 10});
  }

  if (!context.pageTemplate) {
    actions.push({id: 'save-as-template', label: 'Save as Template', sortOrder: 20});
  }

  return actions;
}

function resolveRegionActions(context: ActionContext): ActionDef[] {
  const actions: ActionDef[] = [
    {id: 'select-parent', label: 'Select Parent', sortOrder: 0},
    buildInsertSubmenu(context.hasParentLayout),
  ];

  if (!context.empty) {
    actions.push({id: 'reset', label: 'Reset', sortOrder: 20});
  }

  return actions;
}

function resolveComponentActions(context: ActionContext): ActionDef[] {
  const actions: ActionDef[] = [{id: 'select-parent', label: 'Select Parent', sortOrder: 0}];

  if (context.type === 'text' && !context.empty) {
    actions.push({id: 'edit-text', label: 'Edit', sortOrder: 5, enabled: !context.error});
  }

  if (context.type === 'fragment' && !context.empty) {
    actions.push({id: 'edit-content', label: 'Edit', sortOrder: 5, enabled: !context.error});
  }

  actions.push(buildInsertSubmenu(context.hasParentLayout), {id: 'inspect', label: 'Inspect', sortOrder: 20});

  if (!context.empty) {
    actions.push({id: 'reset', label: 'Reset', sortOrder: 30, enabled: !context.error});
  }

  if (!context.isTopFragment) {
    actions.push({id: 'remove', label: 'Remove', sortOrder: 40});
  }

  actions.push({id: 'duplicate', label: 'Duplicate', sortOrder: 50});

  if (context.type === 'fragment' && !context.empty) {
    actions.push({id: 'detach-fragment', label: 'Detach Fragment', sortOrder: 55, enabled: !context.error});
  }

  if (context.fragmentAllowed && !context.hasParentLayout) {
    actions.push({id: 'create-fragment', label: 'Create Fragment', sortOrder: 60});
  }

  return actions;
}

export function resolveActions(context: ActionContext): ActionDef[] {
  if (context.locked) {
    return [{id: 'page-settings', label: 'Page Settings', sortOrder: 0}];
  }

  if (context.type === 'page') return resolvePageActions(context);
  if (context.type === 'region') return resolveRegionActions(context);

  return resolveComponentActions(context);
}
