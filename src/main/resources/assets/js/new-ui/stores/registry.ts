import {atom, map} from 'nanostores';
import type {ComponentRecord, ContextMenuState} from '../types';

export const $registry = map<Record<string, ComponentRecord>>({});
export const $selectedPath = atom<string | undefined>(undefined);
export const $hoveredPath = atom<string | undefined>(undefined);
export const $locked = atom(false);
export const $modifyAllowed = atom(true);
export const $textEditing = atom(false);
export const $contextMenuState = atom<ContextMenuState | undefined>(undefined);

export function getRegistry(): Record<string, ComponentRecord> {
    return $registry.get();
}

export function getRecord(path: string | undefined): ComponentRecord | undefined {
    if (!path) {
        return undefined;
    }

    return getRegistry()[path];
}

export function setRegistry(records: Record<string, ComponentRecord>): void {
    $registry.set(records);
}

export function setRecord(path: string, record: ComponentRecord | undefined): void {
    $registry.setKey(path, record);
}

export function setSelectedPath(path: string | undefined): void {
    $selectedPath.set(path);
}

export function setHoveredPath(path: string | undefined): void {
    $hoveredPath.set(path);
}

export function setLocked(value: boolean): void {
    $locked.set(value);
}

export function setModifyAllowed(value: boolean): void {
    $modifyAllowed.set(value);
}

export function openContextMenu(state: ContextMenuState): void {
    $contextMenuState.set(state);
}

export function closeContextMenu(): void {
    $contextMenuState.set(undefined);
}
