# Module: view-base (ItemView) — Deep Spec

**Files:** `page-editor/ItemView.ts`, `page-editor/ItemViewPlaceholder.ts`, `page-editor/ItemViewContextMenuPosition.ts`, `page-editor/CreateItemViewConfig.ts`, `page-editor/CreateTextComponentViewConfig.ts`
**LOC:** ~1241
**Role:** Abstract base class for every selectable view (page, region, component). Owns the full user-input surface for selectable DOM subtrees: hover highlight, click/right-click/long-press selection, context menu lifecycle, insert submenu, placeholder swap, loading spinner, and wiring to the 4 overlay singletons.

> This file merges the medium-depth module summary with the deep-dive analysis. It is the authoritative reference for ItemView behavior.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [The Bubble-Through Hover Algorithm](#the-bubble-through-hover-algorithm)
4. [handleClick Decision Tree](#handleclick-decision-tree)
5. [Touch Lifecycle](#touch-lifecycle)
6. [Context Menu Lifecycle](#context-menu-lifecycle)
7. [Selection State Machine](#selection-state-machine)
8. [Insert Submenu](#insert-submenu)
9. [Interaction with 4 Overlay Singletons](#interaction-with-4-overlay-singletons)
10. [handleShaderClick](#handleshaderclick)
11. [Placeholder Mount / Unmount](#placeholder-mount--unmount)
12. [CreateItemViewConfig Flow](#createitemviewconfig-flow)
13. [Events Fired](#events-fired)
14. [Non-Goals](#non-goals)
15. [Contract Invariants for Reimplementation](#contract-invariants-for-reimplementation)
16. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Abstract class extending `Element` (from `@enonic/lib-admin-ui`). Base for every selectable view (page, region, component). Owns:
- Hover/select state with bubble-through across parent/child.
- Click + right-click + long-press dispatch.
- Context-menu lifecycle with 3 positioning modes.
- Insert submenu (part/layout/text/fragment).
- Touch handling (1-second long-press threshold).
- Placeholder mount/unmount.
- Loading spinner.
- Wiring to 4 overlay singletons: Highlighter, SelectedHighlighter, Shader, Cursor.

`LIVE_EDIT_SELECTED = 'live-edit-selected'` DOM-attribute value (`ItemView.ts:169`).

Abstracts: `getPath(): ComponentPath`, `isEmpty()`, `isDragging()`, `addComponentView(...)`, `getNewItemIndex()`.

---

## Public Surface

### Exports

- `ElementDimensions` type
- `ItemViewBuilder` (builder for `ItemView`)
- `ItemView` (abstract class extending `Element` implementing `IDentifiable`)
- `ItemViewPlaceholder` (base DIV with stub `select/deselect/focus` hooks for subclasses — `ItemViewPlaceholder.ts:3-23`)
- `ItemViewContextMenuPosition` enum: `TOP | BOTTOM | NONE`
- `CreateItemViewConfig<PARENT extends ItemView>` (builder-style parameter object)
- `CreateFragmentViewConfig` (adds `fragmentContentId`)
- `CreateTextComponentViewConfig` (adds `text`)

### Key `ItemView` methods

- `LIVE_EDIT_SELECTED = 'live-edit-selected'` (data-attribute suffix) — `ItemView.ts:169`
- `highlight / unhighlight / highlightSelected / unhighlightSelected / shade / unshade / showCursor / resetCursor` — overlay toggles
- `remove()` — tears down context menu, load mask, listeners, DOM
- `refreshEmptyState()` — toggles `empty` class + placeholder + re-highlights selection
- `select(config?, menuPosition?, silent?)` — selects + fires `SelectComponentEvent` + opens menu
- `selectWithoutMenu(silent?)` — selects, fires event, no menu
- `deselect(silent?)` — clears `data-live-edit-selected`, hides menu, fires `DeselectComponentEvent`
- Abstract: `getPath(): ComponentPath`, `isEmpty()`, `isDragging()`, `addComponentView(...)`, `getNewItemIndex()`

---

## The Bubble-Through Hover Algorithm

Each `ItemView` carries per-view boolean `mouseOver` and publishes synthetic `MouseOverView` / `MouseLeaveView` channels (distinct from DOM `mouseenter`/`mouseleave`).

### On DOM `mouseenter` (`ItemView.ts:498-525`)

- If `this.mouseOver` already true → short-circuit (child already bubbled up).
- Walk up through `parentItemView` collecting ancestors until one with `mouseOver=true`; reverse the stack (outermost first).
- For each ancestor: if was hot → emit `MouseLeaveView`; if was cold → set `mouseOver=true`, emit `MouseOverView`, then immediately emit `MouseLeaveView` (transient "enter-then-leave" so parent overlays disappear and child takes over).
- Finally set `this.mouseOver=true`, emit own `MouseOverView`.

### On DOM `mouseleave` (`ItemView.ts:568-593`)

- Clear own `mouseOver`, emit own `MouseLeaveView`.
- If parent exists AND cursor is outside current element's bounding box → emit parent `MouseOverView` (moved off entirely). Else → emit parent `MouseLeaveView` (moved into a child).

### Net effect

Exactly one `ItemView` highlighted at a time. Clean hand-off between parent region and child component. Note: emits spurious enter+leave for intermediate parents the mouse never physically visited — documented tradeoff.

---

## handleClick Decision Tree

Steps at `ItemView.ts:645-699`:

1. Pointer is touch `PointerEvent` → return (touch handled separately via touch listeners).
2. `DragAndDrop.isNewlyDropped()` → return (suppress phantom click after drop).
3. `PageViewController.isNextClickDisabled()` → consume one click, clear flag, return.
4. Compute `rightClicked = event.which === 3 || event.ctrlKey`. If right-click, `preventDefault()`.

**Branch A** (view NOT selected OR rightClicked):
- If other view selected AND this view inside that container AND left-click → deselect outer (drill in).
- Else: build config `{path, position: !isEmpty ? {x,y} : null, newlyCreated: false, rightClicked}`; call `select(config, menuPosition)` with `menuPosition = rightClicked ? null (default positional) : NONE`; `focusPlaceholderIfEmpty()`.
- Else if inside selected container AND rightClicked → show outer selected view's menu at cursor. Child NOT selected.

**Branch B** (view IS selected AND left-click):
- If non-empty AND target NOT in context menu → `deselect()`.
- If placeholder is target → `deselect()`.
- If target inside open menu → no-op.
- If empty AND placeholder NOT target → no-op (keeps selection on empty view).

---

## Touch Lifecycle

`ItemView.ts:323-374`:

- `touchstart`: record timestamp, first touch point, `isMoveEvent=false`. Call `stopPropagation`.
- `touchmove`: `isMoveEvent=true`. Call `stopPropagation`.
- `touchend`:
  - If moved → abort (treat as scroll).
  - `isLongTouch = (now - start) / 1000 > 1`. Hard-coded 1-second threshold.
  - Short tap on unselected → `selectItem()`, fire `SelectComponentEvent{path, position: null}`.
  - Long-press → `selectItem()`, `showContextMenu({x: touch.pageX, y: touch.pageY})`, `preventDefault()`, fire `SelectComponentEvent{path, position: touchPoint}`.
  - Tap on already-selected → if menu visible, hide; else deselect.

---

## Context Menu Lifecycle

Lazy construction on first `showContextMenu`. Three positioning modes:

- **clickPosition present**: menu at `(x, y)` cursor coordinates (right-click, long-press touch).
- **No clickPos + TOP**: `(centerX, top)` above the view (used by "select parent" action).
- **No clickPos + BOTTOM or unset**: `(centerX, top+height)` below the view (default).
- **NONE**: shortcuts to `hideContextMenu` without construction.

`PageViewController.isContextMenuDisabled()` globally suppresses open.

`invalidateContextMenu` fully removes; triggered via `onRemoved` DOM hook.

`onOrientationChanged`: `UP` + empty view → negative top-margin pulls menu clear of empty-view space; `DOWN` or non-empty → margin=0.

---

## Selection State Machine

States observable to consumers:

| State | Observable signals |
|-------|--------------------|
| Unselected, not hovered | No overlays |
| Hovered | Highlighter SVG rect + Cursor |
| Selected | `data-live-edit-selected="true"` attr; SelectedHighlighter crosshair; Cursor; empty placeholder in selected mode |
| Selected + locked | Attr set but `highlightSelected` skipped (overlay suppressed) |

Transitions:

- Click unselected (no other selection) → `select(config, NONE)` → no menu (left-click); placeholder focused.
- Click unselected child while container selected → deselect container silently, then select.
- Click child inside selected container (not the container) → deselect container, fall through to normal select.
- Right-click unselected → same as click but `menuPosition = null` (positional menu at cursor).
- Right-click inside selected container → show container's menu at cursor (child NOT selected).
- Left-click selected non-empty, not on menu → deselect.
- Left-click on selected view's placeholder → deselect.
- Left-click inside open menu → no-op.
- **Exactly-one-selected invariant**: `selectItem` checks `SelectedHighlighter.get().getSelectedView()`; if another is selected, deselect it silently first.

---

## Insert Submenu

`ItemView.ts:1011-1024`:

Always includes: `part`, `text`, `fragment`. Layout is gated on all three conditions:
- (a) `getRegionView()` is `RegionItemType`
- (b) `!hasParentLayoutComponentView()` (prevent nested layouts)
- (c) `!liveEditParams.isFragment` (prevent layouts inside fragments)

Each action fires `new AddComponentEvent(path, componentItemType.toComponentType())` where path = `(newItemIndex, this.getPath())` for a Region, or `(newItemIndex, parentPath)` otherwise.

Labels from i18n `field.<short>`. Icons via `StyleHelper.getCommonIconCls(label)`.

The insert action is `setVisible(false)` by default; subclasses flip visibility based on context.

---

## Interaction with 4 Overlay Singletons

| Singleton | Used for | How called |
|-----------|---------|------------|
| `Highlighter.get()` | Hover outline | `highlight/unhighlight`; gated by `PageViewController.isHighlightingDisabled()` + `isViewInsideSelectedContainer` |
| `SelectedHighlighter.get()` | Selection crosshair + one-selected registry | `highlightItemView/unselect`; `getSelectedView()` for one-selected invariant; `isViewInsideSelectedContainer(this)` delegates here |
| `Shader.get()` | Click forwarding via `onClicked` → `handleShaderClick` | Actual `shade/unshade` calls are commented out today |
| `Cursor.get()` | Body cursor swap | `displayItemViewCursor/reset` |

Cursor quirk: when hovering a child inside a selected container, the cursor uses the selected *container's* type config, not the child's.

---

## handleShaderClick

`ItemView.ts:701-713`:

- Page locked → ignore fully.
- Not locked, selected, click outside view → deselect only (don't forward click).
- Not locked, selected, click over view → deselect AND forward to `handleClick`.
- Not locked, not selected, click over view → forward to `handleClick`.
- Otherwise → silent drop.

---

## Placeholder Mount / Unmount

- `togglePlaceholder`: if `isPlaceholderNeeded()` (empty OR `data-portal-placeholder-error="true"`) append placeholder; else remove.
- `refreshEmptyState()` toggles `empty` class + placeholder + re-runs `highlightSelected()`.
- When selected + empty: `selectPlaceholder()` delegates to `placeholder?.select()`.
- `focusPlaceholderIfEmpty()` called after click-select so placeholder's input receives keyboard focus.

---

## CreateItemViewConfig Flow

Consumers build one via `setParentView(...).setParentElement(...).setLiveEditParams(...)` + optional `setItemViewIdProducer`, `setItemViewFactory`, `setElement`, `setPositionIndex`.

- `positionIndex` defaults to `-1` (interpreted as "append").
- `ItemView.createView(type, config?)` (`ItemView.ts:1000-1009`) is the sanctioned entry. If config is omitted, synthesizes one from `getRegionView()`. Passes to `itemViewFactory.createView(type, config)` which returns the right subclass.

---

## Events Fired

| Event | Payload | Site |
|-------|---------|------|
| `SelectComponentEvent` | `{path, position: ClickPosition, newlyCreated: false, rightClicked}` (click) | `ItemView.ts:682-687, 838` |
| `SelectComponentEvent` | `{path, position: touchPoint \| null}` (touch) | `ItemView.ts:361` |
| `SelectComponentEvent` | `{path, position: null}` (select-without-menu) | `ItemView.ts:848` |
| `DeselectComponentEvent` | `path` | `ItemView.ts:889` |
| `AddComponentEvent` | `(path, componentType)` | `ItemView.ts:1083` (Insert submenu) |
| Synthetic `MouseOverView` / `MouseLeaveView` | — | `ItemView.ts:970-986` |

---

## Non-Goals

- Does NOT own Del/Backspace keyboard handling (lives in `ComponentView` subclass).
- Does NOT own drag mechanics (abstract `isDragging()` delegates).
- Does NOT shade on selection (intentionally commented out).
- Does NOT emit `DeselectComponentEvent` on `remove()`.
- Does NOT enforce platform-appropriate right-click detection.
- Does NOT guarantee parent-walk safety.

---

## Contract Invariants for Reimplementation

1. DOM attr `data-live-edit-selected="true"` is the sole truth for selection state.
2. `mouseOver` is synthetic per-view state, not the browser's native hover.
3. Only one view selected at a time — enforced via `SelectedHighlighter`.
4. Touch never opens context menu unless long-press (> 1 second).
5. Ctrl+click == right-click everywhere (fragile cross-platform — intentional or not).
6. `refreshEmptyState()` must be called after any subtree mutation to sync `empty` class + placeholder.
7. `SelectComponentEvent` payload: `{path, position: ClickPosition | null, newlyCreated: boolean, rightClicked: boolean}`. Position is `null` when view is empty or action is `selectWithoutMenu`.
8. `DeselectComponentEvent` payload: single positional `ComponentPath`.
9. `AddComponentEvent` payload: `(path, componentType.toComponentType())`.
10. Synthetic `MouseOverView`/`MouseLeaveView` channels are internal to the view tree; external consumers should not depend on their emission pattern.

---

## Suspicious Conditions

- `ItemView.ts:152, 428, 433` — `shaded` field is write-only dead state.
- `ItemView.ts:278, 865, 882` — shade-on-selection calls commented out; selection never shades.
- `ItemView.ts:400-411` — hover-while-selected handling commented out; not implemented.
- `ItemView.ts:445-464` `remove()` — doesn't call `unhighlightSelected` or `deselect`. Stale selection overlay if removed while selected; `DeselectComponentEvent` NOT emitted on removal.
- `ItemView.ts:657` — `event.which === 3 || event.ctrlKey` treats Ctrl+click as right-click on ALL platforms (including non-macOS).
- `ItemView.ts:648` — touch guard relies on `PointerEvent`; breaks on browsers dispatching `MouseEvent` for touch.
- `ItemView.ts:946-956` `findParentItemViewAsHTMLElement` — unbounded walk, crashes if DOM is not under an ItemView.
- `ItemView.ts:1050-1052` `getPageView` — unbounded walk; NPE on orphans.
- `ItemView.ts:202` — discards `builder.contextMenuActions`; setter on builder is silently ignored.
- `ItemView.ts:360` — misleading stale comment "restored selection: true to nake context panel not open" hints at a removed payload field.
- `ItemView.ts:469` `setDraggable` — "do not call super" comment; bypasses base `draggable="true"` semantics.
- `ItemView.ts:664` — `contextMenu.getHTMLElement().contains(event.target as Node)` assumes target is Node; can throw on synthetic events.
- Insert submenu: `text` and `fragment` are not gated for fragment-content or nested-layout; responsibility pushed to downstream.
