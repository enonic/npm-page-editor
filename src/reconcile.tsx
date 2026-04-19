import type {DescriptorMap} from './parse';
import type {ComponentPath} from './protocol';
import type {PlaceholderIsland} from './rendering';
import type {ComponentRecord} from './state';
import type {ReactNode} from 'react';

import {ComponentEmptyPlaceholder} from './components/ComponentEmptyPlaceholder';
import {ComponentErrorPlaceholder} from './components/ComponentErrorPlaceholder';
import {ComponentLoadingPlaceholder} from './components/ComponentLoadingPlaceholder';
import {ComponentPlaceholder} from './components/ComponentPlaceholder';
import {RegionPlaceholder} from './components/RegionPlaceholder';
import {markDirty} from './geometry';
import {parsePage, parseSubtree} from './parse';
import {flushSelectionRestore} from './persistence';
import {regionName as getRegionName} from './protocol/path';
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

// Host visibility during drag is managed inside RegionPlaceholder itself via a
// useLayoutEffect that walks to the placeholder-island's host element. That
// path works for islands mounted through this module AND for islands mounted
// directly (e.g., Storybook integration stories).

type PlaceholderEntry = {island: PlaceholderIsland; stateKey: string};

const placeholderEntries = new Map<string, PlaceholderEntry>();
const dragPlaceholderEntries = new Map<string, PlaceholderIsland>();

let pageReadyEmitted = false;

export function resetPageReadyFlag(): void {
  pageReadyEmitted = false;
}

function placeholderStateKey(record: ComponentRecord): string {
  if (record.type === 'region') return 'region';
  if (record.loading) return 'loading';
  if (record.error) return `error:${record.descriptor ?? ''}`;
  if (record.descriptor != null) return `empty:${record.descriptor}`;
  return record.type;
}

function shouldShowPlaceholder(record: ComponentRecord): boolean {
  return record.type !== 'page' && (record.empty || record.error || record.loading);
}

function destroyPlaceholder(path: string): void {
  const entry = placeholderEntries.get(path);
  if (entry == null) return;

  entry.island.unmount();
  placeholderEntries.delete(path);
}

function isInSubtree(path: string, rootPath: string): boolean {
  return path === rootPath || path.startsWith(`${rootPath}/`);
}

function createPlaceholderContent(record: ComponentRecord): ReactNode {
  if (record.type === 'region') {
    return <RegionPlaceholder path={record.path} regionName={getRegionName(record.path) ?? record.path} />;
  }

  if (record.loading) {
    return <ComponentLoadingPlaceholder />;
  }

  if (record.error) {
    return <ComponentErrorPlaceholder descriptor={record.descriptor} />;
  }

  if (record.descriptor != null) {
    return <ComponentEmptyPlaceholder descriptor={record.descriptor} />;
  }

  return <ComponentPlaceholder type={record.type} />;
}

function syncPlaceholders(records: Record<string, ComponentRecord>): void {
  const nextPaths = new Set<string>();

  for (const [path, record] of Object.entries(records)) {
    if (record.element == null || !shouldShowPlaceholder(record)) {
      destroyPlaceholder(path);
      continue;
    }

    nextPaths.add(path);

    const key = placeholderStateKey(record);
    const current = placeholderEntries.get(path);
    if (current?.island.container === record.element && current.island.host.isConnected && current.stateKey === key) {
      continue;
    }

    destroyPlaceholder(path);

    const content = createPlaceholderContent(record);
    placeholderEntries.set(path, {island: createPlaceholderIsland(record.element, content), stateKey: key});
  }

  for (const path of placeholderEntries.keys()) {
    if (!nextPaths.has(path)) {
      destroyPlaceholder(path);
    }
  }
}

function resetRootLinks(records: Record<string, ComponentRecord>): void {
  for (const record of Object.values(records)) {
    if ((record.type === 'part' || record.type === 'fragment') && record.element?.tagName === 'A') {
      record.element.setAttribute('href', '#');
    }
  }
}

function applyTextDirection(records: Record<string, ComponentRecord>): void {
  const dir = $config.get()?.langDirection;
  if (dir !== 'rtl') return;

  for (const record of Object.values(records)) {
    if (record.type === 'text' && record.element != null) {
      record.element.dir = 'rtl';
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

  resetRootLinks(records);
  applyTextDirection(records);
  syncPlaceholders(records);
  markDirty();
}

export function reconcilePage(root: HTMLElement, descriptors: DescriptorMap): void {
  if (isDragging()) return;

  const fragment = $config.get()?.fragment;
  const records = parsePage(root, {descriptors, fragment});

  finalizeReconcile(records);

  if (!pageReadyEmitted) {
    flushSelectionRestore();
    pageReadyEmitted = true;
    tryGetChannel()?.send({type: 'page-ready'});
  }
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
  for (const path of Array.from(placeholderEntries.keys())) {
    destroyPlaceholder(path);
  }
  for (const path of Array.from(dragPlaceholderEntries.keys())) {
    destroyDragPlaceholder(path);
  }
}

//
// * Drag-time placeholders
//

function destroyDragPlaceholder(path: string): void {
  const island = dragPlaceholderEntries.get(path);
  if (island == null) return;

  island.unmount();
  dragPlaceholderEntries.delete(path);
}

function isEffectivelyEmptyDuringDrag(record: ComponentRecord, sourcePath: string): boolean {
  if (record.type !== 'region' || record.element == null) return false;
  if (record.empty) return false;
  return record.children.every(childPath => childPath === sourcePath);
}

export function syncDragEmptyRegions(sourcePath: string | undefined): void {
  if (sourcePath == null) {
    for (const path of Array.from(dragPlaceholderEntries.keys())) {
      destroyDragPlaceholder(path);
    }
    return;
  }

  const records = $registry.get();

  for (const [path, record] of Object.entries(records)) {
    if (!isEffectivelyEmptyDuringDrag(record, sourcePath)) continue;
    if (placeholderEntries.has(path) || dragPlaceholderEntries.has(path)) continue;
    if (record.element == null) continue;

    const content = <RegionPlaceholder path={record.path} regionName={getRegionName(record.path) ?? record.path} />;
    dragPlaceholderEntries.set(path, createPlaceholderIsland(record.element, content));
  }
}
