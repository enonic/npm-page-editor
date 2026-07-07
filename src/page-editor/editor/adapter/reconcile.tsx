import type {ComponentRecord} from '../types';

import {ComponentPath} from '../../protocol';
import {markDirty} from '../geometry/scheduler';
import {parsePage} from '../parse/parse-page';
import {parseSubtree} from '../parse/parse-subtree';
import {rebuildIndex} from '../stores/element-index';
import {getParams} from '../stores/params';
import {
    $hoveredPath,
    $selectedPath,
    closeContextMenu,
    getRegistry,
    getRecord,
    setSelectedPath,
    setHoveredPath,
    setRegistry,
} from '../stores/registry';
import {syncPlaceholders} from './placeholder-lifecycle';

const ROOT_PATH = ComponentPath.root().toString();

/** True when `path` is `rootPath` itself or any descendant of it. */
export function isInSubtree(path: string | undefined, rootPath: string): boolean {
    return path != null && (path === rootPath || path.startsWith(`${rootPath}/`));
}

function finalizeReconcile(current: Record<string, ComponentRecord>, records: Record<string, ComponentRecord>): void {
    Object.entries(records).forEach(([path, record]) => {
        const previous = current[path];
        if (previous?.loading) {
            records[path] = {...record, loading: true};
        }
    });

    setRegistry(records);
    rebuildIndex(records);
    syncPlaceholders(records);

    if ($selectedPath.get() && !getRecord($selectedPath.get())) {
        setSelectedPath(undefined);
        closeContextMenu();
    }

    if ($hoveredPath.get() && !getRecord($hoveredPath.get())) {
        setHoveredPath(undefined);
    }

    markDirty();
}

let pageRoot: HTMLElement | undefined;

/** The page root element reconciled against; seeded by the boot module. */
export function setPageRoot(element: HTMLElement | undefined): void {
    pageRoot = element;
}

function getPageRoot(): HTMLElement {
    return pageRoot ?? document.body;
}

export function reconcilePage(): void {
    const records = parsePage(getPageRoot(), {
        isFragment: getParams()?.isFragment,
    });
    const current = getRegistry();
    finalizeReconcile(current, records);
}

export function reconcileSubtree(rootPath: string | undefined): void {
    if (!rootPath || rootPath === ROOT_PATH) {
        reconcilePage();
        return;
    }

    const current = getRegistry();
    const rootRecord = current[rootPath];
    if (!rootRecord?.element || !rootRecord.element.isConnected) {
        reconcilePage();
        return;
    }

    const freshRecords = parseSubtree(rootRecord.element, rootRecord.path, {
        isFragment: getParams()?.isFragment,
    });
    const nextRecords: Record<string, ComponentRecord> = {};

    Object.entries(current).forEach(([path, record]) => {
        if (!isInSubtree(path, rootPath)) {
            nextRecords[path] = record;
        }
    });

    Object.assign(nextRecords, freshRecords);

    finalizeReconcile(current, nextRecords);
}

function updateRecord(path: string, patch: Partial<ComponentRecord>): void {
    const record = getRecord(path);
    if (!record) {
        return;
    }

    const nextRecords = {
        ...getRegistry(),
        [path]: {
            ...record,
            ...patch,
        },
    };

    setRegistry(nextRecords);
    syncPlaceholders(nextRecords);
}

export function markLoading(path: string, loading: boolean): void {
    updateRecord(path, {loading});
}

export function markError(path: string, error: boolean): void {
    updateRecord(path, {error});
}

export function remapInteractionPath(fromPath: string, toPath: string): string | undefined {
    const selected = $selectedPath.get();
    if (selected === fromPath) {
        setSelectedPath(toPath);
        return toPath;
    }
    if (selected?.startsWith(`${fromPath}/`)) {
        const remapped = `${toPath}${selected.slice(fromPath.length)}`;
        setSelectedPath(remapped);
        return remapped;
    }
    return undefined;
}

/**
 * After a component is removed, its later siblings reindex down by one. Shift any
 * selection or hover pointing into that tail so it keeps tracking the same
 * component instead of silently pointing at the next one (or being cleared as
 * stale by `finalizeReconcile`).
 */
export function shiftInteractionAfterRemoval(removedPath: string): void {
    const removed = ComponentPath.fromString(removedPath);
    const removedIndex = removed.getComponentIndex();
    const parent = removed.getParentPath();
    if (removedIndex == null || parent == null) return;

    const prefix = parent.isRoot() ? '' : parent.toString();

    const shift = (current: string | undefined): string | undefined => {
        if (current == null || !current.startsWith(`${prefix}/`)) return undefined;

        const rest = current.slice(prefix.length + 1);
        const slash = rest.indexOf('/');
        const head = slash === -1 ? rest : rest.slice(0, slash);
        const tail = slash === -1 ? '' : rest.slice(slash);

        const index = Number(head);
        if (!Number.isInteger(index) || index <= removedIndex) return undefined;

        return `${prefix}/${index - 1}${tail}`;
    };

    const nextSelected = shift($selectedPath.get());
    if (nextSelected != null) setSelectedPath(nextSelected);

    const nextHovered = shift($hoveredPath.get());
    if (nextHovered != null) setHoveredPath(nextHovered);
}
