import type {ComponentPath} from '../protocol';
import type {Channel} from '../transport';

import {componentIndex, insertAt, isRegion, parent, root} from '../protocol';
import {getRecord, setSelectedPath} from '../state';

export type ActionId =
  | 'select-parent'
  | 'insert'
  | 'insert-part'
  | 'insert-layout'
  | 'insert-text'
  | 'insert-fragment'
  | 'inspect'
  | 'edit-text'
  | 'edit-content'
  | 'reset'
  | 'remove'
  | 'duplicate'
  | 'create-fragment'
  | 'detach-fragment'
  | 'save-as-template'
  | 'page-settings';

export type ActionDef = {
  id: ActionId;
  label: string;
  sortOrder: number;
  children?: ActionDef[];
  enabled?: boolean;
};

export function resolveInsertPath(path: ComponentPath): ComponentPath {
  if (isRegion(path)) {
    const childCount = getRecord(path)?.children.length ?? 0;
    return insertAt(path, childCount);
  }

  const parentPath = parent(path);
  const index = componentIndex(path);

  if (parentPath == null || index == null) {
    throw new Error(`Cannot resolve insert path for "${path}"`);
  }

  return insertAt(parentPath, index + 1);
}

export function executeAction(action: ActionId, path: ComponentPath, channel: Channel): void {
  switch (action) {
    case 'inspect':
      channel.send({type: 'inspect', path});
      break;

    case 'remove':
      channel.send({type: 'remove', path});
      break;

    case 'duplicate':
      channel.send({type: 'duplicate', path});
      break;

    case 'reset':
      channel.send({type: 'reset', path});
      break;

    case 'select-parent': {
      const parentPath = parent(path);
      if (parentPath != null) {
        setSelectedPath(parentPath);
        channel.send({type: 'select', path: parentPath});
      }
      break;
    }

    case 'insert-part':
      channel.send({type: 'add', path: resolveInsertPath(path), componentType: 'part'});
      break;

    case 'insert-layout':
      channel.send({type: 'add', path: resolveInsertPath(path), componentType: 'layout'});
      break;

    case 'insert-text':
      channel.send({type: 'add', path: resolveInsertPath(path), componentType: 'text'});
      break;

    case 'insert-fragment':
      channel.send({type: 'add', path: resolveInsertPath(path), componentType: 'fragment'});
      break;

    case 'edit-text':
      channel.send({type: 'edit-text', path});
      break;

    case 'edit-content': {
      const record = getRecord(path);
      if (record?.fragmentContentId != null) {
        channel.send({type: 'edit-content', contentId: record.fragmentContentId});
      }
      break;
    }

    case 'create-fragment':
      channel.send({type: 'create-fragment', path});
      break;

    case 'detach-fragment':
      channel.send({type: 'detach-fragment', path});
      break;

    case 'save-as-template':
      channel.send({type: 'save-as-template'});
      break;

    case 'page-settings':
      channel.send({type: 'inspect', path: root()});
      break;

    case 'insert':
      // Insert is a grouping action, not executable
      break;
  }
}
