import type {DescriptorMap} from './parse';
import type {ComponentPath} from './protocol';
import type {PlaceholderIsland} from './rendering';
import type {ComponentRecord} from './state';
import type {ReactNode} from 'preact/compat';

import {markDirty} from './geometry';
import {parsePage, parseSubtree} from './parse';
import {createPlaceholderIsland} from './rendering';
import {
  $registry,
  setRegistry,
  getRecord,
  $selectedPath,
  setSelectedPath,
  $hoveredPath,
  setHoveredPath,
  $config,
  closeContextMenu,
  isDragging,
  rebuildIndex,
} from './state';
import {tryGetChannel} from './transport';

const placeholderIslands = new Map<string, PlaceholderIsland>();

function shouldShowPlaceholder(record: ComponentRecord): boolean {
  return record.type !== 'page' && (record.empty || record.error);
}

function destroyPlaceholder(path: string): void {
  const island = placeholderIslands.get(path);
  if (island == null) return;

  island.unmount();
  placeholderIslands.delete(path);
}

function isInSubtree(path: string, rootPath: string): boolean {
  return path === rootPath || path.startsWith(`${rootPath}/`);
}

// TODO: Replace inline JSX with ComponentPlaceholder/RegionPlaceholder (step 08)
function createPlaceholderContent(record: ComponentRecord): ReactNode {
  if (record.type === 'region') {
    return <div style={{padding: '16px', textAlign: 'center', color: '#999'}}>Drop components here</div>;
  }

  if (record.error) {
    return (
      <div style={{padding: '16px', textAlign: 'center', color: '#c00'}}>
        {record.descriptor ?? 'Component could not be rendered.'}
      </div>
    );
  }

  return <div style={{padding: '16px', textAlign: 'center', color: '#999'}}>Empty component</div>;
}

function syncPlaceholders(records: Record<string, ComponentRecord>): void {
  const nextPaths = new Set<string>();

  for (const [path, record] of Object.entries(records)) {
    if (record.element == null || !shouldShowPlaceholder(record)) {
      destroyPlaceholder(path);
      continue;
    }

    nextPaths.add(path);

    const currentIsland = placeholderIslands.get(path);
    if (currentIsland?.container === record.element && currentIsland.host.isConnected) {
      continue;
    }

    destroyPlaceholder(path);

    const content = createPlaceholderContent(record);
    placeholderIslands.set(path, createPlaceholderIsland(record.element, content));
  }

  for (const path of placeholderIslands.keys()) {
    if (!nextPaths.has(path)) {
      destroyPlaceholder(path);
    }
  }
}

function finalizeReconcile(records: Record<string, ComponentRecord>): void {
  // ? Rebuild index before setting registry so subscribers see consistent state
  rebuildIndex(records);
  setRegistry(records);

  const selectedPath = $selectedPath.get();
  if (selectedPath != null && getRecord(selectedPath) == null) {
    setSelectedPath(undefined);
    closeContextMenu();
    tryGetChannel()?.send({type: 'deselect', path: selectedPath});
  }

  const hoveredPath = $hoveredPath.get();
  if (hoveredPath != null && getRecord(hoveredPath) == null) {
    setHoveredPath(undefined);
  }

  syncPlaceholders(records);
  markDirty();
}

export function reconcilePage(root: HTMLElement, descriptors: DescriptorMap): void {
  if (isDragging()) return;

  const fragment = $config.get()?.fragment;
  const records = parsePage(root, {descriptors, fragment});

  finalizeReconcile(records);
}

export function reconcileSubtree(element: HTMLElement, parentPath: ComponentPath, descriptors: DescriptorMap): void {
  if (isDragging()) return;

  const fragment = $config.get()?.fragment;
  const freshRecords = parseSubtree(element, parentPath, {descriptors, fragment});

  const currentRecords = $registry.get();
  const nextRecords: Record<string, ComponentRecord> = {};

  for (const [path, record] of Object.entries(currentRecords)) {
    if (!isInSubtree(path, parentPath)) {
      nextRecords[path] = record;
    }
  }

  Object.assign(nextRecords, freshRecords);

  finalizeReconcile(nextRecords);
}

export function destroyPlaceholders(): void {
  for (const path of Array.from(placeholderIslands.keys())) {
    destroyPlaceholder(path);
  }
}
