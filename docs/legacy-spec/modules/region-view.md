# Module: region-view

**Files:** `page-editor/RegionView.ts`, `page-editor/RegionPlaceholder.ts`, `page-editor/RegionViewContextMenuTitle.ts`
**LOC:** ~502
**Role:** Represents a `data-portal-region` element as a live-editable container of ordered `ComponentView` children. Parses initial children, exposes add/remove/empty operations, re-emits child add/remove events upward, toggles placeholder/highlight state during drag, and offers a context-menu surface.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [User-Facing States](#user-facing-states)
4. [Context Menu](#context-menu)
5. [Parse Flow](#parse-flow)
6. [Add / Remove Bubbling](#add--remove-bubbling)
7. [Flag and Branch Audit](#flag-and-branch-audit)
8. [Error Surfaces](#error-surfaces)
9. [Lifecycle Contract for Consumers](#lifecycle-contract-for-consumers)
10. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Represents an element annotated with `data-portal-region` in the edited iframe as a live-editable container of ordered `ComponentView` children. Parses initial children into typed component views, exposes add/remove/empty operations, re-emits child add/remove events upward for `PageView`-level aggregation, toggles placeholder/highlight visual state during drag, and offers a context-menu surface (select parent, insert, reset). Files: `RegionView.ts:64-480`, `RegionPlaceholder.ts:5-19`, `RegionViewContextMenuTitle.ts:4-11`.

---

## Public Surface

- `RegionViewBuilder` with fluent setters.
- `RegionView extends ItemView`.
- `RegionPlaceholder extends ItemViewPlaceholder` — adds class `region-placeholder` and `<p>` with `i18n('live.view.drag.drophere')`.
- `RegionViewContextMenuTitle extends ItemViewContextMenuTitle` — composes region name + `RegionItemType` icon class.

Key methods:
- `getRegionName(): string`, `getName(): string` (fallback i18n noname), `getPath(): ComponentPath`.
- `registerComponentView(view, index?)`, `registerComponentViewInParent(view, index?)`, `unregisterComponentView(view)` (throws if not found).
- `addComponentView(view, index, newlyCreated=false, _dragged?)` — DOM insert + register + notifyAdded + refreshEmptyState.
- `removeComponentView(view, silent=false)` — unregister + optional DOM detach + refresh. `silent=true` used during drag (DOM is repositioned, not destroyed).
- `getComponentViewByPath(path)` — first path match; else recurse into layouts.
- `isEmpty()` — empty array OR all-moving children.
- `empty()` — removes every child.
- `toItemViewArray()` — flat list self + all descendants.
- `remove()` — unhooks mouseOver listener + super.remove.
- `onItemViewAdded/un/notifyItemViewAdded`, `onItemViewRemoved/un/notifyItemViewRemoved`.

---

## User-Facing States

1. **Empty** — `RegionPlaceholder` with "drop here" text and class `region-placeholder`; region has class `empty` from base.
2. **Filled** — children render normally; class `region-view` always present.
3. **Dragged-over** — during `DragAndDrop.isDragging()`, if mouseover lands on an element whose nearest `data-portal-region` ancestor is this region, `highlight()` is called (which applies the `dragged-over` class via ItemView).

The region itself is not draggable (`isDraggableView() === false` inherited).

---

## Context Menu

Actions (from `addRegionContextMenuActions`):
- **Select parent** (inherited `createSelectParentAction`).
- **Insert** (inherited `createInsertAction`).
- **Reset** — `i18n('live.view.reset')`, handler: `deselect(); empty();`. Added/removed dynamically via `handleResetContextMenuAction`: present only while the region has at least one non-moving child.

Menu title = `RegionViewContextMenuTitle(name)` showing region name + region icon.

`select(config, menuPosition)` forces `config.rightClicked = false` — regions downgrade right-click semantics to left-click at selection time.

---

## Parse Flow

`parseComponentViews` clears registrations and delegates to `doParseComponentViews`:
- Already a `ComponentView` (pre-wired) → ignore.
- Has `ItemType` via `ItemType.fromElement(child)` → assert it's a component type; build `ComponentView` via factory with parentView/parentElement/liveEditParams/positionIndex=componentViews.length/element; wire listeners.
- Otherwise → recurse into children (tolerates wrapper markup between region root and component nodes).

**Invariant**: non-component `ItemType` children are asserted illegal.

---

## Add / Remove Bubbling

When a child `ComponentView` is registered, the region attaches `itemViewAddedListener` and `itemViewRemovedListener` to that child. Those listeners:
- On child-add → `notifyItemViewAdded(event.getView(), event.isNewlyCreated())`.
- On child-remove → if removed view is a `ComponentView` in `componentViews`, splice it out; regardless, `notifyItemViewRemoved(event.getView())`.

Direct add path (`addComponentView`) also calls `notifyItemViewAdded`; direct remove path (`unregisterComponentView`) also calls `notifyItemViewRemoved`. The chain reaches `PageView` through the region's listeners, which in turn bubble to `PageView` (or a containing `LayoutComponentView`).

---

## Flag and Branch Audit

- `addComponentView(_, _, newlyCreated, _dragged?)` — `newlyCreated` passed forward in `ItemViewAddedEvent`; `_dragged` is unused.
- `removeComponentView(_, silent=false)` — `silent=true` skips DOM removal (used by drag moves).
- `isElementOverRegion` walks up DOM looking for `data-portal-region` ancestor; returns true only when the nearest region ancestor is this region's root. Nested regions don't trigger highlight on outer.
- `highlightSelected` suppressed when in text-edit mode OR dragging.
- `showCursor` suppressed when in text-edit mode.
- `isEmpty` is true when no children OR every child `isMoving()` (drag in progress treats region as visually empty so placeholder can show).
- `handleResetContextMenuAction` — strips resetAction when empty; adds when not.
- `registerComponentViewInParent(_, index)` — `index >= 0` inserts; otherwise appends.

---

## Error Surfaces

- `unregisterComponentView` throws `Did not find ComponentView to remove: <id>` when not in `componentViews`.
- `doParseComponentViews` asserts `itemType.isComponentType()`.
- `isElementOverRegion` loop lacks null guard; throws TypeError if event target has no region ancestor.
- `itemViewRemovedListener` silently ignores non-ComponentView payloads but still re-emits.

---

## Lifecycle Contract for Consumers

1. Element must be attached; children must reflect the region's serialized HTML before construction (parseComponentViews runs synchronously in the constructor).
2. After construction, add/remove/lookup APIs are safe.
3. Listeners attached before the constructor CANNOT observe parse-time adds (since listeners are attached to children, not to the region itself).
4. `remove()` is terminal.

---

## Suspicious Conditions

- `RegionView.ts:182-184` `isElementOverRegion` — walks `parentElement` without null guard. During drag, stray mouseover on editor chrome could throw.
- `RegionView.ts:141-157` — `componentAddedListener / componentRemovedListener` defined but never attached inside this module. Without external wiring, placeholder/reset-menu state can desync with model component mutations.
- `RegionView.ts:304` — `_dragged` parameter declared but unused.
- `RegionView.ts:189-191` — `mouseDownLastTarget` stored but never read.
- `RegionView.ts:237-243` — `select` forcibly sets `config.rightClicked = false` for regions; masks right-click affordances.
- `RegionView.ts:322` vs `:290` — `removeComponentView` calls `removeChild` AFTER `unregisterComponentView` has nulled the child's parent; base `Element.removeChild` behavior depends on this ordering.
- `RegionView.ts:376-378` — pass-through `getPageView` override only for TypeScript narrowing.
