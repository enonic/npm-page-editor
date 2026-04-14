import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state/registry';
import type {DescriptorMap} from './parse-page';

import {componentIndex, parent} from '../protocol';
import {isComponentElement, isRegionElement, parseComponentSubtree, parsePage, parseRegionSubtree} from './parse-page';

type ParseSubtreeOptions = {
  fragment?: boolean;
  descriptors?: DescriptorMap;
};

export function parseSubtree(
  rootElement: HTMLElement,
  rootPath: ComponentPath,
  options: ParseSubtreeOptions = {},
): Record<string, ComponentRecord> {
  if (rootPath === '/') return parsePage(rootElement.ownerDocument.body, options);

  const parentPath = parent(rootPath);
  if (parentPath == null) return {};

  const records: Record<string, ComponentRecord> = {};
  const descriptors = options.descriptors ?? {};

  if (isRegionElement(rootElement)) {
    parseRegionSubtree(rootElement, parentPath, records, descriptors);
    return records;
  }

  if (isComponentElement(rootElement)) {
    const index = componentIndex(rootPath);
    if (index != null) {
      parseComponentSubtree(rootElement, parentPath, index, records, descriptors);
    }
  }

  return records;
}
