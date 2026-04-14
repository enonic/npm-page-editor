# Step 05 — Geometry

> SPEC ref: [geometry/](../SPEC-v2.md#geometry)

## Goal

rAF-batched DOM measurement system. Centralizes all `getBoundingClientRect()` calls into a single animation frame pass, avoiding layout thrashing. No legacy dependencies.

## Scope

```
src/main/resources/assets/js/v2/geometry/
├── scheduler.ts       ← rAF-batched measurement loop
├── resize-tracker.ts  ← shared ResizeObserver wrapper
└── index.ts           ← barrel export
```

### scheduler.ts

```ts
function initGeometryScheduler(): () => void;
function registerConsumer(path: ComponentPath, callback: (rect: DOMRect) => void): () => void;
function markDirty(): void;
```

- Listens to `scroll` (capture phase, for nested scroll containers) and `resize` (passive) on `window`
- On dirty: batches all measurements into a single `requestAnimationFrame` pass
- Calls each registered consumer's callback with the element's `getBoundingClientRect()`
- Consumers register with a `ComponentPath`; the scheduler looks up the element from the registry
- `initGeometryScheduler()` returns a cleanup function that removes listeners and cancels pending rAF
- `markDirty()` is called externally by reconcile (after registry update) and by resize-tracker

### resize-tracker.ts

```ts
function trackElementResize(element: HTMLElement, onResize: () => void): () => void;
```

- Single shared `ResizeObserver` instance (created lazily)
- Calls the provided callback (typically `markDirty()`) when a tracked element changes size
- Returns an unobserve cleanup function
- Multiple elements can be tracked simultaneously

## Adapting from existing code

The existing `geometry/` directory maps directly:

| Existing | v2 | Change |
|----------|-----|--------|
| `scheduler.ts` — `initGeometryTriggers`, `markDirty` | `scheduler.ts` — `initGeometryScheduler`, `registerConsumer`, `markDirty` | Rename + add consumer registration API |
| `resize-tracker.ts` — `trackElementResize` | Same API | Minimal changes |

The main addition in v2 is the `registerConsumer` function — the existing scheduler uses a different pattern for notifying consumers. The v2 version formalizes the consumer registration so `useTrackedRect` (step 08) can subscribe.

## Dependencies

None. Geometry is a standalone utility module. It reads DOM measurements but doesn't import from any other v2 module.

Note: the scheduler needs to look up elements, which requires access to the registry. This is resolved at the hook level (`useTrackedRect` reads from `$registry`), not in the scheduler itself. The scheduler only operates on the callbacks it receives.

## Verification

- Unit tests: `registerConsumer` / unregister lifecycle, `markDirty` triggers rAF callback, scroll/resize listeners attached and removed on cleanup
- Resize-tracker tests: observe/unobserve lifecycle, callback invocation
- Run `pnpm check`
