import type {ComponentRecord, DragState, PlaceholderIsland} from '../types';

import {ComponentPlaceholder} from '../components/placeholders/ComponentPlaceholder';
import {LoadingOverlayPlaceholder} from '../components/placeholders/LoadingOverlayPlaceholder';
import {LoadingPlaceholder} from '../components/placeholders/LoadingPlaceholder';
import {RegionPlaceholder} from '../components/placeholders/RegionPlaceholder';
import {createPlaceholderIsland} from '../rendering/placeholder-island';
import {$dragState, getRegistry} from '../stores/registry';

const placeholderIslands = new Map<string, PlaceholderIsland>();
const placeholderKinds = new Map<string, string>();

function isLoadingOverlay(record: ComponentRecord): boolean {
    return Boolean(record.loading) && !record.error && !record.empty && record.type !== 'region';
}

function getPlaceholderKind(record: ComponentRecord): string {
    if (record.type === 'region') return 'region';
    if (isLoadingOverlay(record)) return 'loading-overlay';
    if (record.loading && !record.error) return 'loading';
    return `component:${record.type}:${record.error ? '1' : '0'}:${record.descriptor ?? ''}`;
}

function isRegionDraggedEmpty(record: ComponentRecord, dragState: DragState | undefined): boolean {
    // ? A region whose sole remaining child is the drag source is visually
    //   empty, since the source element is hidden during the drag.
    const sourcePath = dragState?.sourcePath;
    if (!sourcePath || record.type !== 'region' || record.children.length === 0) {
        return false;
    }

    return record.children.every(childPath => childPath === sourcePath);
}

function shouldShowPlaceholder(path: string, record: ComponentRecord, dragState: DragState | undefined): boolean {
    if (record.type === 'page') return false;

    // ? While a region is the active drop target, the drag placeholder (mounted
    //   in its own anchor) is the sole occupant. Destroy the region placeholder
    //   host so its empty box does not stack above the drag placeholder.
    if (record.type === 'region' && dragState?.targetPath === path) return false;

    if (record.empty || record.error || record.loading) return true;

    return isRegionDraggedEmpty(record, dragState);
}

function destroyPlaceholder(path: string): void {
    const island = placeholderIslands.get(path);
    if (!island) {
        return;
    }

    island.unmount();
    placeholderIslands.delete(path);
    placeholderKinds.delete(path);
}

export function syncPlaceholders(records: Record<string, ComponentRecord>): void {
    const dragState = $dragState.get();
    const nextPaths = new Set<string>();

    Object.entries(records).forEach(([path, record]) => {
        if (!record.element || !shouldShowPlaceholder(path, record, dragState)) {
            destroyPlaceholder(path);
            return;
        }

        nextPaths.add(path);

        const kind = getPlaceholderKind(record);
        const currentIsland = placeholderIslands.get(path);
        if (
            currentIsland?.container === record.element &&
            currentIsland.host.isConnected &&
            placeholderKinds.get(path) === kind
        ) {
            return;
        }

        destroyPlaceholder(path);

        const overlay = isLoadingOverlay(record);
        const content =
            record.type === 'region' ? (
                <RegionPlaceholder path={path} regionName={String(record.path.getPath())} />
            ) : overlay ? (
                <LoadingOverlayPlaceholder />
            ) : record.loading && !record.error ? (
                <LoadingPlaceholder />
            ) : (
                <ComponentPlaceholder type={record.type} descriptor={record.descriptor} error={record.error} />
            );

        placeholderIslands.set(path, createPlaceholderIsland(record.element, content, {overlay}));
        placeholderKinds.set(path, kind);
    });

    Array.from(placeholderIslands.keys()).forEach(path => {
        if (!nextPaths.has(path)) {
            destroyPlaceholder(path);
        }
    });
}

export function destroyPlaceholders(): void {
    Array.from(placeholderIslands.keys()).forEach(path => destroyPlaceholder(path));
}

export function initPlaceholderDragSync(): () => void {
    let lastSourcePath = $dragState.get()?.sourcePath;
    let lastTargetPath = $dragState.get()?.targetPath;

    return $dragState.listen(state => {
        const sourcePath = state?.sourcePath;
        const targetPath = state?.targetPath;
        if (sourcePath === lastSourcePath && targetPath === lastTargetPath) return;

        lastSourcePath = sourcePath;
        lastTargetPath = targetPath;
        syncPlaceholders(getRegistry());
    });
}
