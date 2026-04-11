import type {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {COMPONENT_SELECTOR, REGION_SELECTOR} from '../constants';
import type {ComponentRecord} from '../types';
import {
    parseComponentSubtree,
    parsePage,
    parseRegionSubtree,
} from './parse-page';

export function parseSubtree(rootElement: HTMLElement, rootPath: ComponentPath): Record<string, ComponentRecord> {
    if (rootPath.isRoot()) {
        return parsePage(rootElement.ownerDocument.body);
    }

    const parentPath = rootPath.getParentPath();
    if (!parentPath) {
        return {};
    }

    const records: Record<string, ComponentRecord> = {};

    if (rootElement.matches(REGION_SELECTOR)) {
        parseRegionSubtree(rootElement, parentPath, records);
        return records;
    }

    if (rootElement.matches(COMPONENT_SELECTOR)) {
        parseComponentSubtree(rootElement, parentPath, rootPath.getPath(), records);
    }

    return records;
}
