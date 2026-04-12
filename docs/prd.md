# Page Editor — New UI Migration PRD

## Problem

The page editor renders as an iframe overlay on customer pages. Its current implementation uses jQuery-based class hierarchies (`ItemView`, `RegionView`, `ComponentView`) and a single global LESS stylesheet. This creates three problems:

1. **Style leakage.** Editor chrome and customer page styles interfere with each other. The editor can only defend with class prefixes — no real isolation boundary.
2. **No component lab.** Editor visual states (empty, error, locked, dragging) can only be tested inside the full live editor runtime.
3. **Maintenance cost.** The jQuery class hierarchy is deeply coupled. Changing one surface risks regressions in unrelated areas.

## Goal

Replace the visual chrome and interaction layer with Preact components rendered inside Shadow DOM, using nanostores for state and Tailwind + `@enonic/ui` tokens for styling. The new runtime must:

- Render all editor chrome (placeholders, overlays, highlights, context menu, drag feedback) without leaking styles into customer pages
- Own hover detection, click selection, keyboard forwarding, and drag-and-drop
- Communicate with the parent Content Studio frame through the existing `IframeEventBus` protocol
- Coexist with legacy code that hasn't been migrated

## Scope

### In scope (migrated)

| Surface | Status |
|---------|--------|
| In-flow placeholders (empty regions, empty components, error cards) | Done |
| Overlay chrome (hover highlight, selection crosshair, shader, context menu) | Done |
| Interaction systems (hover, click, keyboard, deselection, right-click) | Done |
| Drag and drop (context-window inserts, intra-page component reordering) | Done |
| Selection persistence (session storage) | Done |
| Fragment editing mode | Done |
| Page placeholder (controller selection) | Done |
| Text editing synchronization (textMode flag, edit-entry parity) | Done |

### Out of scope (remains in legacy)

| Surface | Reason |
|---------|--------|
| Inline rich-text editing (CKEditor) | Requires dedicated integration design. No migration planned. |
| Legacy view object model (`PageView`, `ItemView`, `ComponentView`, `RegionView`) | Still instantiated by the parent frame. The new runtime bridges into these via `bridge.ts`. |
| `IframeEventBus` event classes | Defined in `@enonic/lib-contentstudio`. Would need upstream package changes. |
| `ComponentPath` type | Core identity type from `@enonic/lib-contentstudio`. Shared between new and legacy code. |

## Architecture

See [`architecture.md`](./architecture.md) for the full technical spec: rendering model, state model, event model, geometry model, coexistence strategy, and phased implementation plan.

## Legacy Dependencies

The new runtime is a layer on top of the legacy system, not a full replacement. Several legacy dependencies remain in the production bundle and affect the development environment (Storybook, tests).

### jQuery and jQuery UI

**Status:** Required at runtime. Cannot be removed.

The legacy `DragAndDrop.ts` module imports `jquery-ui/ui/widgets/sortable` at the module level. Although the new runtime disables sortables on init, the module is still loaded because:

- `PageView` instantiates `DragAndDrop` during page editor boot
- The module-level `import 'jquery-ui/ui/widgets/sortable'` executes on load regardless of whether sortables are used

jQuery is also a transitive dependency of the external `@enonic/lib-admin-ui` and `@enonic/lib-contentstudio` packages. These packages provide:

- `Action` — used by the context menu
- `ComponentPath` — the canonical component identity type
- Event classes (`SelectComponentEvent`, `DeselectComponentEvent`, `SelectPageDescriptorEvent`, etc.) — used by overlay components to communicate with the parent frame

Both Storybook and vitest require `jQuery` as a global (`globalThis.$ = jQuery`) because jquery-ui expects it.

### Legacy view classes

The new runtime calls into legacy `ItemView` instances through `bridge.ts` for:

- `resolveItemView(path)` — look up the legacy view by component path
- `selectLegacyItemView(path)` / `deselectLegacyItemView(path)` — mirror selection state
- `setLegacyItemViewMoving(path, moving)` — update drag visual state
- `legacyFragmentContainsLayout(path)` — nested layout validation during drag
- `getContextMenuActions()` — fetch context menu action list
- `scrollComponentIntoView()` — scroll selected component into viewport

These bridge calls will remain until the legacy view classes are fully removed from the parent Content Studio frame.

### Path to full legacy removal

Removing jQuery and the legacy view classes requires changes outside this package:

1. **Extract `ComponentPath` and event classes** from `@enonic/lib-contentstudio` into a lightweight, jQuery-free package
2. **Replace `Action` class** with a plain data type for context menu items
3. **Remove legacy view instantiation** from the parent Content Studio frame (the frame currently creates `PageView`, which creates the entire legacy view tree)
4. **Delete `page-editor/` directory** once no code references it

This is a multi-package effort and is not currently scheduled.
