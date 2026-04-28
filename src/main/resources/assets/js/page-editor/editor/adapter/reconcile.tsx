import type {PageView} from '../../PageView';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {markDirty} from '../geometry/scheduler';
import {parsePage} from '../parse/parse-page';
import {parseSubtree} from '../parse/parse-subtree';
import {rebuildIndex} from '../stores/element-index';
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
import type {ComponentRecord} from '../types';
import {syncPlaceholders} from './placeholder-lifecycle';

const ROOT_PATH = ComponentPath.root().toString();

function isInSubtree(path: string, rootPath: string): boolean {
    return path === rootPath || path.startsWith(`${rootPath}/`);
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

export function reconcilePage(pageView: PageView): void {
    const records = parsePage(pageView.getHTMLElement(), {
        isFragment: pageView.getLiveEditParams().isFragment,
    });
    const current = getRegistry();
    finalizeReconcile(current, records);
}

export function reconcileSubtree(pageView: PageView, rootPath: string | undefined): void {
    if (!rootPath || rootPath === ROOT_PATH) {
        reconcilePage(pageView);
        return;
    }

    const current = getRegistry();
    const rootRecord = current[rootPath];
    if (!rootRecord?.element || !rootRecord.element.isConnected) {
        reconcilePage(pageView);
        return;
    }

    const freshRecords = parseSubtree(rootRecord.element, rootRecord.path, {
        isFragment: pageView.getLiveEditParams().isFragment,
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

export function remapInteractionPath(fromPath: string, toPath: string): void {
    const selected = $selectedPath.get();
    if (selected === fromPath) {
        setSelectedPath(toPath);
    } else if (selected?.startsWith(`${fromPath}/`)) {
        setSelectedPath(`${toPath}${selected.slice(fromPath.length)}`);
    }
}

