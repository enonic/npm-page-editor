/**
 * Builds context-menu content as plain data from the editor stores. `run`
 * handlers post protocol messages to the host (paths as strings).
 */

import type {InsertMenuKind} from '../../protocol';
import type {ComponentRecord, ComponentRecordType} from '../types';

import {ComponentPath, getFragmentIdAt} from '../../protocol';
import {i18n} from '../i18n';
import {getPage} from '../stores/page';
import {getParams} from '../stores/params';
import {closeContextMenu, getRecord, setSelectedPath} from '../stores/registry';
import {getBus} from '../transport/bus';

export type MenuItem = {
    id: string;
    label: string;
    icon?: InsertMenuKind;
    disabled?: boolean;
    children?: MenuItem[];
    run?: () => void;
};

const ROOT_PATH = ComponentPath.root().toString();

//
// * Helpers
//

/**
 * Silently deselect the active item, matching the drag code's silent deselect.
 * Used before duplicate/create-fragment/detach.
 */
function deselect(): void {
    setSelectedPath(undefined);
}

/**
 * Resets a region by asking the host to remove each child component — the host
 * updates its page model and echoes `remove-component`, which removes the DOM.
 * Children are posted in reverse order so earlier removals don't shift the
 * paths of later siblings.
 */
function resetRegion(record: ComponentRecord): void {
    setSelectedPath(undefined);
    closeContextMenu();

    const bus = getBus();
    for (const childPath of [...record.children].reverse()) {
        bus?.post('remove-component-requested', {path: childPath});
    }
}

function isFragmentMode(): boolean {
    return Boolean(getParams()?.isFragment);
}

/**
 * True for the top-level component of a page rendered in fragment mode. The
 * fragment root is the `/` component record with no parent, so we match on a
 * missing `parentPath` plus fragment mode.
 */
function isTopFragmentComponent(record: ComponentRecord): boolean {
    return isFragmentMode() && record.parentPath == null;
}

/**
 * Whether the host may be asked to remove the record: pages and regions are
 * never removable, nor is the top-level component in fragment mode. Shared by
 * the context menu and the keyboard Delete/Backspace path.
 */
export function isRemovableComponent(record: ComponentRecord | undefined): record is ComponentRecord {
    if (record == null || record.type === 'page' || record.type === 'region') return false;

    return !isTopFragmentComponent(record);
}

/**
 * Index of a component within its parent region. The path's leaf segment may be
 * a string, so derive the numeric index from the region's ordered `children`.
 */
function getComponentIndex(path: string, record: ComponentRecord): number {
    const region = getRecord(record.parentPath);
    const index = region?.children.indexOf(path) ?? -1;
    return index >= 0 ? index : Number(record.path.getPath());
}

//
// * Insert submenu
//

/**
 * Whether the layout entry is offered for the given target region: the region
 * must be top-level (its parent is not a layout) and the page must not be in
 * fragment mode.
 */
function isLayoutInsertable(targetRegion: ComponentRecord | undefined): boolean {
    if (isFragmentMode()) return false;

    const parent = getRecord(targetRegion?.parentPath);
    return parent?.type !== 'layout';
}

function makeInsertChild(kind: InsertMenuKind, insertPath: string): MenuItem {
    return {
        id: `insert/${kind}`,
        label: i18n(`field.${kind}`),
        icon: kind,
        run: () => {
            getBus()?.post('add-component-requested', {path: insertPath, kind});
        },
    };
}

/**
 * Builds the `insert` parent item and its children. `targetRegion` is the
 * region a new component lands in; `insertPath` is the string path passed to
 * `add-component-requested`.
 */
function buildInsertItem(targetRegion: ComponentRecord | undefined, insertIndex: number, regionPath: string): MenuItem {
    const insertPath = `${regionPath}/${insertIndex}`;

    const children: MenuItem[] = [makeInsertChild('part', insertPath)];

    if (isLayoutInsertable(targetRegion)) {
        children.push(makeInsertChild('layout', insertPath));
    }
    if (getParams()?.enableTextComponent) {
        children.push(makeInsertChild('text', insertPath));
    }
    children.push(makeInsertChild('fragment', insertPath));

    return {
        id: 'insert',
        label: i18n('widget.components.insert'),
        children,
    };
}

//
// * Select parent
//

function buildSelectParentItem(): MenuItem {
    // Handling lives in the ActionItems "Select parent" special flow (silent
    // retarget + reopen + pulse), keyed by this id. No `run` is needed.
    return {
        id: 'select-parent',
        label: i18n('live.view.selectparent'),
    };
}

//
// * Region
//

