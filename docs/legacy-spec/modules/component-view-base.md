# Module: component-view-base

**Files:** `page-editor/ComponentView.ts`, `page-editor/ComponentItemType.ts`, `page-editor/ComponentViewContextMenuTitle.ts`, `page-editor/ContentBasedComponentView.ts`, `page-editor/DescriptorBasedComponentView.ts`, `page-editor/DescriptorBasedComponentViewPlaceholder.ts`
**LOC:** ~584
**Role:** Base view class for every region-child component. Two subclass hierarchies diverge by data model: descriptor-based (parts, layouts) and content-based (fragments). Adds component-only behaviors: context menu action set, Del/Backspace keyboard shortcuts, hot-swap (`replaceWith`), post-drop reparent (`moveToRegion`), clone/duplicate.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [User-Facing Actions via Context Menu](#user-facing-actions-via-context-menu)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [replaceWith — Hot-Swap](#replacewith--hot-swap)
6. [moveToRegion — Post-Drop Reparent](#movetoregion--post-drop-reparent)
7. [duplicate and clone](#duplicate-and-clone)
8. [Descriptor-Based vs Content-Based](#descriptor-based-vs-content-based)
9. [Special Case: Page-Root Fragment](#special-case-page-root-fragment)
10. [Flag and Branch Audit](#flag-and-branch-audit)
11. [Error Surfaces](#error-surfaces)
12. [Lifecycle Contract for Consumers](#lifecycle-contract-for-consumers)
13. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Base view class for every region-child component. Two subclass hierarchies diverge by data model: `DescriptorBasedComponentView` (parts, layouts — keyed by descriptor) and `ContentBasedComponentView` (fragments — keyed by content id). Adds component-only behaviors on top of `ItemView`: component context-menu action set (Inspect, Reset, Remove, Duplicate, Create Fragment, plus Select parent / Insert from base), **Del/Backspace keyboard shortcuts while selected**, `replaceWith` (hot-swap for reset), `moveToRegion` (reparent after drop), `clone()` / `duplicate()`, path resolution that special-cases the page-root fragment.

Files: `ComponentView.ts:117-433`, `ComponentItemType.ts:4-21`, `ComponentViewContextMenuTitle.ts:5-12`, `ContentBasedComponentView.ts:8-37`, `DescriptorBasedComponentView.ts:7-69`, `DescriptorBasedComponentViewPlaceholder.ts:4-8`.

---

## Public Surface

- `ComponentViewBuilder` with `inspectActionRequired`, `parentRegionView`, `positionIndex`, etc.
- `ComponentView extends ItemView implements Cloneable`.
- `ComponentItemType extends ItemType` — produces `ItemTypeConfig` with selector `[data-portal-component-type=<type>]`, draggable, move cursor, icon `icon-<type>`, context menu config `['parent', 'remove', 'clear', 'duplicate']`.
- `ComponentViewContextMenuTitle` — super with `(name || '', type.getConfig().getIconCls())`.
- `ContentBasedComponentView` (abstract) — adds Edit action.
- `DescriptorBasedComponentView` (abstract) — toggles `has-descriptor` class + empty-descriptor block.
- `DescriptorBasedComponentViewPlaceholder` (abstract) with `getType(): ComponentType`.

---

## User-Facing Actions via Context Menu

`ComponentView.addComponentContextMenuActions(inspectActionRequired)` at `ComponentView.ts:173-219` branches on three flags:
- `isFragmentContent = liveEditParams.isFragment`
- `parentIsPage = parent.equals(PageItemType.get())`
- `isTopFragmentComponent = parentIsPage && isFragmentContent`

**When `isTopFragmentComponent`** (the root fragment of a fragment-mode page): menu contains only (conditional) Inspect + Reset. No select-parent, insert, remove, duplicate, create-fragment. Rationale: the fragment IS the page; removing, duplicating, or re-fragmenting it makes no sense.

**Otherwise**, menu includes: Select parent, Insert, (Inspect if `inspectActionRequired`), Reset, Remove, Duplicate, Create-Fragment (only when `!type.equals(FragmentItemType)` AND `liveEditParams.isFragmentAllowed`).

Each action's effect when the user clicks:
- **Inspect** — fires `ComponentInspectedEvent(path)` (opens inspector panel).
- **Reset** — fires `ResetComponentEvent(path)`. Visibility toggled by `refreshEmptyState` (hidden when empty).
- **Remove** — fires `RemoveComponentRequest(path)`.
- **Duplicate** — `deselect()` first, then fires `DuplicateComponentEvent(path)`.
- **Create Fragment** — `deselect()` first, then fires `CreateFragmentEvent(path)` (promote component to a reusable fragment).

---

## Keyboard Shortcuts

**Del** and **Backspace** — bound only while selected (`select()` calls `KeyBindings.get().bindKeys(keyBinding)`; `deselect()` unbinds). Both map to the same handler which fires `RemoveComponentRequest(path)` — identical to the context-menu Remove action. Constructed eagerly in `initKeyBoardBindings()` but not bound until select.

---

## replaceWith — Hot-Swap

Used by the wizard's reset flow. `replaceWith(replacement)` at `ComponentView.ts`:

1. `unbindMouseListeners()` on the old view.
2. Replace DOM node (`Element.replaceWith`).
3. Branch on `parentIsPage = PageItemType.get().equals(parent.getType())`:
   - **Page-root fragment path**: `pageView.unregisterFragmentComponentView(old)` + `pageView.registerFragmentComponentView(new)`. Does NOT call `notifyItemViewAdded`.
   - **Region path**: capture index, `parentRegion.unregisterComponentView(old)`, `parentRegion.registerComponentView(new, index)`, `parentRegion.notifyItemViewAdded(new)`.
4. If the old view was selected, reselect the new view with the same menuPosition.

The page-root path skips `notifyItemViewAdded` — an asymmetric notification (see `contracts.md` asymmetries).

---

## moveToRegion — Post-Drop Reparent

Used by `LiveEditPage` after a successful drag-drop to reattach a component at its new position. `moveToRegion(toRegionView, toIndex)` at `ComponentView.ts`:

1. Early-return no-op if `parent.path === to.path` AND `toIndex === currentIndex` (same region, same position).
2. `source.unregisterComponentView(this)` → detach from source.
3. Clear `isMoving = false`.
4. `toRegionView.registerComponentView(this, toIndex)` → attach to destination.

---

## duplicate and clone

- `clone()` — creates a sibling view with the same parent + LiveEditParams.
- `duplicate()` — creates a view and inserts at `index + 1`; skips init-on-add (`initOnAdd = false`).

---

## Descriptor-Based vs Content-Based

**DescriptorBasedComponentView** (parts + layouts):
- Tracks a `has-descriptor` class on the DOM root (set based on `component?.hasDescriptor()`).
- When empty AND has descriptor → shows `empty-descriptor-block` (a `DivEl`) inside the placeholder with label from abstract `makeEmptyDescriptorText(component)` override. Part: `'<i18n field.part> "<name>"'`; Layout: `'<i18n field.layout> "<name>"'`.
- `getComponent()` reads from `PageState.getComponentByPath(path)`; returns null on mismatch.

**ContentBasedComponentView** (fragments):
- `editAction = new Action(i18n('action.edit'))` fires `EditContentFromComponentViewEvent(contentId)` where `contentId = liveEditParams.getFragmentIdByPath(path)`.
- Edit action added to menu at construction time only, when `!isEmpty()`.

---

## Special Case: Page-Root Fragment

`getPath()`: returns `ComponentPath.root()` when parent item-view type is `PageItemType`; else `new ComponentPath(index, parentPath)`.

`replaceWith`: page-root path uses `PageView.unregisterFragmentComponentView / registerFragmentComponentView` instead of region APIs, and does not emit `ItemViewAdded`.

Context menu: page-root fragment = truncated action list (Inspect + Reset only).

---

## Flag and Branch Audit

- `ComponentViewBuilder.inspectActionRequired: boolean` — when true, Inspect action is inserted.
- `ComponentViewBuilder.positionIndex: number` (default -1) — when `>= 0`, constructor auto-registers the view with its parent region at that index.
- `static debug: boolean` — gates console traces in `replaceWith` / `moveToRegion`.
- `deselect(silent?)` — key-unbind runs regardless of silent flag.
- `addComponentView(view, index)` always marks new (3rd arg `true`).
- `notifyItemViewAdded(view, isNew=false)` — `isNew` passes through to event.

---

## Error Surfaces

- `refreshEmptyState` requires `resetAction` to exist (assigned before first call in constructor). Fragile to subclass hooks.
- `DescriptorBasedComponentView.getComponent()` returns null on mismatch; caller must handle.
- No explicit throws; errors surface as type/null dereferences.

---

## Lifecycle Contract for Consumers

1. Must construct via builder; `parentRegionView`, `type`, `element`, `parentElement` required.
2. `positionIndex >= 0` auto-registers; otherwise caller must `parent.addComponentView(view, index, ...)`.
3. Context menu actions are frozen after constructor (`addContextMenuActions` can add more).
4. Del/Backspace active only between `select()` and `deselect()`.
5. After `reset()`, the clone is live — the original should not be used.
6. `replaceWith` requires the old view to still be registered.

---

## Suspicious Conditions

- `ComponentView.ts:275-278` — first instanceof check always true since every subclass has ComponentItemType; redundant.
- `ComponentView.ts:325` vs `:175` — `replaceWith` uses `PageItemType.get().equals(parent.getType())`; `addComponentContextMenuActions` uses reverse-order. Non-symmetric `equals` would differ.
- `ComponentView.ts:335` vs `:328-329` — page-root replace path skips `notifyItemViewAdded`.
- `ComponentView.ts:244-253` `remove` — doesn't call local `notifyItemViewRemoved` (listeners on the view being removed go with it anyway).
- `ComponentView.ts:412-414` vs `:419` — `reset` sets `this.empty = true` which is dead (clone recomputes).
- `ContentBasedComponentView.ts:19-23` — Edit action added at constructor only; a fragment that becomes non-empty later won't get it.
- `DescriptorBasedComponentView.ts:16` — `inspectActionRequired` re-declared but constructor-time consumed.
