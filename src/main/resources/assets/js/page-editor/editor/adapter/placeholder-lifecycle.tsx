import {ComponentPlaceholder} from '../components/placeholders/ComponentPlaceholder';
import {RegionPlaceholder} from '../components/placeholders/RegionPlaceholder';
import {createPlaceholderIsland} from '../rendering/placeholder-island';
import {$dragState, getRegistry} from '../stores/registry';
import type {ComponentRecord, DragState, PlaceholderIsland} from '../types';

const placeholderIslands = new Map<string, PlaceholderIsland>();

function isRegionDraggedEmpty(record: ComponentRecord, dragState: DragState | undefined): boolean {
    // ? Mirrors legacy RegionView.hasOnlyMovingComponentViews — a region whose
    //   sole remaining child is the drag source is visually empty, since the
    //   source element is hidden during the drag.
    const sourcePath = dragState?.sourcePath;
    if (!sourcePath || record.type !== 'region' || record.children.length === 0) {
        return false;
    }

    return record.children.every((childPath) => childPath === sourcePath);
}

function shouldShowPlaceholder(record: ComponentRecord, dragState: DragState | undefined): boolean {
    if (record.type === 'page') return false;
    if (record.empty || record.error) return true;

    return isRegionDraggedEmpty(record, dragState);
}

function destroyPlaceholder(path: string): void {
    const island = placeholderIslands.get(path);
    if (!island) {
        return;
    }

    island.unmount();
    placeholderIslands.delete(path);
}

export function syncPlaceholders(records: Record<string, ComponentRecord>): void {
    const dragState = $dragState.get();
    const nextPaths = new Set<string>();

    Object.entries(records).forEach(([path, record]) => {
        if (!record.element || !shouldShowPlaceholder(record, dragState)) {
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
            ? <RegionPlaceholder path={path} regionName={String(record.path.getPath())} />
            : <ComponentPlaceholder type={record.type} descriptor={record.descriptor} error={record.error} />;

        placeholderIslands.set(path, createPlaceholderIsland(record.element, content));
    });

    Array.from(placeholderIslands.keys()).forEach((path) => {
        if (!nextPaths.has(path)) {
            destroyPlaceholder(path);
        }
    });
}

export function destroyPlaceholders(): void {
    Array.from(placeholderIslands.keys()).forEach((path) => destroyPlaceholder(path));
}

export function initPlaceholderDragSync(): () => void {
    let lastSourcePath = $dragState.get()?.sourcePath;

    return $dragState.listen((state) => {
        const sourcePath = state?.sourcePath;
        if (sourcePath === lastSourcePath) return;

        lastSourcePath = sourcePath;
        syncPlaceholders(getRegistry());
    });
}
