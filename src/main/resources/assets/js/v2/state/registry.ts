import {map} from 'nanostores';

import type {ComponentPath, ComponentType} from '../protocol';

export type ComponentRecord = {
  path: ComponentPath;
  type: ComponentType;
  element: HTMLElement | undefined;
  parentPath: ComponentPath | undefined;
  children: ComponentPath[];
  empty: boolean;
  error: boolean;
  descriptor: string | undefined;
  loading: boolean;
};

export const $registry = map<Record<string, ComponentRecord>>({});

export function setRegistry(records: Record<string, ComponentRecord>): void {
  $registry.set(records);
}

export function getRecord(path: ComponentPath): ComponentRecord | undefined {
  return $registry.get()[path];
}

export function updateRecord(path: ComponentPath, partial: Partial<ComponentRecord>): void {
  const current = $registry.get()[path];
  if (current == null) return;

  $registry.setKey(path, {...current, ...partial});
}

export function removeRecord(path: ComponentPath): void {
  const records = $registry.get();
  if (!(path in records)) return;

  const {[path]: _, ...rest} = records;
  $registry.set(rest);
}
