# Module: page-view

**Files:** `page-editor/PageView.ts`, `page-editor/PagePlaceholder.ts`, `page-editor/PagePlaceholderInfoBlock.ts`
**LOC:** ~801
**Role:** Root of the in-iframe editor view tree. Parses the iframe body, owns the `viewsById` registry, implements the page lock/unlock state machine, provides the page-level context menu, and supports page vs. fragment dual rendering modes.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [User-Facing Interactions](#user-facing-interactions)
4. [Lock / Unlock State Machine](#lock--unlock-state-machine)
5. [Two Rendering Modes](#two-rendering-modes)
6. [viewsById Registry Flow](#viewsbyid-registry-flow)
7. [PagePlaceholder — No Page Controller State](#pageplaceholder--no-page-controller-state)
8. [PagePlaceholderInfoBlock](#pageplaceholderinfoblock)
9. [Events Fired](#events-fired)
10. [Events Listened](#events-listened)
11. [Error Surfaces](#error-surfaces)
12. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Root of the in-iframe editor view tree. It:
1. Parses the iframe body's HTML into a tree of `ItemView` instances.
2. Owns the flat `ItemViewId → ItemView` registry (`viewsById`) used by every other module for lookups.
3. Implements the page lock/unlock state machine emitting `PageLockedEvent` / `PageUnlockedEvent`.
4. Exposes the page's context menu (Inspect / Reset / Save As Template).
5. Supports two rendering shapes: full page with regions, or single fragment at the root.

When no page controller is selected yet, substitutes a `PagePlaceholder` containing an info block and a descriptor picker. Files: `PageView.ts:78-644`, `PagePlaceholder.ts:18-103`, `PagePlaceholderInfoBlock.ts:5-54`.

---

## Public Surface

- `PageViewBuilder` — with `setItemViewIdProducer`, `setItemViewFactory`, `setElement`, `setLiveEditParams`, `build()`.
- `PageView extends ItemView`.
- `PagePlaceholder(pageView)` extends `ItemViewPlaceholder`.
- `PagePlaceholderInfoBlock(contentType?)` extends `DivEl`.

Key `PageView` methods:
- `createDraggable(item) / destroyDraggable(item)` — delegates to `DragAndDrop`.
- `setModifyPermissions(modifyPermissions: boolean)` — when false, immediately calls `setLocked(true)`.
- `setLocked(locked: boolean)` — toggles `locked` class, hides menus, shade/unshade, emits `PageLockedEvent` or `PageUnlockedEvent`, and on unlock also fires `ComponentInspectedEvent(this.getPath())`.
- `setLockVisible(boolean)`, `isLocked()`, `handleShaderClick(event)` — override with different locked-vs-permission branches.
- `getPath()` → `ComponentPath.root()` always.
- `setParentItemView(...)` → throws (root has no parent).
- `getRegions()`, `getSelectedView()`, `getItemViewById(id)`, `getItemViewByElement(el)`, `getRegionViewByElement / getComponentViewByElement(el)`, `getComponentViewByPath(path)` — registry APIs.
- `register / unregisterRegionView`, `register / unregisterFragmentComponentView` — fragment-mode mutators.
- `hasTargetWithinTextComponent(target)` — walks all `TextItemType` views for ancestry check.

---

## User-Facing Interactions

- **Hover**: inherits ItemView hover highlight (subject to lock suppression).
- **Click**: inherits. Page-root can be selected; `select()` forces `config.rightClicked = false` so right-click never sets that flag at the page level.
- **Context menu (unlocked)**: three actions:
  - **Inspect** — fires `ComponentInspectedEvent(root)` (opens inspector panel).
  - **Reset** — fires `PageResetEvent()`. Only present when the page is non-empty.
  - **Save As Template** — fires `SaveAsTemplateEvent()`. Omitted when `liveEditParams.isPageTemplate` is truthy (can't save a template-of-a-template).
- **Context menu (locked)**: a separate, smaller menu with single action `action.page.settings` that fires `ComponentInspectedEvent(root)` — so users can still inspect while locked.

---

## Lock / Unlock State Machine

`setLocked(locked)` — idempotent (short-circuits if the state matches):

- **Transition to locked=true**: toggle `locked` class on element; hide any open context menus; shade the page; fire `PageLockedEvent`; notify `PageViewController.get().setLocked(true)`.
- **Transition to locked=false**: toggle off; hide context menus; unshade; fire `PageUnlockedEvent`; fire `ComponentInspectedEvent(root)` (opens inspector); notify `PageViewController`.

Visually locked page: `locked` class applied, shader dimming the whole page, selection overlay suppressed when selecting a child, cursor suppressed, `highlightSelected / showCursor / unshade` are guarded no-ops while locked.

`setModifyPermissions(false)` forces lock immediately. `setModifyPermissions(true)` does NOT auto-unlock (must come from `setLocked(false)` elsewhere).

Initial lock: in the constructor, if `liveEditParams.locked === true` OR `modifyPermissions` is explicitly false → `setLocked(true)` runs during construction (so `PageLockedEvent` fires at init).

`handleShaderClick` — locked-with-permissions branch: lazily builds `lockedContextMenu`; toggles it. Locked-without-permissions: delegates to super `handleClick`.

---

## Two Rendering Modes

### Page mode (default)

`parseItemViews` → `doParseItemViews` walks children: any `RegionItemType` descendant is built as a `RegionView`; non-region children are recursed into. Regions live in `this.regionViews`. Every view's id → view mapping stored in `viewsById`.

### Fragment mode (`liveEditParams.isFragment === true`)

`parseItemViews` inserts an empty `DivEl` as child 0 (placeholder slot), then `doParseFragmentItemViews` walks children: any `ItemType.isComponentType()` element is built via the factory and `registerFragmentComponentView` runs. `this.fragmentView` is the single top-level component. If that component is a `LayoutComponentView`, its regions are registered on `regionViews` too.

`getComponentViewByPath(path)` dispatches:
- Fragment mode + root path → `fragmentView`; if fragment is a layout, recurse; else null.
- Page mode + root → `this`; else scan regions for a matching path; else recurse into each region.

### Expected HTML

- **Page mode**: root body element with `data-portal-region` descendants (may be nested inside arbitrary wrappers or layout components).
- **Fragment mode**: body contains one component-typed element (part / layout / text / fragment) at the top level.

---

## viewsById Registry Flow

- Populated by `registerItemView` (called for each view in `toItemViewArray()` during parse).
- Mutated on every `ItemViewAddedEvent` / `ItemViewRemovedEvent` from regions/layouts; the page's `itemViewAddedListener` registers the added view plus all descendants, and for newly-created text views fires `SelectComponentEvent` with `rightClicked: true`; for other newly-created views calls `select(..., NONE)` and focuses placeholder if empty. Non-newly-created additions of text leave an empty else branch (no action).
- `itemViewRemovedListener` walks the removed view's tree and calls `unregisterItemView` on each.

---

## PagePlaceholder — No Page Controller State

Shown when the page has no controller yet. Contains:
- A `PagePlaceholderInfoBlock` (info header + sub-line message).
- A `PageDescriptorDropdown` seeded with `ContentId(liveEditParams.contentId)`, loaded via `controllerDropdown.load()`.

`dataLoadedHandler` branches:
- Data has descriptors AND content is not a page template → fetches content type display name, updates info block.
- Data has descriptors AND content IS a page template → info block says "select controller".
- Empty data → hides dropdown, shows "no controllers" message, adds `empty` class.

On selection change → fires `SelectPageDescriptorEvent(descriptor.getKey().toString())`.

On dropdown click → focus + stopPropagation (so shader click handler doesn't also run).

---

## PagePlaceholderInfoBlock

Two DIVs (`line1`, `line2`):
- Constructor with contentType → `setTextForContent(displayName)`.
- Constructor without → `setEmptyText()`.
- `toggleHeader(hasControllers)` — switches to `text.selectcontroller` or `text.nocontrollers`.
- `setErrorTexts` defined but no internal call sites (possibly dead or called externally).

---

## Events Fired

| Event | Payload | Site |
|-------|---------|------|
| `ComponentInspectedEvent` | root path | Inspect menu, locked menu, after unlock |
| `PageResetEvent` | — | Reset menu |
| `SaveAsTemplateEvent` | — | Save-as-template menu |
| `SelectComponentEvent` | `{path, position: null, rightClicked: true}` | On text view auto-add |
| `PageLockedEvent` / `PageUnlockedEvent` | — | On lock transition |
| `SelectPageDescriptorEvent` | `descriptorKey.toString()` | Placeholder dropdown selection |

---

## Events Listened

- `ItemViewAddedEvent` from each region — registers added views + descendants in registry, auto-selects newly created.
- `ItemViewRemovedEvent` — unregisters.
- `mouseOverView` while dragging — hides locked context menu.
- Dropdown `LoadedDataEvent<Descriptor>`, `click`, `selectionChanged` (placeholder only).

---

## Error Surfaces

- `setParentItemView` throws (`live.view.page.error.noparent`).
- `getItemViewById(null)` asserts non-null.
- `getItemViewByElement` asserts element non-null; returns null if data-id can't be parsed; asserts resolved view non-null.
- `dataLoadedHandler`'s contentType fetch catches via `DefaultErrorHandler.handle(reason)` but still renders fallback text.

---

## Suspicious Conditions

- `PageView.ts:121-124` + `:139-145` — lock asymmetry across constructor and `setModifyPermissions`. Construction doesn't lock when `modifyPermissions === undefined`, but calling `setModifyPermissions(undefined)` later would lock.
- `PageView.ts:188` — auto-created text view fires `SelectComponentEvent` with `rightClicked: true`. Downstream consumers gating on `rightClicked` will treat auto-created text as right-clicked.
- `PageView.ts:192-193` — empty else branch: text view added but not newly-created is silent.
- `PageView.ts:224-228` vs `:230-234` — `shade()` guards on `!isEmpty()`; `unshade` guards on `!isLocked()`. Asymmetric.
- `PageView.ts:288-303` `handleShaderClick` — locked + modify-permissions branch returns without handleClick/deselect; locked read-only falls through to handleClick (unclear UX).
- `PageView.ts:544-569` — `parseItemViews` uses `for...in` while deleting during iteration (benign since followed by `viewsById = {}`).
- `PageView.ts:560-562` — fragment-mode inserts an empty DivEl at index 0 before parse (shifts DOM children).
- `PageView.ts:641-643` — `isRendered()` hardcoded to `true` bypasses normal lifecycle check.
- `PagePlaceholder.ts:63-83` — `dataLoadedHandler` returns a Promise only on one branch; callers awaiting it see inconsistent timing.
