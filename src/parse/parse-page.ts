import type {ComponentPath, ComponentType, PageDescriptorEntry} from '../protocol';
import type {ComponentRecord} from '../state/registry';

import {append, insertAt, root} from '../protocol';
import {isNodeEmpty} from './emptiness';

export type DescriptorMap = Record<string, PageDescriptorEntry>;

type ParsePageOptions = {
  fragment?: boolean;
  descriptors?: DescriptorMap;
};

const COMPONENT_SELECTOR = '[data-portal-component-type]';
const REGION_SELECTOR = '[data-portal-region]';
const ERROR_ATTR = 'data-portal-placeholder-error';
const COMPONENT_TYPES = new Set<string>(['page', 'region', 'text', 'part', 'layout', 'fragment']);

function isComponentType(value: string | undefined): value is ComponentType {
  return value != null && COMPONENT_TYPES.has(value);
}

export function isRegionElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(REGION_SELECTOR);
}

export function isComponentElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(COMPONENT_SELECTOR);
}

export function collectTrackedDescendants(
  container: HTMLElement,
  predicate: (element: Element) => boolean,
): HTMLElement[] {
  const result: HTMLElement[] = [];

  for (const child of Array.from(container.children)) {
    if (!(child instanceof HTMLElement)) continue;

    if (predicate(child)) {
      result.push(child);
      continue;
    }

    result.push(...collectTrackedDescendants(child, predicate));
  }

  return result;
}

function findFirstTrackedDescendant(
  container: HTMLElement,
  predicate: (element: Element) => boolean,
): HTMLElement | undefined {
  for (const child of Array.from(container.children)) {
    if (!(child instanceof HTMLElement)) continue;

    if (predicate(child)) return child;

    const nested = findFirstTrackedDescendant(child, predicate);
    if (nested) return nested;
  }

  return undefined;
}

function resolveDescriptor(path: ComponentPath, type: ComponentType, descriptors: DescriptorMap): string | undefined {
  if (type === 'page' || type === 'region') return undefined;

  const entry = descriptors[path];
  if (entry == null) return undefined;

  return entry.descriptor ?? entry.fragment ?? entry.name;
}

function makeRecord(
  path: ComponentPath,
  type: ComponentType,
  element: HTMLElement,
  parentPath: ComponentPath | undefined,
  children: ComponentPath[],
  descriptors: DescriptorMap,
): ComponentRecord {
  return {
    path,
    type,
    element,
    parentPath,
    children,
    empty: type === 'region' ? children.length === 0 : isNodeEmpty(element),
    error: element.getAttribute(ERROR_ATTR) === 'true',
    descriptor: resolveDescriptor(path, type, descriptors),
    fragmentContentId: type === 'fragment' ? descriptors[path]?.fragment : undefined,
    loading: false,
  };
}

function parseComponent(
  element: HTMLElement,
  path: ComponentPath,
  parentPath: ComponentPath | undefined,
  records: Record<string, ComponentRecord>,
  descriptors: DescriptorMap,
): ComponentRecord {
  const raw = element.dataset.portalComponentType;
  const type: ComponentType = isComponentType(raw) ? raw : 'part';
  const children: ComponentPath[] = [];

  if (type === 'layout') {
    const regions = collectTrackedDescendants(element, isRegionElement);
    for (const regionEl of regions) {
      const regionRecord = parseRegionSubtree(regionEl, path, records, descriptors);
      children.push(regionRecord.path);
    }
  }

  if (type === 'fragment') {
    const innerTracked = element.querySelectorAll('[data-portal-component-type], [data-portal-region]');
    innerTracked.forEach(el => {
      el.removeAttribute('data-portal-component-type');
      el.removeAttribute('data-portal-region');
    });
  }

  const record = makeRecord(path, type, element, parentPath, children, descriptors);
  records[path] = record;

  return record;
}

export function parseComponentSubtree(
  element: HTMLElement,
  parentPath: ComponentPath,
  index: number,
  records: Record<string, ComponentRecord>,
  descriptors: DescriptorMap,
): ComponentRecord {
  return parseComponent(element, insertAt(parentPath, index), parentPath, records, descriptors);
}

function parseRootComponent(
  element: HTMLElement,
  records: Record<string, ComponentRecord>,
  descriptors: DescriptorMap,
): ComponentRecord {
  return parseComponent(element, root(), undefined, records, descriptors);
}

export function parseRegionSubtree(
  element: HTMLElement,
  parentPath: ComponentPath,
  records: Record<string, ComponentRecord>,
  descriptors: DescriptorMap,
): ComponentRecord {
  const name = element.dataset.portalRegion;
  const path = append(parentPath, name ?? '');
  const componentElements = collectTrackedDescendants(element, isComponentElement);
  const children: ComponentPath[] = [];

  for (let i = 0; i < componentElements.length; i++) {
    const componentRecord = parseComponentSubtree(componentElements[i], path, i, records, descriptors);
    children.push(componentRecord.path);
  }

  const record = makeRecord(path, 'region', element, parentPath, children, descriptors);
  records[path] = record;

  return record;
}

function parseStandardPage(body: HTMLElement, descriptors: DescriptorMap): Record<string, ComponentRecord> {
  const records: Record<string, ComponentRecord> = {};
  const rootPath = root();
  const rootRegions = collectTrackedDescendants(body, isRegionElement);
  const children: ComponentPath[] = [];

  for (const regionEl of rootRegions) {
    const regionRecord = parseRegionSubtree(regionEl, rootPath, records, descriptors);
    children.push(regionRecord.path);
  }

  records[rootPath] = {
    path: rootPath,
    type: 'page',
    element: body,
    parentPath: undefined,
    children,
    empty: children.length === 0,
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
  };

  return records;
}

function parseFragmentPage(body: HTMLElement, descriptors: DescriptorMap): Record<string, ComponentRecord> {
  const records: Record<string, ComponentRecord> = {};
  const rootComponent = findFirstTrackedDescendant(body, isComponentElement);

  if (!rootComponent) {
    const rootPath = root();
    records[rootPath] = {
      path: rootPath,
      type: 'page',
      element: body,
      parentPath: undefined,
      children: [],
      empty: true,
      error: false,
      descriptor: undefined,
      fragmentContentId: undefined,
      loading: false,
    };

    return records;
  }

  parseRootComponent(rootComponent, records, descriptors);
  return records;
}

export function parsePage(body: HTMLElement, options: ParsePageOptions = {}): Record<string, ComponentRecord> {
  const descriptors = options.descriptors ?? {};

  if (options.fragment) return parseFragmentPage(body, descriptors);
  return parseStandardPage(body, descriptors);
}
