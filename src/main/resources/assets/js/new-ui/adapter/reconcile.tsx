import type {PageView} from '../../page-editor/PageView';
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
import type {ComponentRecord, PlaceholderIsland} from '../types';
import {createPlaceholderIsland} from '../rendering/placeholder-island';
import {ComponentPlaceholder} from '../components/placeholders/ComponentPlaceholder';
import {RegionPlaceholder} from '../components/placeholders/RegionPlaceholder';

const placeholderIslands = new Map<string, PlaceholderIsland>();
const ROOT_PATH = ComponentPath.root().toString();

function shouldShowPlaceholder(record: ComponentRecord): boolean {
    return record.type !== 'page' && (record.empty || record.error);
}

function destroyPlaceholder(path: string): void {
    const island = placeholderIslands.get(path);
    if (!island) {
        return;
    }

    island.unmount();
    placeholderIslands.delete(path);
}

function isInSubtree(path: string, rootPath: string): boolean {
    return path === rootPath || path.startsWith(`${rootPath}/`);
}

function syncPlaceholders(records: Record<string, ComponentRecord>): void {
    const nextPaths = new Set<string>();

    Object.entries(records).forEach(([path, record]) => {
        if (!record.element || !shouldShowPlaceholder(record)) {
            destroyPlaceholder(path);
            return;
        }

        nextPaths.add(path);

        const currentIsland = placeholderIslands.get(path);
        if (currentIsland?.container === record.element && currentIsland.host.isConnected) {
            return;
        }

        destroyPlaceholder(path);

        const content = record.type === 'region'
            ? <RegionPlaceholder regionName={String(record.path.getPath())} />
            : <ComponentPlaceholder type={record.type} descriptor={record.descriptor} error={record.error} />;

        placeholderIslands.set(path, createPlaceholderIsland(record.element, content));
    });

    Array.from(placeholderIslands.keys()).forEach((path) => {
        if (!nextPaths.has(path)) {
            destroyPlaceholder(path);
        }
    });
}

function finalizeReconcile(current: Record<string, ComponentRecord>, records: Record<string, ComponentRecord>): void {
    Object.entries(records).forEach(([path, record]) => {
        const previous = current[path];
        if (previous?.loading) {
            record.loading = true;
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
    const records = parsePage(pageView.getHTMLElement());
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

    const freshRecords = parseSubtree(rootRecord.element, rootRecord.path);
    const nextRecords: Record<string, ComponentRecord> = {};

    Object.entries(current).forEach(([path, record]) => {
        if (!isInSubtree(path, rootPath)) {
            nextRecords[path] = record;
        }
    });

    Object.assign(nextRecords, freshRecords);

    finalizeReconcile(current, nextRecords);
}

export function markLoading(path: string, loading: boolean): void {
    const record = getRecord(path);
    if (!record) {
        return;
    }

    setRegistry({
        ...getRegistry(),
        [path]: {
            ...record,
            loading,
        },
    });
}

export function remapInteractionPath(fromPath: string, toPath: string): void {
    const selected = $selectedPath.get();
    if (selected === fromPath) {
        setSelectedPath(toPath);
    } else if (selected?.startsWith(`${fromPath}/`)) {
        setSelectedPath(`${toPath}${selected.slice(fromPath.length)}`);
    }
}

export function destroyPlaceholders(): void {
    Array.from(placeholderIslands.keys()).forEach((path) => destroyPlaceholder(path));
}
