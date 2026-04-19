# Module: drag-and-drop — Deep Spec

**Files:** `page-editor/DragAndDrop.ts`, `page-editor/DragPlaceholder.ts`
**LOC:** ~732
**Role:** Singleton wrapping jQuery-UI sortable/draggable. Centralizes all drag-and-drop behavior: reorder/move existing components, insert new components from palette, enforce drop rules, manage visual feedback, emit manipulation and lifecycle events, handle Firefox-specific behavior.

> This file merges the medium-depth module summary with the deep-dive analysis. It is the authoritative reference for DragAndDrop behavior.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [State Fields](#state-fields)
4. [Sortable Configuration (per region)](#sortable-configuration-per-region)
5. [Lifecycle](#lifecycle)
6. [User-Facing Scenarios](#user-facing-scenarios)
   - [Palette drag → new component insert](#1-palette-drag--new-component-insert)
   - [Existing component → move](#2-existing-component--move)
   - [Drag-over visual feedback](#3-drag-over-visual-feedback)
   - [Cancel path](#4-cancel-path)
   - [Drop rules / forbidden drops](#5-drop-rules--forbidden-drops)
   - [Phantom-click suppression](#6-phantom-click-suppression)
   - [Firefox-specific behavior](#7-firefox-specific-behavior)
   - [DragPlaceholder lifecycle](#8-dragplaceholder-lifecycle)
7. [Events Fired](#events-fired)
8. [Register / Unregister Symmetry](#register--unregister-symmetry)
9. [Contract Notes for Reimplementation](#contract-notes-for-reimplementation)
10. [Non-Goals](#non-goals)
11. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Centralizes all drag-and-drop behavior for the in-iframe page editor. Wraps jQuery-UI `sortable` on every `RegionView` (to reorder or move existing components across regions) and jQuery-UI `draggable` on palette items hosted by the outer Context Window (to insert new components). Enforces drop rules, mediates visual feedback (helper chip, drop placeholder, region highlight), emits manipulation events on drop, and fires drag lifecycle events. `DragAndDrop` is a singleton; `DragPlaceholder` is the visual target indicator inserted into the sortable's native placeholder slot.

---

## Public Surface

### `DragAndDrop`

- `static init(pageView)` — creates singleton; mandatory before any other access.
- `static get()` — throws `Do DragAndDrop.init(pageView) first` when uninitialized.
- Constants: `REGION_SELECTOR`, `ITEM_NOT_DRAGGABLE_SELECTOR = '.not-draggable'`, `PLACEHOLDER_CONTAINER_SELECTOR = 'live-edit-drag-placeholder-container'`, `DRAGGED_OVER_CLASS = 'dragged-over'`, `DRAGGING_ACTIVE_CLASS = 'dragging'`, `SORTABLE_ITEMS_SELECTOR` (computed from `ItemType.getDraggables()`).
- `isDragging(): boolean`, `isNewlyDropped(): boolean` (100ms post-drop window).
- `createSortable(jq)` — install sortable on one region.
- `createSortableLayout(component)` — install sortable on every region nested inside a layout.
- `refreshSortable()` — `sortable('refresh')` on all regions.
- `createDraggable(jq) / destroyDraggable(jq)` — for palette items.
- Lifecycle listener registration: `onDragStarted/un`, `onDragStopped/un`, `onDropped/un`, `onCanceled/un`.

### `DragPlaceholder`

- Singleton, lazy instantiation via `DragPlaceholder.get()`.
- DOM: `<div id="drag-placeholder" class="drag-placeholder"><div class="message"/></div>`.
- `setItemType(type)` — swaps class to `${shortName}-placeholder`, sets text to `i18n('live.view.drag.drophere')`.
- `setDropAllowed(boolean)` — toggles `drop-allowed` class.
- `setText(s)` — sets inner HTML.
- `setRegionView(region)`, `reset()`.

---

## State Fields

| Field | Meaning |
|-------|---------|
| `dragging` | True from drag start to drag stop; the public "is a drag in progress" signal. |
| `wasDropped` | Sentinel: a successful drop event has fired during this drag. Used by draggable `stop` to decide whether to also fire canceled. |
| `newlyDropped` | 100ms post-drop marker for consumers to discard Firefox's spurious click after release. |
| `wasDestroyed` | The palette row's draggable was torn down mid-drag; forces the next sort-stop to cancel rather than commit. |
| `newItemItemType` | Non-null iff the drag originated from the Context Window palette; stores the type AND discriminates "new component" drags. |
| `draggedComponentView` | The existing component being moved; non-null only for in-iframe drags. |

---

## Sortable Configuration (per region)

`DragAndDrop.ts:119-151`:

- `appendTo: document.body`
- `revert: false`
- `cancel: '.not-draggable'`
- `connectWith: REGION_SELECTOR`
- `items: SORTABLE_ITEMS_SELECTOR`
- `distance: 20` (pixels before drag starts)
- `delay: 50` (ms before drag starts)
- `tolerance: 'intersect'`
- `cursor: 'move'`
- `cursorAt: DragHelper.CURSOR_AT`
- `scrollSensitivity` clamped 20–100 = `round(windowHeight / 8)`
- `placeholder: 'live-edit-drag-placeholder-container'`
- `forceHelperSize: true`
- `helper: () => DragHelper.get().getHTMLElement()` (custom floating chip)
- Plus all lifecycle handlers.

---

## Lifecycle

- **Construction**: `DragAndDrop.init(pageView)` → new singleton → computes `SORTABLE_ITEMS_SELECTOR` from `ItemType.getDraggables()` → installs sortable on every `REGION_SELECTOR` element. Listener arrays pre-initialized as `[]`.
- **Post-init**: `createSortableLayout(component)` when a layout component loads (called by `LiveEditPage` on `ComponentLoadedEvent`). `refreshSortable()` for non-layout loads. `createDraggable(jq)` per palette item; `destroyDraggable(jq)` to tear down.
- **Teardown**: No explicit destroy. Per-drag cleanup at tail of `handleSortStop`: palette sort removes `ui.item`, nulls `newItemItemType` and `draggedComponentView`, sets `newlyDropped=true` then clears after 100ms, resets `DragHelper`.

---

## User-Facing Scenarios

### 1. Palette drag → new component insert

**Preconditions**: Context Window called `DragAndDrop.get().createDraggable(jq)` which captured `newItemItemType`. This is triggered by `LiveEditPage` receiving `CreateOrDestroyDraggableEvent(type, true)`.

- Pointer-down + drag: jQuery-UI draggable `start` (`DragAndDrop.ts:180-190`) appends `DragHelper` chip to `Body.get()`, calls `notifyDragStarted`. **Firefox workaround**: sortable's `start` doesn't fire when drag originates outside the iframe.
- As pointer enters a region: sortable `start` (non-Firefox), `activate`, `over`, etc. fire. `handleSortStart` detects `newItemItemType` is set, sets placeholder text to `live.view.drag.drophere`. `updateHelperAndPlaceholder` shows helper chip with `StringHelper.capitalize(i18n('field.' + shortName))`.
- On release in a region with drop allowed: `handleSortStop` computes `componentIndex` among siblings, fires `AddComponentEvent(new ComponentPath(componentIndex, regionView.getPath()), componentType.toComponentType())`, notifies dropped with `from=null`. The ghost dropped sibling is removed.
- Firefox backup: draggable `stop` fires; since `wasDropped` is already true, only notifies drag-stopped (not canceled).

### 2. Existing component → move

Sortable engages after `distance: 20, delay: 50`. `handleSortStart` resolves `draggedComponentView` via `pageView.getComponentViewByElement(ui.item)`, deselects it, calls `setMoving(true)` so origin "ghosts".

Same-region vs different-region: **no explicit branch**. Both flow into the move branch which fires `MoveComponentEvent(from, to)`. Self-move (from equals to) is NOT suppressed.

Connected sortables fire `activate/deactivate` on every region, applying `dragging` class globally. `handleRemove` / `handleReceive` refresh empty state on source and target.

### 3. Drag-over visual feedback

Hovered region gets `dragged-over` class (added in `processMouseOverRegionView`; all others have it removed in the same pass). `updateHelperAndPlaceholder` toggles `DragHelper.setDropAllowed(...)` and rewrites placeholder text:
- Allowed → default "drop here" message.
- Forbidden → `i18n('notify.nestedLayouts')` + not-allowed visual.

Pointer leaves region without entering another → class removed; helper forced to not-allowed.

### 4. Cancel path

- Dropping outside any region: `DragHelper.isDropAllowed()` returns false at sort-stop → `cancelDrag(event.target)` calls `sortable('cancel')` (reverts DOM) and `notifyCanceled` (fires `ComponentViewDragCanceledEvent`).
- No explicit Esc keydown listener — relies on jQuery-UI sortable's native behavior, surfaces as the same `stop`/`cancel` flow.
- Palette-only cancel (palette item dragged but never entered a region): draggable `stop` fires with `wasDropped=false` → `notifyCanceled`.
- Mid-drag destroy: `destroyDraggable` flips `wasDestroyed`; next sort-stop detects it and cancels.

### 5. Drop rules / forbidden drops

- **Layout-in-layout forbidden**: dragged item is a layout AND target region has an ancestor layout.
- **Fragment-containing-layout forbidden**: dragged item is a fragment AND `(draggedComponentView as FragmentComponentView)?.containsLayout()` AND target region is inside a layout.
- When forbidden during hover: helper → not-allowed; placeholder text → `notify.nestedLayouts`; placeholder → not-allowed.
- On release in forbidden state: sort-stop reverts and emits canceled.

Note: palette-originated fragment drags that contain layouts are NOT gated because `draggedComponentView` is null (the optional chain `containsLayout()` evaluates falsy).

### 6. Phantom-click suppression

After every successful sort-stop: `newlyDropped=true`, then `setTimeout(() => newlyDropped=false, 100)`. Comment at `DragAndDrop.ts:329`: "in FF after item was dragged a redundant click event is fired". `ItemView.handleClick` reads `isNewlyDropped()` to ignore clicks during that 100ms window.

`newlyDropped=true` is set in both allowed AND forbidden/canceled branches — click suppression applies after canceled drops too.

### 7. Firefox-specific behavior

- Sortable `start`/`stop` don't fire for palette-originated drags.
- Mitigation: palette draggable has its own `start`/`stop` covering `DragHelper` append/remove + notify started/stopped/canceled.
- Consequence in Chromium: both sortable and draggable handlers fire → listeners may receive TWO `Started` and TWO `Stopped` events per palette drag. Consumers must deduplicate.
- 100ms phantom-click workaround is also Firefox-motivated.

### 8. DragPlaceholder lifecycle

- Singleton created lazily; same DOM node reused across drags.
- Attached in `handleSortStart`: its `HTMLElement` is appended into `ui.placeholder` (sortable's native insertion-position slot).
- Message: default is i18n drop-here pattern; forbidden is `notify.nestedLayouts`; cleared when `setItemType(null)`.
- No teardown invoked on tear-down; `reset()` exists but is never called from `DragAndDrop`.
- `DragPlaceholder.pattern` is memoized at class-eval; if Messages haven't loaded yet, the raw i18n key is stored.

---

## Events Fired

| Event | Payload | Site |
|-------|---------|------|
| `ComponentViewDragStartedEvent` | `componentView?.getPath()` — `undefined` for palette drags | `DragAndDrop.ts:488` |
| `ComponentViewDragStoppedEvent` | `componentView?.getPath()` | `DragAndDrop.ts:512` |
| `ComponentViewDragDroppedEvent` | `(from: ComponentPath \| null, to: ComponentPath)` — `from=null` for palette drops | `DragAndDrop.ts:531` |
| `ComponentViewDragCanceledEvent` | `(componentView)` — full view object, NOT a path | `DragAndDrop.ts:553` |
| `AddComponentEvent` | `(new ComponentPath(index, regionPath), componentType.toComponentType())` | `DragAndDrop.ts:301` (palette drop only) |
| `MoveComponentEvent` | `(from: dragged.getPath(), to: new ComponentPath(index, regionPath))` | `DragAndDrop.ts:306` (existing-component drop only) |

---

## Register / Unregister Symmetry

- `createDraggable` ↔ `destroyDraggable` — paired.
- `onDrag* / unDrag*` filter-remove — paired.
- Leak: no `sortable('destroy')` anywhere (never called).
- Leak: 100ms `setTimeout` has no `clearTimeout` ID tracked.
- Palette-drag aborted mid-flight: `newItemItemType` cleared only in `handleSortStop`; if stop never arrives, it leaks.

---

## Contract Notes for Reimplementation

- Must preserve exactly-one-`dragged-over` invariant per `DragAndDrop.processMouseOverRegionView`.
- `DragHelper` (from `@enonic/lib-admin-ui`) is the cursor-following chip; `DragPlaceholder` is the insertion indicator inside sortable's native placeholder slot. These are two different visual elements.
- Palette-drag preconditions: wizard must send `CreateOrDestroyDraggableEvent(type, true)` first; reimplementation must render `<div id="drag-helper-<type>" data-portal-component-type="<type>"></div>` without the `${dataAttr}}` brace bug from `LiveEditPage.ts:419`.
- `componentIndex` computation at drop: depends on `.drag-helper` + `.item-view` direct children of region; any structural change drifts.
- `SORTABLE_ITEMS_SELECTOR` is a comma-joined CSS selector from every `ItemType`'s `.getConfig().getCssSelector()` + `toString()`.
- Chromium double-event handling: consumers of `onDragStarted/Stopped` must tolerate receiving two events per palette drag (different payloads: `undefined` from draggable, `componentView.getPath()` from sortable).

---

## Non-Goals

- No undo of dropped events (once AddComponent/MoveComponent fires, no retract).
- No payload parity for canceled events (it's an outlier carrying the full view).
- No modifier-key semantics (drop always means move).
- No non-layout/non-fragment drop validation; delegated to server via wizard.
- No multi-select drag.
- No self-move suppression.
- No teardown path; singleton lives forever.

---

## Suspicious Conditions

- **`droppedListeners` array populated but never invoked** (`DragAndDrop.ts:66,516-523`): `notifyDropped` fires the class event but doesn't iterate this array. In-module `onDropped(cb)` subscribers never receive callbacks — bug.
- **Double Started events on Chromium palette drags**: both draggable `start` (`:189`) and sortable `start` (`:252`) fire `notifyDragStarted(undefined)`.
- **Double Stopped events on Chromium successful palette drops**: sortable `stop` (`:317`) and draggable `stop` (`:209`) both fire.
- **Self-move**: dropping in same region at same index still fires `MoveComponentEvent(from, to)` with equal paths (no suppression).
- **Canceled payload inconsistent**: full `ComponentView` vs path for siblings.
- **`handleSortChange` / `handleSortUpdate` dead-wired** (commented in config at `DragAndDrop.ts:147-148`).
- **`newlyDropped=true` set in both allowed AND forbidden branches** — click suppression also applies after canceled drops.
- **`DragPlaceholder.regionView` field is write-only dead state.**
- **`$('>.drag-helper, >.item-view', regionView).index(ui.item)` drift**: if region child structure changes, index silently miscomputes.
- **`DragPlaceholder.pattern` memoized at class-eval** — raw i18n key if Messages not loaded yet.
- **`setDropAllowed(false)` doesn't clear custom forbidden text** — sticky until next valid region visit.
- **Palette fragments dragged into layout not gated** because `draggedComponentView` is null.
- **`wasDestroyed` path skips `notifyDragStopped`** — `dragging` stays true until next session.
