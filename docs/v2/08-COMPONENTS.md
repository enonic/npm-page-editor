# Step 08 — Components

> SPEC ref: [components/](../SPEC-v2.md#components), [hooks/](../SPEC-v2.md#hooks), [actions/](../SPEC-v2.md#actions)

## Goal

All Preact UI components, hooks, and the actions module. This is the visual layer — everything users see. Accompanied by a full Storybook rework: drop legacy lib-admin-ui/lib-contentstudio imports from stories, use v2 protocol types, and add stories for all new components.

## Scope

```
src/main/resources/assets/js/v2/
├── hooks/
│   ├── use-store.ts           ← subscribe to nanostores atom
│   └── use-tracked-rect.ts    ← geometry scheduler + resize tracker -> DOMRect
├── actions/
│   ├── definitions.ts         ← ActionDef type, ActionId union, executeAction
│   ├── resolve.ts             ← resolveActions pure function
│   └── index.ts
├── components/
│   ├── OverlayApp.tsx               ← root overlay component
│   ├── Highlighter.tsx              ← hover indicator
│   ├── SelectionHighlighter.tsx     ← selection indicator + scroll-into-view
│   ├── Shader.tsx                   ← locked page overlay
│   ├── ContextMenu.tsx              ← right-click menu
│   ├── DragPreview.tsx              ← floating label during drag
│   ├── DragTargetHighlighter.tsx    ← drop zone highlight
│   ├── ComponentPlaceholder.tsx     ← empty/error component card
│   ├── RegionPlaceholder.tsx        ← empty region dropzone
│   ├── DragPlaceholder.tsx          ← inline drop insertion marker
│   ├── PagePlaceholderOverlay.tsx   ← empty page controller selector
│   └── index.ts
```

### hooks/

**`use-store.ts`:**
```ts
function useStoreValue<T>(store: ReadableAtom<T>): T;
```
Subscribes to a nanostores atom, re-renders on change. Straightforward hook.

**`use-tracked-rect.ts`:**
```ts
function useTrackedRect(path: ComponentPath | undefined): DOMRect | undefined;
```
Combines geometry scheduler + resize tracker. Registers a consumer, tracks element resize, returns current `DOMRect`. Effects keyed on `[path, element]` — when reconciliation replaces the DOM element at the same path, the element reference changes, effects re-run, ResizeObserver re-binds.

### actions/

Pure logic module. No UI, no side effects beyond sending messages.

**`definitions.ts`:**

`ActionId` union: `'select-parent' | 'insert' | 'insert-part' | ... | 'page-settings'`.

`ActionDef` type: `{ id, label, sortOrder, children?, enabled? }`.

`executeAction(action, path, channel)` maps action ID to outgoing message. See SPEC table for full mapping.

`resolveInsertPath(path)` converts current selection to insertion target — region: append at end; component: insert after.

**`resolve.ts`:**

```ts
function resolveActions(context: ActionContext): ActionDef[];
```

Pure function. Returns available actions based on component type and state. Rules per type:
- **Component** (part/layout/text/fragment): Select Parent, Insert (sub-menu), Inspect, Reset, Remove, Duplicate, Create Fragment
- **Region**: Select Parent, Insert (sub-menu), Reset
- **Page**: Inspect, Reset, Save as Template
- **Locked page**: Page Settings only

### components/

All components read from state atoms via hooks. No legacy imports.

**Overlay components** (rendered in overlay host, `position: fixed`):
- **Highlighter** — rounded border box at hovered element; hidden when dragging
- **SelectionHighlighter** — crosshair corners + bounding box; scrolls element into view on selection change; hidden when dragging
- **DragTargetHighlighter** — target zone highlight; green (allowed) or red (forbidden)
- **DragPreview** — floating label at cursor with item label, mode, status message
- **Shader** — semi-transparent overlay when locked; intercepts clicks, opens locked-page context menu if `modifyAllowed`
- **ContextMenu** — calls `resolveActions()`, renders items, calls `executeAction()` on click
- **PagePlaceholderOverlay** — reads `$pageControllers`, renders controller selector dropdown; sends `select-page-descriptor` on selection. No REST calls.

**Placeholder components** (rendered inside placeholder islands):
- **ComponentPlaceholder** — icon + type label for empty/error components
- **RegionPlaceholder** — "Drop components here" for empty regions

**Drag components** (rendered inline in page DOM during drag):
- **DragPlaceholder** — visual marker at drop insertion point

**OverlayApp** — root component composing all overlay layers.

### Storybook rework

Update both existing story files and add new ones:

1. **Drop legacy imports** — remove `Action` from lib-admin-ui, `ComponentPath` from lib-contentstudio
2. **Use v2 types** — import from `v2/protocol/` and `v2/state/`
3. **Drop bridge/coexistence** — no `setCurrentPageView`, `transferOwnership`, `resetOwnership`
4. **Update integration story** — use v2 state management directly (no mock page view)
5. **Add new stories:**
   - ContextMenu with action resolution
   - Shader (locked/unlocked states)
   - DragPreview variants
   - PagePlaceholderOverlay with mock controllers
   - Component states (loading, error, empty)

Story files stay in `.storybook/page-editor/`. Follow existing Storybook standards from `.claude/rules/storybook.md`.

## What replaces what

| Existing | v2 | Change |
|----------|-----|--------|
| `ContextMenu.tsx` (imports `Action` class from lib-admin-ui) | `ContextMenu.tsx` + `actions/` module | Mutable Action class -> ActionDef data + pure resolve |
| `PagePlaceholderOverlay.tsx` (REST calls, lib-contentstudio types) | `PagePlaceholderOverlay.tsx` (reads `$pageControllers` atom) | REST calls removed, Content Studio provides controller list via message |
| `Shader.tsx` (imports from lib-contentstudio) | `Shader.tsx` (reads stores directly) | No external imports |
| `DragPlaceholderPortal.tsx` | `DragPlaceholder.tsx` | Renamed, simplified |
| `EmptyPlaceholder.tsx` | Removed (merged into ComponentPlaceholder) | |
| LESS-based component styles | Tailwind utility classes | Full style migration |
| `preact` direct imports in stories | `react` imports (via compat alias) | Follow Preact compat rule |

## Adapting from existing code

Most overlay components exist in `new-ui/components/overlay/`. Main changes per component:
- Replace lib-contentstudio `ComponentPath` with v2 branded string
- Replace `useStore` from `@enonic/lib-admin-ui` with `useStoreValue` from v2 hooks
- Replace LESS class references with Tailwind utility classes
- Remove bridge.ts and coexistence.ts dependencies
- Use `getChannel()` from transport for outgoing messages

Placeholder components exist in `new-ui/components/placeholders/` and are already using Tailwind. Main change: use v2 types.

## Dependencies

- `protocol/` — types
- `state/` — all atoms
- `geometry/` — via `useTrackedRect`
- `rendering/` — `createPlaceholderIsland` (used in stories)
- `transport/` — `getChannel` (for actions and context menu)

## Verification

- **Storybook stories for every component** — visual verification of:
  - Placeholders: all component types, error state, empty state
  - Overlays: highlighter positioning, selection ring, shader opacity
  - Context menu: action list per component type, disabled states
  - Drag preview: label, status, cursor tracking
  - Page placeholder: controller dropdown
- **Unit tests for actions:**
  - `resolveActions` returns correct actions for each component type + state combination
  - `executeAction` sends correct outgoing message for each action
  - `resolveInsertPath` computes correct insertion target
- **Integration story** — full overlay with mock registry, interactive hover/select/context menu
- Run `pnpm check`
