# Module: overlay-chrome

**Files:** `page-editor/Highlighter.ts`, `page-editor/SelectedHighlighter.ts`, `page-editor/Shader.ts`, `page-editor/Cursor.ts`
**LOC:** ~448
**Role:** Four global visual overlay singletons appended to `Body.get()`, positioned with absolute coordinates over the page. Highlighter (hover outline), SelectedHighlighter (selection crosshair), Shader (4-panel dimmer + click forwarding), Cursor (body cursor swap). All are visual-only with no business logic.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [User-Facing Visuals](#user-facing-visuals)
4. [Coordinate Calculation](#coordinate-calculation)
5. [Events Fired (Shader only)](#events-fired-shader-only)
6. [Events Listened](#events-listened)
7. [Flag and Branch Audit](#flag-and-branch-audit)
8. [Error Surfaces](#error-surfaces)
9. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Four global visual overlay singletons: Highlighter (hover outline), SelectedHighlighter (selection crosshair+rect), Shader (4-region dimmer that isolates a locked/selected target and intercepts clicks outside it), Cursor (body cursor swapper). Each is a singleton appended to `Body.get()`, positioned with absolute coordinates computed from the current target's `getDimensions()`. `ItemView` wires into them for hover/select/locked feedback. Shader also emits click events that propagate to `ItemView.handleShaderClick`.

Files: `Highlighter.ts:1-164`, `SelectedHighlighter.ts:1-27`, `Shader.ts:1-218`, `Cursor.ts:1-39`.

---

## Public Surface

- `HighlighterMode = { RECTANGLE, CROSSHAIR }` enum.
- `Highlighter.get()` / `SelectedHighlighter.get()` / `Shader.get()` / `Cursor.get()` singletons.
- `Highlighter.highlightItemView(view)`, `highlightElement(dimensions, style)`, `updateLastHighlightedItemView()`, `setMode(mode)`, `isViewInsideSelectedContainer(view)`, `getSelectedView()`, `unselect()`.
- `SelectedHighlighter.preProcessStyle` override — blue stroke (`rgba(11, 104, 249, 1)`), translucent blue fill (`rgba(90, 148, 238, .2)`), transparent fill when `isEmptyView`.
- `Shader.setScrollEnabled(boolean)`, `shade(element)`, `hide()`, `isVisible()`, `onMouseEnter/Leave/Move/Clicked` listener registrars (with `un*` removers).
- `Cursor.displayItemViewCursor(view)` sets body cursor to `itemView.getType().getConfig().getCursor()`; `Cursor.hide()` sets `'none'`; `Cursor.reset()` restores cached default.

---

## User-Facing Visuals

### Highlighter (RECTANGLE mode, default for hover)

A single SVG `<rect>` drawn over the hovered view with opaque black stroke. The `<rect>` resizes to the view's dimensions using `getEl().getDimensions()`. Off-screen position (`top: -5000px, left: -5000px`) at init so hidden state uses out-of-viewport placement rather than `display:none`.

### SelectedHighlighter (CROSSHAIR mode, used for selection)

Same SVG overlay plus a full-viewport `<path>` drawing crosshair guide lines that extend beyond the selected view's rectangle out to the edges of `<body>`. Stroke is opaque blue; fill inside the rect is translucent blue (unless the view is empty — then transparent so the empty placeholder UI shows).

The CROSSHAIR mode resizes the root SVG to span the whole body so the crosshair guides can extend beyond the view rect. Path `d` is written with 4 line segments (two vertical flanking the rect, two horizontal flanking it).

### Shader (locked / selected dimming)

Five `DivEl` panels: `page` (fallback full-page), `north`, `east`, `south`, `west`. When shading a target element, north/east/south/west are sized to cover the 4 regions around the target's bounding box; `page` is hidden. When shading a full `PageView` (detected via `ClassHelper.getClassName(element) === 'PageView'`), the `page` panel covers everything.

Each panel installs handlers for `click`, `contextmenu`, `mouseenter`, `mouseleave`, `mousemove` forwarded to internal notifiers. Click forwarding is how `ItemView.handleShaderClick` receives the "user clicked on the dim" event — the module calls `preventDefault` and `stopPropagation` before firing.

Body `mousewheel` handler: when a target is set and the shader is visible, either swallows the wheel event (if `scrollEnabled=false`) or, after 5 ms, re-runs `resizeToElement(target)` so the shade follows scrolled content.

### Cursor

Reads the current body cursor at first `Cursor.get()` as `defaultBodyCursor`. `displayItemViewCursor(view)` sets body cursor to the type-specific value from `itemView.getType().getConfig().getCursor()` (typically `move` for components, `text` for text views). `hide()` sets `'none'`. `reset()` restores the cached default.

---

## Coordinate Calculation

Every overlay reads `itemView.getEl().getDimensions()` (or an arbitrary `ElementDimensions`).

- **Highlighter RECTANGLE**: positions the SVG at `(left, top)` with `(width, height)`.
- **CROSSHAIR**: positions SVG at `(left, 0)` spanning full screen height; inner rect drawn at local `(0, top)` with view's `(width, height)`.
- **Shader**: north = `(0, 0, body-width, top)`; east = `(left+width, top, body-width-left-width, height)`; south = `(0, top+height, body-width, body-height-top-height)`; west = `(0, top, left, height)`. Panels with negative or zero dimensions are hidden.

---

## Events Fired (Shader only)

| Event | Site | Notes |
|-------|------|-------|
| shader click | `Shader.ts:170-175` | Forward raw MouseEvent after stopProp+preventDefault |
| shader mouseenter/mouseleave/mousemove | `Shader.ts:116-152` | Raw MouseEvent broadcast |

---

## Events Listened

- body `mousewheel` (Shader) — tracks scrolled target or swallows.
- panel click/contextmenu/mouseenter/mouseleave/mousemove — forwarded to notifiers.

---

## Flag and Branch Audit

- `Highlighter` constructor optional `type` — RECTANGLE (default) vs CROSSHAIR.
- `Shader.setScrollEnabled(boolean)` — when false, wheel events are swallowed while shaded.
- `Shader.shade(element)` — `ClassHelper.getClassName(element) === 'PageView'` → `resizeToPage`; else `resizeToElement`.
- `resizeToElement` clamps negative dimensions; `showShaderIfNecessary` hides panels with zero area.
- No throws anywhere — all errors surface as visual glitches only.

---

## Error Surfaces

- Relies on `this.getChildren()[0]` and `[1]` being rect and path; SVG markup changes silently break rendering.
- `parseInt` on computed stroke-width may be NaN → crosshair path malformed.
- 5ms setTimeout for scroll-tracking races with hide; could reshape after hide.
- Listener arrays never bounded — potential leak over long sessions.
- `Cursor.defaultBodyCursor` captured at first `Cursor.get()`; if the page cursor changes before first get, reset restores the wrong cursor.

---

## Suspicious Conditions

- `Highlighter.ts:74-83` — `HighlighterMode[this.mode].toLowerCase()` relies on numeric→key enum lookup; brittle.
- `Highlighter.ts:111-156` — CROSSHAIR mode mixes coordinate systems (rect local x=0 vs screen-anchored SVG left).
- `Highlighter.ts:134` — `parseInt` on computed style may be NaN.
- `Shader.ts:54` — setTimeout captures `this.target` at fire time; racing with hide.
- `Shader.ts:90` — stringified classname check `'PageView'` breaks under minification.
- `Shader.ts:44-56` vs `Shader.ts:188` — page-shaded state does not track scroll (target cleared for full-page mode).
- `Shader.ts:97-100` — `hide()` doesn't clear listener arrays; accumulates over session.
- `Cursor.ts:14` — cached cursor may not be the "real" default if captured too early.