function buildRegionMenuItems(path: string, record: ComponentRecord): MenuItem[] {
    const items: MenuItem[] = [buildSelectParentItem(), buildInsertItem(record, 0, path)];

    if (!record.empty) {
        items.push({
            id: 'reset',
            label: i18n('live.view.reset'),
            run: () => resetRegion(record),
        });
    }

    return items;
}

//
// * Component
//

const INSPECTABLE_KINDS: ReadonlySet<ComponentRecordType> = new Set(['part', 'layout', 'fragment']);

function buildComponentMenuItems(path: string, record: ComponentRecord): MenuItem[] {
    const items: MenuItem[] = [];
    const topFragment = isTopFragmentComponent(record);

    if (!topFragment) {
        items.push(buildSelectParentItem());

        const targetRegion = getRecord(record.parentPath);
        const insertIndex = getComponentIndex(path, record) + 1;
        items.push(buildInsertItem(targetRegion, insertIndex, record.parentPath ?? ''));
    }

    if (INSPECTABLE_KINDS.has(record.type)) {
        items.push({
            id: 'inspect',
            label: i18n('live.view.inspect'),
            run: () => {
                getBus()?.post('component-inspect-requested', {path});
            },
        });
    }

    if (!record.empty) {
        items.push({
            id: 'reset',
            label: i18n('live.view.reset'),
            run: () => {
                getBus()?.post('reset-component-requested', {path});
            },
        });
    }

    if (!topFragment) {
        items.push({
            id: 'remove',
            label: i18n('live.view.remove'),
            run: () => {
                getBus()?.post('remove-component-requested', {path});
            },
        });

        items.push({
            id: 'duplicate',
            label: i18n('live.view.duplicate'),
            run: () => {
                deselect();
                getBus()?.post('duplicate-component-requested', {path});
            },
        });
    }

    if (record.type !== 'fragment' && getParams()?.isFragmentAllowed) {
        items.push({
            id: 'create-fragment',
            label: i18n('action.component.create.fragment'),
            run: () => {
                deselect();
                getBus()?.post('create-fragment-requested', {path});
            },
        });
    }

    appendKindSpecificItems(items, path, record);

    return items;
}

/**
 * Appends the kind-specific items: a text component gets `edit` (when not
 * empty); a fragment gets `detach` then `edit`, in that order. An errored
 * fragment keeps both items but renders them disabled (legacy parity).
 */
function appendKindSpecificItems(items: MenuItem[], path: string, record: ComponentRecord): void {
    if (record.type === 'text' && !record.empty) {
        items.push({
            id: 'edit',
            label: i18n('action.edit'),
            run: () => {
                getBus()?.post('text-edit-requested', {path});
            },
        });
    }

    if (record.type === 'fragment' && !record.empty) {
        items.push({
            id: 'detach',
            label: i18n('action.component.detach.fragment'),
            disabled: record.error,
            run: () => {
                deselect();
                getBus()?.post('detach-fragment-requested', {path});
            },
        });

        const contentId = getFragmentIdAt(getPage(), path);
        items.push({
            id: 'edit',
            label: i18n('action.edit'),
            disabled: record.error,
            run: () => {
                getBus()?.post('edit-content-requested', {contentId: contentId ?? ''});
            },
        });
    }
}

//
// * Page
//

function buildPageMenuItems(record: ComponentRecord): MenuItem[] {
    const params = getParams();

    const items: MenuItem[] = [
        {
            id: 'inspect',
            label: i18n('live.view.inspect'),
            run: () => {
                getBus()?.post('component-inspect-requested', {path: ROOT_PATH});
            },
        },
    ];

    if (!(isFragmentMode() && record.empty)) {
        items.push({
            id: 'reset',
            label: i18n('live.view.reset'),
            disabled: !params?.isResetEnabled,
            run: () => {
                getBus()?.post('page-reset-requested', {});
            },
        });
    }

    if (!params?.isPageTemplate && !isFragmentMode()) {
        items.push({
            id: 'save-as-template',
            label: i18n('action.saveAsTemplate'),
            run: () => {
                getBus()?.post('save-as-template-requested', {});
            },
        });
    }

    return items;
}

//
// * Public API
//

export function buildLockedPageMenuItems(): MenuItem[] {
    return [
        {
            id: 'page-settings',
            label: i18n('action.page.settings'),
            run: () => {
                getBus()?.post('component-inspect-requested', {path: ROOT_PATH});
            },
        },
    ];
}

export function buildMenuItems(path: string): MenuItem[] {
    const record = getRecord(path);
    if (record == null) return [];

    if (record.type === 'page') return buildPageMenuItems(record);

    if (record.type === 'region') return buildRegionMenuItems(path, record);

    return buildComponentMenuItems(path, record);
}
