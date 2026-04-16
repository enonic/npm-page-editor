import {Blocks, Package, PanelLeft, PenLine, Puzzle} from 'lucide-preact';

import type {ActionContext, ActionId} from '../../actions';
import type {ComponentPath, ComponentType} from '../../protocol';
import type {LucideIcon} from 'lucide-preact';

import {parent} from '../../protocol';
import {$config, getRecord} from '../../state';

export const TYPE_ICONS: Partial<Record<ComponentType, LucideIcon>> = {
  region: Blocks,
  text: PenLine,
  part: Package,
  layout: PanelLeft,
  fragment: Puzzle,
};

export const INSERT_ICONS: Partial<Record<ActionId, LucideIcon>> = {
  'insert-part': Package,
  'insert-layout': PanelLeft,
  'insert-text': PenLine,
  'insert-fragment': Puzzle,
};

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hasParentLayout(path: ComponentPath): boolean {
  let current = parent(path);

  while (current != null) {
    const record = getRecord(current);
    if (record?.type === 'layout') return true;
    current = parent(current);
  }

  return false;
}

function isTopFragment(path: ComponentPath, isFragment: boolean): boolean {
  if (!isFragment) return false;

  // In a fragment, the top component is the one directly under the root region
  const parentPath = parent(path);
  if (parentPath == null) return false;

  const parentRecord = getRecord(parentPath);
  if (parentRecord?.type !== 'region') return false;

  const grandparentPath = parent(parentPath);
  return grandparentPath != null && parent(grandparentPath) == null;
}

export function buildLockedContext(path: ComponentPath): ActionContext {
  return {
    type: 'page',
    path,
    empty: false,
    error: false,
    locked: true,
    modifyAllowed: true,
    fragment: false,
    fragmentAllowed: false,
    resetEnabled: false,
    pageTemplate: false,
    hasParentLayout: false,
    isTopFragment: false,
  };
}

export function buildActionContext(path: ComponentPath): ActionContext | undefined {
  const record = getRecord(path);
  if (record == null) return undefined;

  const config = $config.get();

  return {
    type: record.type,
    path,
    empty: record.empty,
    error: record.error,
    locked: false,
    modifyAllowed: true,
    fragment: config?.fragment ?? false,
    fragmentAllowed: config?.fragmentAllowed ?? false,
    resetEnabled: config?.resetEnabled ?? false,
    pageTemplate: config?.pageTemplate ?? false,
    hasParentLayout: hasParentLayout(path),
    isTopFragment: isTopFragment(path, config?.fragment ?? false),
  };
}
