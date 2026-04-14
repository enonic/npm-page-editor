# Step 10 — Drag

> SPEC ref: [interaction/component-drag.ts](../SPEC-v2.md#component-dragts), [interaction/context-window-drag.ts](../SPEC-v2.md#context-window-dragts)

## Goal

Drag-and-drop for both existing components (reorder within page) and new components (insert from Content Studio's component palette). This is the most complex interaction in the editor.

## Scope

```
src/main/resources/assets/js/v2/interaction/
├── component-drag.ts       ← drag existing components within the page
├── context-window-drag.ts  ← drag from Content Studio palette into the page
└── index.ts                ← updated barrel (add drag exports)
```

Shared drop-target inference logic is extracted into a local helper used by both modules.

### component-drag.ts

```ts
function initComponentDrag(channel: Channel): () => void;
```

**Initiation:**
- `mousedown` on `[data-pe-drag-anchor]` elements
- Checks `isDragging()` before starting (mutual exclusion)
- Sets `$dragState` with `sourcePath`, sends `'drag-started'`

**During drag:**
- `mousemove` handler: infers drop target via `elementsFromPoint()`
- Detects region layout axis (horizontal vs vertical) for insertion index computation
- Updates `$dragState` continuously: `targetRegion`, `targetIndex`, `dropAllowed`, coordinates

**Drop validation rules:**
- No layout inside layout
- No drop on own descendant (checked via `isDescendantOf`)
- No fragment-with-layout inside layout (checked from `$registry`)

**On drop:**
- Computes final path: `insertAt(targetRegion, targetIndex)`
- Sends `'move'` message: `{ from: sourcePath, to: insertAt(targetRegion, targetIndex) }`
- Clears `$dragState`, triggers `reconcilePage()` (deferred reconciliation flush)

**On cancel (Escape or mouseup outside valid target):**
- Clears `$dragState`, sends `'drag-stopped'`
- Triggers `reconcilePage()` to flush any deferred DOM changes

### context-window-drag.ts

```ts
function initContextWindowDrag(channel: Channel): () => void;
```

- Activated when adapter receives `'create-draggable'` message
- Ignored if `isDragging()` (mutual exclusion)
- Deactivated on `'destroy-draggable'` message
- Same drop-target inference as component-drag
- On drop: sends `'add'` (not `'move'`): `{ path: insertAt(targetRegion, targetIndex), componentType }`
- `sourcePath` in `$dragState` is `undefined` (insert, not move)

### Shared drop-target helper

Extracted function used by both drag modules:

```ts
function inferDropTarget(
  x: number,
  y: number,
  registry: Record<string, ComponentRecord>,
): { regionPath: ComponentPath; index: number } | undefined;
```

- Uses `elementsFromPoint(x, y)` to find the deepest region element at cursor position
- Detects region layout axis by comparing child element positions
- Computes insertion index based on cursor position relative to child element midpoints
- Returns `undefined` if no valid region found

### Reconciliation guard interaction

During active drag, `reconcilePage` and `reconcileSubtree` skip updates (implemented in step 07). When drag ends (drop or cancel), the drag handler triggers a full `reconcilePage()` to sync any DOM changes that occurred during the drag.

### Post-drag cooldown

After drop or cancel, `isPostDragCooldown()` returns `true` for 100ms. This is implemented in `state/drag.ts` (step 02) and consumed by `interaction/selection.ts` (step 09) to prevent the mouseup from triggering click-selection.

## What replaces what

| Existing | v2 | Change |
|----------|-----|--------|
| `component-drag.ts` (jQuery UI sortable patterns, lib-contentstudio events) | `component-drag.ts` (native pointer events, postMessage) | jQuery UI -> native |
| `context-window-drag.ts` (6 lib-contentstudio event imports) | `context-window-drag.ts` (message-driven activation) | Event classes -> typed messages |
| `StringHelper` from lib-admin-ui (for label formatting) | Inline string manipulation | Remove import |
| `i18n` from lib-admin-ui (for translated labels) | `$config.phrases` (phrases passed via init message) | i18n from server -> phrases from config |
| `ItemType` / `*ComponentType` classes | `ComponentType` string literal | Classes -> union type |

## Adapting from existing code

The existing drag handlers are the heaviest lib-contentstudio consumers (8-12 imports each). The v2 versions:
- Replace all event class imports with `channel.send()` calls
- Replace `PageViewController` calls with direct store access
- Replace `ComponentPath` class with branded string + utility functions
- Replace `StringHelper.capitalize` with inline string ops
- Replace `i18n()` calls with `$config.get()?.phrases[key]` lookups
- Add shared drop-target inference helper (currently duplicated logic)
- Add reconciliation guard awareness
- Add post-drag cooldown

The drop validation rules (no nested layouts, no self-descendant) exist in the current code but are scattered. v2 consolidates them.

## Dependencies

- `state/` — `$dragState`, `$registry`, `isDragging`, `setDragState`, `getRecord`, `getPathForElement`
- `transport/` — `Channel` (for sending move/add/drag-started/drag-stopped messages)
- `protocol/` — `ComponentPath` utilities (`insertAt`, `isDescendantOf`, `parent`), `ComponentType`
- `reconcile` — `reconcilePage` (called on drag end to flush deferred changes)
- `geometry/` — `markDirty` (after drag state changes)

## Verification

- Unit tests for drop-target inference: mock DOM with regions, verify correct region + index for various cursor positions
- Unit tests for drop validation: layout-in-layout rejected, self-descendant rejected, fragment-with-layout rejected
- Unit tests for mutual exclusion: second drag attempt rejected while first is active
- Integration story: extend the integration story with full drag support — drag components between regions, verify placeholder positioning, test forbidden drops
- Run `pnpm check`
