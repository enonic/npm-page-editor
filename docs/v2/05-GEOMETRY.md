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
type ElementResolver = (path: ComponentPath) => HTMLElement | undefined;

function initGeometryScheduler(elementResolver: ElementResolver): () => void;
function registerConsumer(path: ComponentPath, callback: (rect: DOMRect) => void): () => void;
function markDirty(): void;
```

- `initGeometryScheduler` accepts an `ElementResolver` callback that maps paths to DOM elements (decouples the scheduler from the registry via dependency injection)
- Listens to `scroll` (capture phase on `document`, for nested scroll containers) and `resize` (passive) on `window`
- On dirty: batches all measurements into a single `requestAnimationFrame` pass
- Calls each registered consumer's callback with a cloned `getBoundingClientRect()` result
- Consumer callbacks must be pure reads — writing to the DOM inside a callback causes layout thrashing and invalidates later measurements in the same frame
- `initGeometryScheduler()` returns a cleanup function that removes listeners, cancels pending rAF, and clears all consumers
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
| `scheduler.ts` — `initGeometryTriggers`, `markDirty` | `scheduler.ts` — `initGeometryScheduler`, `registerConsumer`, `markDirty` | Rename + add consumer registration API + `ElementResolver` injection |
| `resize-tracker.ts` — `trackElementResize` | Same API | Minimal changes |

The main addition in v2 is the `registerConsumer` function — the existing scheduler uses a different pattern for notifying consumers. The v2 version formalizes the consumer registration so `useTrackedRect` (step 08) can subscribe.

## Dependencies

- `protocol/` — `ComponentPath` type (type-only import, no runtime dependency)

Geometry is a standalone utility module at runtime. Element lookup is decoupled via the `ElementResolver` callback injected at initialization, so the scheduler has no direct import of state or registry modules.

## Verification

- Unit tests: `registerConsumer` / unregister lifecycle, `markDirty` triggers rAF callback, scroll/resize listeners attached and removed on cleanup
- Resize-tracker tests: observe/unobserve lifecycle, callback invocation
- Run `pnpm check`
