import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {COMPONENT_SELECTOR, ERROR_ATTR, REGION_SELECTOR} from '../constants';
import type {ComponentRecord, ComponentRecordType} from '../types';
import {isNodeEmpty} from './emptiness';

interface ParsePageOptions {
    isFragment?: boolean;
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

    Array.from(container.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) {
            return;
        }

        if (predicate(child)) {
            result.push(child);
            return;
        }

        result.push(...collectTrackedDescendants(child, predicate));
    });

    return result;
}

function findFirstTrackedDescendant(
    container: HTMLElement,
    predicate: (element: Element) => boolean,
): HTMLElement | undefined {
    for (const child of Array.from(container.children)) {
        if (!(child instanceof HTMLElement)) {
            continue;
        }

        if (predicate(child)) {
            return child;
        }

        const nested = findFirstTrackedDescendant(child, predicate);
        if (nested) {
            return nested;
        }
    }

    return undefined;
}

function resolveDescriptor(path: ComponentPath, type: ComponentRecordType): string | undefined {
    if (type === 'page' || type === 'region') {
        return undefined;
    }

    const component = PageState.getComponentByPath(path) as {
        getDescriptorKey?: () => {toString(): string} | undefined;
        getFragment?: () => {toString(): string} | undefined;
        getName?: () => {toString(): string} | undefined;
    } | null;

    if (!component) {
        return undefined;
    }

    return component.getDescriptorKey?.()?.toString() ??
           component.getFragment?.()?.toString() ??
           component.getName?.()?.toString();
}

function makeRecord(
    path: ComponentPath,
    type: ComponentRecordType,
    element: HTMLElement,
    parentPath: string | undefined,
    children: string[],
): ComponentRecord {
    return {
        path,
        type,
        element,
        parentPath,
        children,
        empty: type === 'region' ? children.length === 0 : isNodeEmpty(element),
        error: element.getAttribute(ERROR_ATTR) === 'true',
        descriptor: resolveDescriptor(path, type),
        loading: false,
    };
}

export function parseComponentSubtree(
    element: HTMLElement,
    parentPath: ComponentPath,
    index: string | number,
    records: Record<string, ComponentRecord>,
): ComponentRecord {
    const type = element.dataset.portalComponentType as ComponentRecordType;
    const path = new ComponentPath(index, parentPath);
    const key = path.toString();
    const children: string[] = [];

    if (type === 'layout') {
        const regions = collectTrackedDescendants(element, isRegionElement);
        regions.forEach((regionEl) => {
            const regionRecord = parseRegionSubtree(regionEl, path, records);
            children.push(regionRecord.path.toString());
        });
    }

    const record = makeRecord(path, type, element, parentPath.toString(), children);
    records[key] = record;

    return record;
}

export function parseRootComponent(
    element: HTMLElement,
    records: Record<string, ComponentRecord>,
): ComponentRecord {
    const type = element.dataset.portalComponentType as ComponentRecordType;
    const path = ComponentPath.root();
    const key = path.toString();
    const children: string[] = [];

    if (type === 'layout') {
        const regions = collectTrackedDescendants(element, isRegionElement);
        regions.forEach((regionEl) => {
            const regionRecord = parseRegionSubtree(regionEl, path, records);
            children.push(regionRecord.path.toString());
        });
    }

    const record = makeRecord(path, type, element, undefined, children);
    records[key] = record;

    return record;
}

export function parseRegionSubtree(
    element: HTMLElement,
    parentPath: ComponentPath,
    records: Record<string, ComponentRecord>,
): ComponentRecord {
    const regionName = element.dataset.portalRegion;
    const path = new ComponentPath(regionName ?? '', parentPath);
    const key = path.toString();
    const componentElements = collectTrackedDescendants(element, isComponentElement);
    const children: string[] = [];

    componentElements.forEach((componentEl, index) => {
        const componentRecord = parseComponentSubtree(componentEl, path, index, records);
        children.push(componentRecord.path.toString());
    });

    const record = makeRecord(path, 'region', element, parentPath.toString(), children);
    records[key] = record;

    return record;
}

function parseStandardPage(body: HTMLElement): Record<string, ComponentRecord> {
    const records: Record<string, ComponentRecord> = {};
    const rootPath = ComponentPath.root();
    const rootKey = rootPath.toString();
    const rootRegions = collectTrackedDescendants(body, isRegionElement);
    const children: string[] = [];

    rootRegions.forEach((regionEl) => {
        const regionRecord = parseRegionSubtree(regionEl, rootPath, records);
        children.push(regionRecord.path.toString());
    });

    records[rootKey] = {
        path: rootPath,
        type: 'page',
        element: body,
        parentPath: undefined,
        children,
        empty: children.length === 0,
        error: body.getAttribute(ERROR_ATTR) === 'true',
        descriptor: undefined,
        loading: false,
    };

    return records;
}

function parseFragmentPage(body: HTMLElement): Record<string, ComponentRecord> {
    const records: Record<string, ComponentRecord> = {};
    const rootComponent = findFirstTrackedDescendant(body, isComponentElement);

    if (!rootComponent) {
        records[ComponentPath.root().toString()] = {
            path: ComponentPath.root(),
            type: 'page',
            element: body,
            parentPath: undefined,
            children: [],
            empty: true,
            error: body.getAttribute(ERROR_ATTR) === 'true',
            descriptor: undefined,
            loading: false,
        };

        return records;
    }

    parseRootComponent(rootComponent, records);
    return records;
}

export function parsePage(body: HTMLElement, options: ParsePageOptions = {}): Record<string, ComponentRecord> {
    if (options.isFragment) {
        return parseFragmentPage(body);
    }

    return parseStandardPage(body);
}
