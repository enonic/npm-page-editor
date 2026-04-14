# Step 09 — Interaction

> SPEC ref: [interaction/](../SPEC-v2.md#interaction) — hover, selection, keyboard, navigation

## Goal

User input handlers for hover, click selection, keyboard forwarding, and link navigation interception. Each exports an `init*` function that attaches listeners and returns a cleanup function.

This step covers the non-drag interaction handlers. Drag-and-drop is step 10.

## Scope

```
src/main/resources/assets/js/v2/interaction/
├── hover.ts        ← mouseover/mouseout -> $hoveredPath
├── selection.ts    ← click/contextmenu -> $selectedPath + context menu
├── keyboard.ts     ← key events -> keyboard-event message
├── navigation.ts   ← link click interception -> navigate message
└── index.ts        ← barrel export (does not include drag modules)
```

### hover.ts

```ts
function initHoverDetection(): () => void;
```

- `mouseover` and `mouseout` on `document`
- Resolves target -> path via `getPathForElement()`
- Sets `$hoveredPath`
- Clears when `isDragging()` — hover is suppressed during drag
- No outgoing messages — hover is local state only

### selection.ts

```ts
function initSelectionDetection(channel: Channel): () => void;
```

- `click` and `contextmenu` listeners on `document` (capture phase)
- **Click:** resolves target -> path via `getPathForElement()`, toggles `$selectedPath`, sends `'select'` or `'deselect'` message
- **Context menu:** resolves target -> path, sets `$selectedPath`, opens `$contextMenu` with position, sends `'select'` with `rightClicked: true`
- **Guards:** ignores if `isDragging()`, if `isPostDragCooldown()`, or if event came from overlay chrome (shadow DOM detection)

Overlay chrome detection: events originating from within the overlay host's shadow root should not trigger selection changes. Check `event.composedPath()` for the overlay host element.

### keyboard.ts

```ts
function initKeyboardHandling(channel: Channel): () => void;
```

- `keypress`, `keydown`, `keyup` on `document`
- Detects modifier combos (ctrl, alt, shift, meta)
- Sends `'keyboard-event'` message with key, keyCode, and modifiers to Content Studio
- Content Studio matches against its own active key bindings
- Prevents browser defaults for known editor combos (mod+S, mod+Del, etc.)

This replaces the existing keyboard handler that imports `IframeEvent`, `IframeEventBus`, `Store`, `KEY_BINDINGS_KEY`, and `KeyBinding` from lib-admin-ui. The v2 version simply forwards raw key events via postMessage and lets Content Studio handle binding resolution.

### navigation.ts

```ts
function initNavigationInterception(channel: Channel): () => void;
```

- `click` listener on `document` (capture phase)
- Intercepts clicks on `<a>` elements (or their descendants) that would navigate within XP
- When a link targets a different content path: `event.preventDefault()`, sends `{ type: 'navigate', path }` to Content Studio
- Also sends `{ type: 'iframe-loaded' }` to notify Content Studio that iframe content has finished loading
  - If `document.readyState === 'complete'` at init time: sends immediately
  - Otherwise: waits for `window` `load` event

## What replaces what

| Existing | v2 | Change |
|----------|-----|--------|
| `hover-handler.ts` | `hover.ts` | Same logic, v2 stores |
| `selection-handler.ts` (imports SelectComponentEvent, DeselectComponentEvent, etc.) | `selection.ts` (channel.send) | Event classes -> typed messages |
| `keyboard-handler.ts` (imports IframeEvent, IframeEventBus, Store, KeyBinding) | `keyboard.ts` (channel.send) | 5 lib-admin-ui imports -> 0 |
| `text-editing-sync.ts` | Removed | Feature dropped |
| `click-guard.ts` | Inlined into selection.ts | Simplified |

## Adapting from existing code

The existing interaction handlers are close in structure. Main changes:
- Replace lib-contentstudio `ComponentPath` with v2 branded string + `getPathForElement()`
- Replace `IframeEventBus` event firing with `channel.send()` calls
- Replace `PageViewController` calls with direct store access
- Remove text editing sync entirely
- Inline click-guard logic (overlay chrome detection) into selection.ts

### keyboard.ts simplification

The existing keyboard handler is the heaviest lib-admin-ui consumer (5 imports). v2 simplifies drastically:
- Instead of looking up `KeyBinding` objects from `Store` and matching locally, just forward the raw key event via `channel.send({ type: 'keyboard-event', ... })`
- Content Studio handles the binding resolution on its side
- This eliminates all lib-admin-ui imports from the interaction layer

## Dependencies

- `state/` — `$hoveredPath`, `$selectedPath`, `$contextMenu`, `isDragging`, `isPostDragCooldown`, `getPathForElement`
- `transport/` — `Channel` (for sending outgoing messages)

## Verification

- Unit tests for each handler:
  - **hover:** mouseover sets path, mouseout clears, suppressed during drag
  - **selection:** click selects/deselects, context menu opens menu, guards prevent selection during drag/cooldown/overlay events
  - **keyboard:** key events forwarded with correct modifiers, defaults prevented for editor combos
  - **navigation:** link clicks intercepted, navigate message sent, non-navigating links ignored
- Integration story: extend the overlay story from step 08 with live hover/selection interaction
- Run `pnpm check`
