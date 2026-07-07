/**
 * Single subscription per protocol message: binds host → editor messages to
 * store mutations and native DOM mutations, then reconciles so the registry
 * catches up.
 */

import type {EditorBus} from '../../protocol';

import {emit} from '../../event/editorEvents';
import {ComponentPath} from '../../protocol';
import {
    addComponentElement,
    duplicateComponentElement,
    moveComponentElement,
    removeComponentElement,
    resetComponentElement,
    setTextComponentHtml,
} from '../dom/mutate';
import {scrollComponentIntoView} from '../dom/scroll';
import {childPath} from '../parse/parse-page';
import {setPage} from '../stores/page';
import {
    $hoveredPath,
    $locked,
    $selectedPath,
    closeContextMenu,
    getRecord,
    setHoveredPath,
    setLocked,
    setModifyAllowed,
    setSelectedPath,
} from '../stores/registry';
import {dispatchComponentDeselected, dispatchComponentSelected} from '../transport/dispatch';
import {
    isInSubtree,
    markLoading,
    reconcilePage,
    reconcileSubtree,
    remapInteractionPath,
    shiftInteractionAfterRemoval,
} from './reconcile';

export function registerBusHandlers(bus: EditorBus): () => void {
    const cleanup: Array<() => void> = [];
    const reconcilePath = (path: string | undefined): void => {
        if (!path) {
            reconcilePage();
            return;
        }

        reconcileSubtree(path);
    };
    const reconcileParentPath = (path: ComponentPath): void => {
        reconcilePath(path.getParentPath()?.toString());
    };

    cleanup.push(
        bus.on('select-component', payload => {
            if (!payload.path) {
                return;
            }

            setSelectedPath(payload.path);
            scrollComponentIntoView(payload.path);
        }),
    );

    cleanup.push(
        bus.on('deselect-component', payload => {
            // A targeted deselect of a path that is no longer selected must not
            // wipe a newer selection the user made in the meantime.
            if (payload.path != null && payload.path !== $selectedPath.get()) {
                return;
            }

            setSelectedPath(undefined);
            closeContextMenu();
        }),
    );

    cleanup.push(
        bus.on('add-component', payload => {
            const path = ComponentPath.fromString(payload.path);
            addComponentElement(path, payload.kind);
            reconcileParentPath(path);

            // A freshly created component is selected so the host opens its inspector.
            window.queueMicrotask(() => {
                if (getRecord(payload.path)) {
                    dispatchComponentSelected(payload.path);
                }
            });
        }),
    );

    cleanup.push(
        bus.on('remove-component', payload => {
            const removedPath = payload.path;

            if (isInSubtree($selectedPath.get(), removedPath)) {
                dispatchComponentDeselected(ComponentPath.root().toString());
            }

            if (isInSubtree($hoveredPath.get(), removedPath)) {
                setHoveredPath(undefined);
            }

            // Later siblings reindex on reconcile; keep selection/hover on the same component.
            shiftInteractionAfterRemoval(removedPath);

            removeComponentElement(removedPath);
            reconcileParentPath(ComponentPath.fromString(removedPath));
        }),
    );

    cleanup.push(
        bus.on('move-component', payload => {
            const toPath = payload.to;
            const toComponentPath = ComponentPath.fromString(toPath);

            moveComponentElement(payload.from, toPath);
            remapInteractionPath(payload.from, toPath);

            const fromParent = ComponentPath.fromString(payload.from).getParentPath()?.toString();
            const toParent = toComponentPath.getParentPath()?.toString();
            reconcilePath(fromParent);
            if (fromParent && fromParent !== toParent) {
                reconcilePath(toParent);
            }

            // Re-select the moved component after the DOM move and reparse settle.
            window.queueMicrotask(() => {
                dispatchComponentSelected(toPath);
            });
        }),
    );

    cleanup.push(
        bus.on('load-component', payload => {
            markLoading(payload.path, true);
            emit('component-load-request', {
                path: ComponentPath.fromString(payload.path),
                isExisting: payload.existing ?? false,
            });
        }),
    );

    cleanup.push(
        bus.on('duplicate-component', payload => {
            const newPath = payload.path;
            const newComponentPath = ComponentPath.fromString(newPath);

            // The duplicate lands as the next sibling in an empty state and the host
            // loads its HTML, so the source is the immediately preceding sibling at
            // `<parent>/<index - 1>`.
            const parentPath = newComponentPath.getParentPath();
            const sourceIndex = Number(newComponentPath.getPath()) - 1;
            if (parentPath != null && !Number.isNaN(sourceIndex) && sourceIndex >= 0) {
                duplicateComponentElement(childPath(parentPath, sourceIndex).toString());
            }
            reconcileParentPath(newComponentPath);

            // Select the duplicated component after the DOM insert and reparse settle.
            window.queueMicrotask(() => {
                scrollComponentIntoView(newPath);
                dispatchComponentSelected(newPath);
            });
        }),
    );

    cleanup.push(
        bus.on('reset-component', payload => {
            resetComponentElement(payload.path);
            reconcilePath(payload.path);
        }),
    );

    cleanup.push(
        bus.on('set-page-lock-state', payload => {
            setLocked(payload.locked);
        }),
    );

    cleanup.push(
        bus.on('set-modify-allowed', payload => {
            setModifyAllowed(payload.allowed);

            if (!payload.allowed) {
                setLocked(true);
            }
        }),
    );

    cleanup.push(
        bus.on('page-state', payload => {
            setPage(payload.page ?? undefined);
            reconcilePage();
        }),
    );

    cleanup.push(
        bus.on('update-text-component', payload => {
            if (payload.origin === 'live') {
                return;
            }

            setTextComponentHtml(payload.path, payload.text);
            window.queueMicrotask(() => reconcilePath(payload.path));
        }),
    );

    cleanup.push(
        bus.on('set-component-state', payload => {
            markLoading(payload.path, payload.processing);
        }),
    );

    // Announce every lock transition regardless of its origin (host message,
    // init params), matching the legacy PageLocked/PageUnlocked events.
    cleanup.push(
        $locked.listen(locked => {
            bus.post(locked ? 'page-locked' : 'page-unlocked', {});
        }),
    );

    return () => {
        cleanup.forEach(fn => fn());
    };
}
