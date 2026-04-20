import type {DescriptorMap} from './parse';
import type {ComponentPath, ComponentType, PageDescriptorEntry} from './protocol';
import type {PlaceholderIsland} from './rendering';
import type {ComponentRecord} from './state';
import type {ReactNode} from 'react';

import {ComponentEmptyPlaceholder} from './components/ComponentEmptyPlaceholder';
import {ComponentErrorPlaceholder} from './components/ComponentErrorPlaceholder';
import {ComponentLoadingPlaceholder} from './components/ComponentLoadingPlaceholder';
import {ComponentPlaceholder} from './components/ComponentPlaceholder';
import {RegionPlaceholder} from './components/RegionPlaceholder';
import {markDirty} from './geometry';
import {fireComponentLoadRequest} from './load-request';
import {collectTrackedDescendants, isComponentElement, parsePage, parseSubtree} from './parse';
import {flushSelectionRestore} from './persistence';
import {componentIndex, depth, isComponent, parent, regionName as getRegionName} from './protocol/path';
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
let prevDescriptors: DescriptorMap = {};

// ! Per-element stable identity keyed by `data-pe-instance-id`. Used by the `load(existing=true)`
// ! decision in `computeLoadTargets` so descriptor changes are detected against the SAME DOM
// ! element across reconciles — not against the path alone. Without this, deleting `/main/1` in
// ! a region of three siblings causes `/main/2`'s element to now parse at path `/main/1`, and a
// ! path-keyed comparison would (wrongly) see `/main/1`'s descriptor "change" and fetch stale
// ! server HTML that overwrites the correct content. See `docs/architectural-regressions.md#I1`.
const INSTANCE_ATTR = 'data-pe-instance-id';
let instanceCounter = 0;
let prevByInstance = new Map<string, PageDescriptorEntry>();

function nextInstanceId(): string {
  instanceCounter += 1;
  return `pe-${instanceCounter}`;
}

function getInstanceId(element: HTMLElement): string {
  let id = element.getAttribute(INSTANCE_ATTR);
  if (id == null) {
    id = nextInstanceId();
    element.setAttribute(INSTANCE_ATTR, id);
  }
  return id;
}

export function resetPageReadyFlag(): void {
  pageReadyEmitted = false;
  prevDescriptors = {};
  prevByInstance = new Map();
  instanceCounter = 0;
}

const STUBBABLE_TYPES: ReadonlySet<ComponentType> = new Set(['part', 'layout', 'text', 'fragment']);

function stubType(entry: PageDescriptorEntry | undefined): ComponentType {
  if (entry?.type != null && STUBBABLE_TYPES.has(entry.type)) return entry.type;
  return 'part';
}

// ! Synthesized stubs have no server-rendered markup, so their intrinsic size is zero.
// ! In real CSS grid/flex regions that collapses them out of the hit-test surface —
// ! `document.elementsFromPoint` never lands on them and drag-and-drop misses the target.
// ! Setting a min size keeps the stub reachable until CS replaces it with real HTML.
const STUB_MIN_PX = 40;

function synthesizeStubElement(type: ComponentType): HTMLDivElement {
  const element = document.createElement('div');
  element.setAttribute('data-portal-component-type', type);
  element.style.minHeight = `${STUB_MIN_PX}px`;
  element.style.minWidth = `${STUB_MIN_PX}px`;
  return element;
}

function ensureStubs(descriptors: DescriptorMap, records: Record<string, ComponentRecord>): Set<ComponentPath> {
  const created = new Set<ComponentPath>();

  // ? Sort by depth so outer layouts are stubbed before deeper children.
  // ? A stub for a layout has no inner regions until CS replaces it with real HTML;
  // ? deeper descendants will resolve on the next reconcile triggered by MutationObserver.
  const missing = Object.keys(descriptors)
    .filter(path => !(path in records))
    .sort((a, b) => depth(a as ComponentPath) - depth(b as ComponentPath));

  for (const rawPath of missing) {
    const path = rawPath as ComponentPath;
    if (!isComponent(path)) continue;

    const parentPath = parent(path);
    if (parentPath == null) continue;

    const parentRegion = records[parentPath];
    if (parentRegion?.type !== 'region' || parentRegion.element == null) continue;

    const index = componentIndex(path);
    if (index == null) continue;

    const stub = synthesizeStubElement(stubType(descriptors[rawPath]));
    const regionEl = parentRegion.element;
    const componentChildren = collectTrackedDescendants(regionEl, isComponentElement);

    if (index >= componentChildren.length) {
      regionEl.appendChild(stub);
    } else {
      componentChildren[index].before(stub);
    }

    created.add(path);
  }

  return created;
}

// ? Detach DOM for paths that were present in the last descriptor snapshot but are gone now.
// ? Without this, deleting a component in CS leaves an orphan element in DOM that shows as an
// ? empty-part placeholder forever (reconcile only mutates records, `load → replaceWith` is the
// ? only code path that otherwise touches element children). Restricted to previously-tracked
// ? paths so the first reconcile after boot — when CS may be slow to send `page-state` — does
// ? not wipe server-rendered components that simply haven't been described yet.
function detachOrphans(descriptors: DescriptorMap, records: Record<string, ComponentRecord>): Set<ComponentPath> {
  const detached = new Set<ComponentPath>();

  for (const [rawPath, record] of Object.entries(records)) {
    if (record.type === 'page' || record.type === 'region') continue;
    if (rawPath in descriptors) continue;
    if (!(rawPath in prevDescriptors)) continue;
    if (record.element == null) continue;

    record.element.remove();
    detached.add(rawPath as ComponentPath);
  }

  return detached;
}

function entryChanged(prev: PageDescriptorEntry | undefined, curr: PageDescriptorEntry | undefined): boolean {
  if (prev == null || curr == null) return false;
  return (
    prev.descriptor !== curr.descriptor ||
    prev.fragment !== curr.fragment ||
    prev.name !== curr.name ||
    prev.type !== curr.type ||
    prev.configHash !== curr.configHash
  );
}

type LoadTarget = {path: ComponentPath; existing: boolean};

function computeLoadTargets(
  descriptors: DescriptorMap,
  records: Record<string, ComponentRecord>,
  created: Set<ComponentPath>,
): LoadTarget[] {
  const targets: LoadTarget[] = [];

  for (const path of created) {
    const record = records[path];
    if (record == null || record.loading) continue;
    targets.push({path, existing: false});
  }

  for (const [rawPath, curr] of Object.entries(descriptors)) {
    const path = rawPath as ComponentPath;
    if (created.has(path)) continue;

    const record = records[path];
    if (record == null || record.element == null || record.loading) continue;
    if (record.type === 'page' || record.type === 'region') continue;

    // ? Key the "did this descriptor change?" check on the DOM element's stable instance id,
    // ? not its parsed path. After a sibling delete the path index shifts, but the element
    // ? itself still holds the correct server-rendered content — a path-keyed comparison
    // ? would misread the shift as a descriptor change and fetch stale HTML.
    const id = record.element.getAttribute(INSTANCE_ATTR);
    const prev = id != null ? prevByInstance.get(id) : undefined;
    if (!entryChanged(prev, curr)) continue;

    targets.push({path, existing: true});
  }

  return targets;
}

function snapshotByInstance(
  descriptors: DescriptorMap,
  records: Record<string, ComponentRecord>,
): Map<string, PageDescriptorEntry> {
  const snapshot = new Map<string, PageDescriptorEntry>();

  for (const [rawPath, entry] of Object.entries(descriptors)) {
    const record = records[rawPath as ComponentPath];
    if (record?.element == null) continue;
    if (record.type === 'page' || record.type === 'region') continue;

    const id = getInstanceId(record.element);
    snapshot.set(id, entry);
  }

  return snapshot;
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
  let records = parsePage(root, {descriptors, fragment});

  const detached = detachOrphans(descriptors, records);
  if (detached.size > 0) {
    records = parsePage(root, {descriptors, fragment});
  }

  const created = ensureStubs(descriptors, records);
  if (created.size > 0) {
    records = parsePage(root, {descriptors, fragment});
  }

  const loadTargets = computeLoadTargets(descriptors, records, created);
  for (const {path} of loadTargets) {
    const record = records[path];
    if (record == null) continue;
    records[path] = {...record, loading: true};
  }

  prevDescriptors = descriptors;
  prevByInstance = snapshotByInstance(descriptors, records);

  finalizeReconcile(records);

  for (const {path, existing} of loadTargets) {
    fireComponentLoadRequest(path, existing);
  }

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
