# Page Editor — Target Architecture & Migration Plan

This document defines the target architecture for migrating `@enonic/page-editor` from its legacy jQuery/class-based implementation to a modern Preact + nanostores reactive model. It incorporates findings from architectural review and defines a concrete, phased implementation plan.

For background on why this migration is needed, see [`page-editor-preact-migration.md`](./page-editor-preact-migration.md).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Rendering Model](#rendering-model)
3. [State Model](#state-model)
4. [Event Model](#event-model)
5. [Geometry Model](#geometry-model)
6. [Coexistence Strategy](#coexistence-strategy)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Risk Register](#risk-register)

---

## Architecture Overview

The page editor is an iframe-embedded overlay on a server-rendered customer page. The server marks editable regions and components with `data-portal-component-type` and `data-portal-region` attributes. The editor discovers these markers, renders visual chrome (highlights, placeholders, menus), and communicates with the parent Content Studio frame via `IframeEventBus`.

### Design Principles

1. **The page DOM is not ours.** Customer HTML stays untouched. The editor observes it and renders its own chrome in response.
2. **Style isolation via Shadow DOM.** Editor styles never leak into customer pages. Customer styles never affect editor chrome.
3. **Path-first identity.** `ComponentPath` is the canonical identity everywhere — stores, events, lookups.
4. **Event-driven reconciliation.** The IframeEventBus is the authoritative source of DOM mutations. The editor reacts to bus events, not raw DOM observation.
5. **Two rendering modes.** Overlays render in a shared shadow root (position: fixed). In-flow placeholders render in per-node shadow islands.

### High-Level Diagram

```
┌── iframe body (server-rendered customer page) ─────────────────────────┐
│                                                                         │
│  Customer HTML (untouched, owns layout)                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ <div data-portal-region="main">                                    │  │
│  │   <div data-portal-component-type="part">                          │  │
│  │     <h1>Customer heading</h1>                                      │  │
│  │   </div>                                                           │  │
│  │   <div data-portal-component-type="text" (empty)>                  │  │
│  │     ┌── placeholder host ──────────────────────────────────┐       │  │
│  │     │ #shadow-root (per-placeholder island)                 │       │  │
│  │     │   <style>@import tailwind + editor tokens</style>     │       │  │
│  │     │   <PlaceholderCard type="text" />                     │       │  │
│  │     └───────────────────────────────────────────────────────┘       │  │
│  │   </div>                                                           │  │
│  │ </div>                                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌── Overlay Host (shared, appended to body) ────────────────────────┐  │
│  │ #shadow-root (single instance)                                     │  │
│  │   <style>@import tailwind + editor tokens</style>                  │  │
│  │   <Highlighter />           ← position: fixed, tracks hovered node │  │
│  │   <SelectionHighlighter />  ← position: fixed, tracks selected     │  │
│  │   <Shader />                ← full-viewport overlay for locked page │  │
│  │   <ContextMenu />           ← positioned near selected component   │  │
│  │   <DragOverlay />           ← follows cursor during drag           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                         ���
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Rendering Model

### Two Shadow DOM Strategies

The editor renders two fundamentally different kinds of chrome:

| Chrome Type | Examples | Rendering Strategy | Why |
|-------------|----------|-------------------|-----|
| **Overlays** | Highlighter, selection ring, shader, context menu, drag helper | Single shared shadow root, `position: fixed` elements | Purely visual, doesn't affect page layout. One shadow root = one style injection = efficient. |
| **In-flow placeholders** | Empty region placeholder, empty component card, error card | Per-node shadow root islands | Must participate in customer page layout (push siblings, inherit flex). Must be style-isolated. Cannot use a single overlay because position depends on layout flow. |

### Why Not Portals Into Light DOM

Preact's `<Portal container={node}>` renders into the target node in the **light DOM**. A stylesheet inside a shadow root does not apply to elements outside that shadow root. Portaling into customer DOM means:
- Tailwind classes on the portaled elements resolve to nothing (no matching CSS)
- Customer page styles apply to the portaled content
- This directly contradicts the style isolation goal

### Overlay Host

One shadow root, appended to the iframe body at initialization:

```tsx
// rendering/overlay-host.ts
import { render } from 'react';

let overlayRoot: ShadowRoot;

function createOverlayHost(): ShadowRoot {
  const host = document.createElement('div');
  host.id = 'pe-overlay-host';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483646';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  injectEditorStyles(shadow);
  return shadow;
}

function mountOverlay(app: JSX.Element) {
  overlayRoot = createOverlayHost();
  const mount = document.createElement('div');
  overlayRoot.appendChild(mount);
  render(app, mount);
}
```

All overlay components render inside this single shadow root. They use `position: fixed` with coordinates derived from `getBoundingClientRect()` of tracked page elements.

### Placeholder Islands

Each empty component/region gets a shadow root island injected as a child:

```tsx
// rendering/placeholder-island.ts
import { render } from 'react';

const PLACEHOLDER_HOST_ATTR = 'data-pe-placeholder-host';

function createPlaceholderIsland(
  container: HTMLElement,
  content: JSX.Element,
): { host: HTMLElement; shadow: ShadowRoot; unmount: () => void } {
  const host = document.createElement('div');
  host.setAttribute(PLACEHOLDER_HOST_ATTR, 'true');
  container.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  injectEditorStyles(shadow);

  const mount = document.createElement('div');
  shadow.appendChild(mount);
  render(content, mount);

  return {
    host,
    shadow,
    unmount: () => {
      render(null, mount);
      host.remove();
    },
  };
}
```

Key detail: the host element is marked with `data-pe-placeholder-host` so the editor's own parse/empty logic can **exclude** it from child counts. Without this, injecting a placeholder makes the node appear non-empty, creating a self-invalidating loop.

### Shared Style Injection

Both overlay host and placeholder islands need editor styles. Extract this into a shared utility:

```tsx
// rendering/inject-styles.ts
import editorCss from './editor-ui.css?inline';

function injectEditorStyles(shadowRoot: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = editorCss;
  shadowRoot.prepend(style);
}
```

The `editor-ui.css` file imports Tailwind, `@enonic/ui` tokens, and editor-specific utilities. It is built separately from the legacy `main.less` and bundled as an inline string via Vite's `?inline` import.

---

## State Model

### Path-First Registry

`ComponentPath` is the canonical identity in the IframeEventBus protocol. Every incoming event (select, add, remove, move, duplicate) references components by path. Using `ComponentPath.toString()` as the store key eliminates dual-identity reconciliation.

```typescript
// stores/registry.ts
import { map, atom } from 'nanostores';

// * Component Record

type ComponentRecord = {
  path: ComponentPath;
  type: 'text' | 'part' | 'layout' | 'fragment' | 'region' | 'page';
  element: HTMLElement | undefined;  // re-resolvable cache, NOT durable state
  parentPath: string | undefined;    // parent's path key
  children: string[];                // ordered child path keys
  empty: boolean;
  error: boolean;
  descriptor: string | undefined;
};

// * Primary Store

export const $registry = map<Record<string, ComponentRecord>>({});

// * Interaction State

export const $selectedPath = atom<string | undefined>(undefined);
export const $hoveredPath = atom<string | undefined>(undefined);
export const $dragState = atom<DragState | undefined>(undefined);
export const $locked = atom(false);
export const $textEditing = atom(false);

// * Derived / Computed

export function getRecord(path: string): ComponentRecord | undefined {
  return $registry.get()[path];
}

export function getRecordByElement(el: HTMLElement): ComponentRecord | undefined {
  const path = elementIndex.get(el);
  return path ? $registry.get()[path] : undefined;
}
```

### Element Reverse Index

For O(1) element-to-path lookup on mouse events:

```typescript
// stores/element-index.ts

// ? WeakMap allows GC of detached elements without manual cleanup
const elementIndex = new WeakMap<HTMLElement, string>();

function rebuildIndex(records: Record<string, ComponentRecord>): void {
  // WeakMap entries for detached elements are automatically GC'd
  for (const [pathKey, record] of Object.entries(records)) {
    if (record.element) {
      elementIndex.set(record.element, pathKey);
    }
  }
}

export { elementIndex, rebuildIndex };
```

The `WeakMap` is rebuilt after every reconciliation pass. Detached elements are automatically garbage-collected without manual cleanup.

### Why Not nanoid

The original proposal used `nanoid()` for component IDs. Problems:
- Every incoming IframeEventBus event arrives with a `ComponentPath` — requires path-to-id lookup
- Re-parsing produces new IDs, invalidating `$selectedId` and `$hoveredId`
- Creates permanent dual-identity overhead since `ComponentPath` can never be removed from the protocol

With path-first, incoming events are direct map lookups. Selection/hover state survives re-parse (paths are deterministic from DOM structure).

### Why nanostores Over @preact/signals

Both are viable. nanostores is chosen because:
- Already a declared dependency (`nanostores@^1.2.0` in `package.json`)
- Framework-agnostic — this package is consumed by non-Preact code via `PageEditor.on()`
- Integrates with Preact via `@nanostores/preact` (`useStore` hook)
- The `$` prefix naming convention is already in the project's TypeScript rules

If performance profiling later shows `useStore` re-render overhead is a problem, migrating to `@preact/signals` is straightforward since the store shapes are identical.

---

## Event Model

### IframeEventBus Adapter

The existing `IframeEventBus` protocol is preserved. An adapter layer translates incoming events into store mutations and outgoing events read from stores:

```typescript
// adapter/bus-adapter.ts

function registerBusHandlers(): () => void {
  const handlers: Array<() => void> = [];

  // * Incoming: Selection

  const selectHandler = (event: SelectComponentViewEvent) => {
    // SelectComponentViewEvent.getPath() returns string, not ComponentPath
    const pathStr = event.getPath();
    if (!pathStr) return;
    const path = ComponentPath.fromString(pathStr);
    $selectedPath.set(path.toString());
  };
  SelectComponentViewEvent.on(selectHandler);
  handlers.push(() => SelectComponentViewEvent.un(selectHandler));

  const deselectHandler = (event: DeselectComponentViewEvent) => {
    // DeselectComponentViewEvent.getPath() returns string | undefined
    const pathStr = event.getPath();
    if (pathStr) {
      const path = ComponentPath.fromString(pathStr);
      if ($selectedPath.get() === path.toString()) {
        $selectedPath.set(undefined);
      }
    } else {
      $selectedPath.set(undefined);
    }
  };
  DeselectComponentViewEvent.on(deselectHandler);
  handlers.push(() => DeselectComponentViewEvent.un(deselectHandler));

  // * Incoming: Mutations

  const addHandler = (event: AddComponentViewEvent) => {
    // AddComponentViewEvent.getComponentPath() returns ComponentPath
    // AddComponentViewEvent.getComponentType() returns ComponentType
    const path = event.getComponentPath();
    const parentPath = path.getParentPath();
    reconcileSubtree(parentPath.toString());
  };
  AddComponentViewEvent.on(addHandler);
  handlers.push(() => AddComponentViewEvent.un(addHandler));

  const removeHandler = (event: RemoveComponentViewEvent) => {
    // RemoveComponentViewEvent.getComponentPath() returns ComponentPath
    const path = event.getComponentPath();
    const parentPath = path.getParentPath();
    removeFromRegistry(path.toString());
    // Reconcile the parent to update emptiness and child ordering
    reconcileSubtree(parentPath.toString());
  };
  RemoveComponentViewEvent.on(removeHandler);
  handlers.push(() => RemoveComponentViewEvent.un(removeHandler));

  const moveHandler = (event: MoveComponentViewEvent) => {
    // MoveComponentViewEvent.getFrom() returns ComponentPath
    // MoveComponentViewEvent.getTo() returns ComponentPath
    const from = ComponentPath.fromString(event.getFrom().toString());
    const to = ComponentPath.fromString(event.getTo().toString());
    const oldParent = from.getParentPath();
    const newParent = to.getParentPath();
    moveInRegistry(from.toString(), to.toString());
    // Reconcile BOTH old and new parent subtrees
    reconcileSubtree(oldParent.toString());
    if (oldParent.toString() !== newParent.toString()) {
      reconcileSubtree(newParent.toString());
    }
  };
  MoveComponentViewEvent.on(moveHandler);
  handlers.push(() => MoveComponentViewEvent.un(moveHandler));

  const loadRequestHandler = (event: LoadComponentViewEvent) => {
    // LoadComponentViewEvent.getComponentPath() returns ComponentPath
    // LoadComponentViewEvent.isExisting() returns boolean
    const path = event.getComponentPath();
    // ! Do NOT reconcile here — DOM is not yet updated.
    // Mark as loading; reconciliation happens on ComponentLoadedEvent.
    markAsLoading(path.toString());
  };
  LoadComponentViewEvent.on(loadRequestHandler);
  handlers.push(() => LoadComponentViewEvent.un(loadRequestHandler));

  const loadCompletedHandler = (event: ComponentLoadedEvent) => {
    // ComponentLoadedEvent.getPath() returns ComponentPath
    // This fires AFTER the external renderer has replaced the DOM.
    const path = event.getPath();
    unmarkLoading(path.toString());
    reconcileSubtree(path.toString());
  };
  ComponentLoadedEvent.on(loadCompletedHandler);
  handlers.push(() => ComponentLoadedEvent.un(loadCompletedHandler));

  const duplicateHandler = (event: DuplicateComponentViewEvent) => {
    // DuplicateComponentViewEvent.getComponentPath() returns ComponentPath
    // The path points to the NEW item's position (source is at index - 1)
    const path = event.getComponentPath();
    const parentPath = path.getParentPath();
    reconcileSubtree(parentPath.toString());
  };
  DuplicateComponentViewEvent.on(duplicateHandler);
  handlers.push(() => DuplicateComponentViewEvent.un(duplicateHandler));

  const resetHandler = (event: ResetComponentViewEvent) => {
    // ResetComponentViewEvent.getComponentPath() returns ComponentPath
    const path = event.getComponentPath();
    reconcileSubtree(path.toString());
  };
  ResetComponentViewEvent.on(resetHandler);
  handlers.push(() => ResetComponentViewEvent.un(resetHandler));

  // * Incoming: Page State

  const lockHandler = (event: SetPageLockStateEvent) => {
    // SetPageLockStateEvent.isToLock() returns boolean
    $locked.set(event.isToLock());
  };
  SetPageLockStateEvent.on(lockHandler);
  handlers.push(() => SetPageLockStateEvent.un(lockHandler));

  const modifyHandler = (event: SetModifyAllowedEvent) => {
    // SetModifyAllowedEvent.isModifyAllowed() returns boolean
    if (!event.isModifyAllowed()) {
      $locked.set(true);
    }
  };
  SetModifyAllowedEvent.on(modifyHandler);
  handlers.push(() => SetModifyAllowedEvent.un(modifyHandler));

  const pageStateHandler = (event: PageStateEvent) => {
    // PageStateEvent.getPageJson() returns object | null
    PageState.setState(
      event.getPageJson() ? new PageBuilder().fromJson(event.getPageJson()).build() : null
    );
  };
  PageStateEvent.on(pageStateHandler);
  handlers.push(() => PageStateEvent.un(pageStateHandler));

  const textUpdateHandler = (event: UpdateTextComponentViewEvent) => {
    // UpdateTextComponentViewEvent.getComponentPath() returns ComponentPath
    // UpdateTextComponentViewEvent.getText() returns string
    // UpdateTextComponentViewEvent.getOrigin() returns ComponentTextUpdatedOrigin
    if (event.getOrigin() === 'live') return; // ignore own echoes
    const path = event.getComponentPath();
    updateTextContent(path.toString(), event.getText());
  };
  UpdateTextComponentViewEvent.on(textUpdateHandler);
  handlers.push(() => UpdateTextComponentViewEvent.un(textUpdateHandler));

  // * Teardown
  return () => handlers.forEach(h => h());
}
```

### Event Matrix

Complete mapping of incoming events to adapter behavior:

| Event Class | API | Adapter Action |
|-------------|-----|----------------|
| `SelectComponentViewEvent` | `.getPath(): string` | Set `$selectedPath` |
| `DeselectComponentViewEvent` | `.getPath(): string` | Clear `$selectedPath` |
| `AddComponentViewEvent` | `.getComponentPath(): ComponentPath`, `.getComponentType(): ComponentType` | Reconcile parent subtree |
| `RemoveComponentViewEvent` | `.getComponentPath(): ComponentPath` | Remove record, reconcile parent |
| `MoveComponentViewEvent` | `.getFrom(): ComponentPath`, `.getTo(): ComponentPath` | Move record, reconcile both parents |
| `LoadComponentViewEvent` | `.getComponentPath(): ComponentPath`, `.isExisting(): boolean` | Mark loading (defer reconcile) |
| `ComponentLoadedEvent` | `.getPath(): ComponentPath` | Unmark loading, reconcile subtree |
| `DuplicateComponentViewEvent` | `.getComponentPath(): ComponentPath` | Reconcile parent subtree |
| `ResetComponentViewEvent` | `.getComponentPath(): ComponentPath` | Reconcile subtree |
| `SetPageLockStateEvent` | `.isToLock(): boolean` | Set `$locked` |
| `SetModifyAllowedEvent` | `.isModifyAllowed(): boolean` | Set `$locked` if not allowed |
| `PageStateEvent` | `.getPageJson(): object \| null` | Update `PageState` singleton |
| `UpdateTextComponentViewEvent` | `.getComponentPath(): ComponentPath`, `.getText(): string`, `.getOrigin()` | Update text content (skip if origin=live) |
| `SetComponentStateEvent` | `.getPath(): string`, `.isProcessing(): boolean` | Toggle loading spinner state |
| `CreateOrDestroyDraggableEvent` | `.getType(): string`, `.isCreate(): boolean` | **Legacy-only** (Phase 4) |
| `SetDraggableVisibleEvent` | `.getType(): string`, `.isVisible(): boolean` | **Legacy-only** (Phase 4) |

### Reconciliation: Re-resolving Element References

Element references are **cache**, not durable state. After any mutation event that can change the DOM:

```typescript
// reconciliation/reconcile.ts

function reconcileSubtree(rootPath: string): void {
  const record = getRecord(rootPath);
  if (!record) return;

  // Re-walk DOM from the known parent element
  const parentEl = record.element;
  if (!parentEl) return;

  const freshNodes = parseSubtree(parentEl, record.path);

  // Update registry with fresh element refs and child ordering
  for (const [pathKey, node] of Object.entries(freshNodes)) {
    const existing = $registry.get()[pathKey];
    if (existing) {
      // Update element ref and derived state
      $registry.setKey(pathKey, {
        ...existing,
        element: node.element,
        empty: node.empty,
        error: node.error,
        children: node.children,
      });
    } else {
      // New component appeared
      $registry.setKey(pathKey, node);
    }
  }

  // Rebuild reverse index
  rebuildIndex($registry.get());

  // Update placeholder islands
  syncPlaceholders();

  // Schedule geometry update
  scheduleGeometryUpdate();
}
```

### Move Handling: Path Remapping

Moving a component changes its `ComponentPath` — and for layouts/fragments, every descendant path changes too. Since `ComponentPath` is the store key, `moveInRegistry` must rewrite keys and remap active interaction state:

```typescript
// reconciliation/move.ts

function moveInRegistry(fromPath: string, toPath: string): void {
  const registry = $registry.get();
  const record = registry[fromPath];
  if (!record) return;

  // Collect all descendants (layouts have nested regions and components)
  const affectedPaths = collectDescendantPaths(fromPath, registry);

  // Remove old entries
  for (const oldPath of affectedPaths) {
    $registry.setKey(oldPath, undefined);
  }
  $registry.setKey(fromPath, undefined);

  // Compute new paths by replacing the prefix
  const newEntries: Array<[string, ComponentRecord]> = [];

  // The moved node itself
  newEntries.push([toPath, { ...record, path: ComponentPath.fromString(toPath) }]);

  // All descendants: replace the `fromPath` prefix with `toPath`
  for (const oldPath of affectedPaths) {
    const descendant = registry[oldPath];
    if (!descendant) continue;
    const newPath = toPath + oldPath.slice(fromPath.length);
    newEntries.push([newPath, {
      ...descendant,
      path: ComponentPath.fromString(newPath),
      parentPath: newPath.includes('/')
        ? newPath.slice(0, newPath.lastIndexOf('/'))
        : undefined,
    }]);
  }

  // Insert new entries
  for (const [path, entry] of newEntries) {
    $registry.setKey(path, entry);
  }

  // * Remap active interaction state if it pointed at moved nodes
  const selected = $selectedPath.get();
  if (selected === fromPath) {
    $selectedPath.set(toPath);
  } else if (selected && affectedPaths.includes(selected)) {
    $selectedPath.set(toPath + selected.slice(fromPath.length));
  }

  const hovered = $hoveredPath.get();
  if (hovered === fromPath) {
    $hoveredPath.set(toPath);
  } else if (hovered && affectedPaths.includes(hovered)) {
    $hoveredPath.set(toPath + hovered.slice(fromPath.length));
  }
}

function collectDescendantPaths(
  rootPath: string,
  registry: Record<string, ComponentRecord>,
): string[] {
  const prefix = rootPath + '/';
  return Object.keys(registry).filter(key => key.startsWith(prefix));
}
```

Key behaviors:
- **Descendant rewriting**: A moved layout carries its regions and their children. All keys are rewritten with the new path prefix.
- **Active state remapping**: If `$selectedPath` or `$hoveredPath` pointed at the moved node or any descendant, they are updated to the new path. Without this, selection/hover would point at a stale key after the move.
- **Parent reconciliation** (in the bus adapter) happens after `moveInRegistry` — it handles emptiness, child ordering, and placeholders for both old and new parent regions.

### MutationObserver as Safety Net

The IframeEventBus is the primary reconciliation trigger. But external renderers can replace DOM outside the bus protocol (e.g., custom component load flows, third-party scripts). A `MutationObserver` catches these:

```typescript
// reconciliation/mutation-observer.ts

let observer: MutationObserver;

function startDomObserver(root: HTMLElement): void {
  observer = new MutationObserver((mutations) => {
    // Only react to structural changes in tracked nodes
    const affectedPaths = new Set<string>();

    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      // Find the nearest tracked ancestor
      const tracked = findTrackedAncestor(mutation.target as HTMLElement);
      if (tracked) {
        affectedPaths.add(tracked);
      }
    }

    if (affectedPaths.size > 0) {
      // Debounce: wait one microtask for batch DOM updates to settle
      queueMicrotask(() => {
        for (const path of affectedPaths) {
          reconcileSubtree(path);
        }
      });
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });
}

function findTrackedAncestor(el: HTMLElement): string | undefined {
  let current: HTMLElement | null = el;
  while (current) {
    const path = elementIndex.get(current);
    if (path) return path;
    current = current.parentElement;
  }
  return undefined;
}
```

The observer is configured for `childList` only (structural changes), not attributes or character data — keeping overhead minimal.

---

## Geometry Model

### The Problem

Overlay elements (highlighter, selection ring, context menu) must track the viewport position of customer DOM elements. This position changes on:
- Scroll (page or any ancestor with `overflow`)
- Window resize
- Element resize (content change, lazy load)
- Layout shifts (font load, image decode, animation)
- DOM mutations (element added/removed above target)

`ResizeObserver` alone only catches element resize. A complete solution needs multiple triggers coalesced into a single measurement pass.

### Central Geometry Scheduler

```typescript
// geometry/scheduler.ts

type GeometryConsumer = {
  targetPath: string;
  callback: (rect: DOMRect) => void;
};

const consumers: GeometryConsumer[] = [];
let frameId: number | undefined;
let dirty = false;

function registerConsumer(consumer: GeometryConsumer): () => void {
  consumers.push(consumer);
  markDirty();
  return () => {
    const idx = consumers.indexOf(consumer);
    if (idx >= 0) consumers.splice(idx, 1);
  };
}

function markDirty(): void {
  if (!dirty) {
    dirty = true;
    frameId = requestAnimationFrame(measure);
  }
}

function measure(): void {
  dirty = false;
  frameId = undefined;

  for (const consumer of consumers) {
    const record = getRecord(consumer.targetPath);
    if (!record?.element) continue;

    const rect = record.element.getBoundingClientRect();
    consumer.callback(rect);
  }
}

// * Triggers

function initGeometryTriggers(): () => void {
  const scrollHandler = () => markDirty();
  const resizeHandler = () => markDirty();

  // Capture scroll on any scrollable ancestor (not just window)
  document.addEventListener('scroll', scrollHandler, { capture: true, passive: true });
  window.addEventListener('resize', resizeHandler, { passive: true });

  return () => {
    document.removeEventListener('scroll', scrollHandler, { capture: true });
    window.removeEventListener('resize', resizeHandler);
    if (frameId != null) cancelAnimationFrame(frameId);
  };
}
```

### Usage in Overlay Components

```tsx
// components/Highlighter.tsx

function Highlighter({ targetPath }: { targetPath: string }) {
  const [rect, setRect] = useState<DOMRect | undefined>(undefined);

  useEffect(() => {
    return registerConsumer({
      targetPath,
      callback: setRect,
    });
  }, [targetPath]);

  if (!rect) return null;

  return (
    <div
      class="pointer-events-none fixed border-2 border-blue-500 transition-[top,left,width,height] duration-[16ms]"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    />
  );
}
```

The geometry scheduler:
- Coalesces multiple triggers into one `rAF` callback (no redundant measurements)
- Handles scroll at capture phase (catches scrollable containers, not just window)
- Handles resize via window listener
- Is manually triggered after reconciliation (`scheduleGeometryUpdate()` calls `markDirty()`)

### ResizeObserver as Supplement

For element-level resize (content changes that don't trigger scroll/window resize):

```typescript
// geometry/resize-tracker.ts

const resizeObserver = new ResizeObserver(() => markDirty());

function trackElementResize(el: HTMLElement): () => void {
  resizeObserver.observe(el);
  return () => resizeObserver.unobserve(el);
}
```

This is attached to the currently hovered/selected elements only — not all tracked elements.

---

## Coexistence Strategy

### Adapter-First, Not Replace-First

The new Preact system runs **alongside** the legacy code during migration. It does not replace legacy internals immediately. Instead:

1. The new system reads from the same IframeEventBus events
2. The new system renders its own chrome in its own shadow roots
3. Legacy chrome is **disabled** via feature flags per surface (not just hidden)
4. Legacy behavioral code (drag-and-drop, event firing) stays until Phase 4

### Ownership Switch

Each migrated surface needs an explicit ownership transfer — not just CSS hiding. When both legacy and new systems listen to the same events and respond to the same interactions, you get duplicate event firing, conflicting visual state, and unpredictable behavior.

The mechanism is a feature-flag registry that disables legacy listeners per surface:

```typescript
// coexistence/ownership.ts

// ? Each surface can be independently switched from legacy to new UI.
// When a surface is owned by the new system, legacy code must skip its
// handling for that surface.

type Surface =
  | 'placeholder'       // Phase 1: in-flow placeholders
  | 'highlighter'       // Phase 2: hover highlight
  | 'selection'         // Phase 2: selection highlight + context menu
  | 'shader'            // Phase 2: locked page overlay
  | 'hover-detection'   // Phase 3: mouseover → highlight
  | 'click-selection'   // Phase 3: click → select/deselect
  | 'keyboard'          // Phase 3: keyboard shortcut forwarding
  | 'drag-drop';        // Phase 4: component reordering

const ownedByNewUI = new Set<Surface>();

function transferOwnership(surface: Surface): void {
  ownedByNewUI.add(surface);
}

function isOwnedByNewUI(surface: Surface): boolean {
  return ownedByNewUI.has(surface);
}

// Exported for legacy code to check before acting
export { isOwnedByNewUI, transferOwnership };
```

Legacy code checks ownership before executing surface-specific behavior:

```typescript
// In legacy ItemView.ts highlight logic:
if (isOwnedByNewUI('highlighter')) return;  // Skip — new UI handles this

// In legacy ItemView.ts click/select logic:
if (isOwnedByNewUI('click-selection')) return;  // Skip — new UI handles this

// In legacy Highlighter.ts:
if (isOwnedByNewUI('highlighter')) return;  // Don't show legacy highlight
```

The ownership transfer happens at initialization of each phase:

```typescript
// In Phase 1 init:
transferOwnership('placeholder');

// In Phase 2 init:
transferOwnership('highlighter');
transferOwnership('selection');
transferOwnership('shader');

// In Phase 3 init:
transferOwnership('hover-detection');
transferOwnership('click-selection');
transferOwnership('keyboard');
```

This ensures:
- No duplicate event handlers respond to the same interaction
- No duplicate outgoing events fire to the parent Content Studio
- Selection state is managed by exactly one system at a time
- Each surface can be rolled back independently by removing the ownership transfer

### Bridge Point

`PageView.getComponentViewByPath()` ([PageView.ts:488](../src/main/resources/assets/js/page-editor/PageView.ts)) is the canonical bridge. The legacy system can resolve any component from a path. During coexistence, the new system can query legacy state through this bridge when needed.

### Emptiness Detection

Legacy `ComponentView` derives emptiness from DOM child structure. The editor's own placeholder hosts must be excluded:

```typescript
// parse/emptiness.ts

function isNodeEmpty(el: HTMLElement): boolean {
  for (const child of el.children) {
    // Skip editor-injected placeholder hosts
    if (child.hasAttribute(PLACEHOLDER_HOST_ATTR)) continue;
    // Skip editor-injected elements entirely
    if (child.id === 'pe-overlay-host') continue;
    return false;
  }
  return true;
}
```

This replaces the naive `!el.children.length` check from the original proposal.

### Click Suppression

The legacy code suppresses customer page interactions:
- Links are disabled: `$(el).find('a').on('click', e => e.preventDefault())`
- Keyboard events are intercepted and forwarded to parent

The new system must do the same:

```typescript
// interaction/click-guard.ts

function suppressCustomerInteractions(root: HTMLElement): () => void {
  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Allow clicks on editor chrome (inside shadow roots)
    if (target.closest(`[${PLACEHOLDER_HOST_ATTR}]`)) return;

    // Find the nearest tracked component
    const tracked = target.closest(
      '[data-portal-component-type], [data-portal-region]'
    );

    if (tracked) {
      e.preventDefault();
      e.stopPropagation();
      // Dispatch to interaction handler
      handleComponentClick(tracked as HTMLElement, e);
    }
  }

  root.addEventListener('click', handleClick, { capture: true });
  return () => root.removeEventListener('click', handleClick, { capture: true });
}
```

Using `capture: true` ensures the editor intercepts clicks before customer page handlers fire.

---

## Implementation Phases

### Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 0: Runtime Primitives** | Done | `new-ui/` runtime bootstrapped in the live editor: shared overlay host, placeholder islands, shared style injection, path registry, DOM parsing for both page and fragment shells, geometry scheduler, bus adapter wiring, path-scoped subtree reconciliation, and mutation-observer safety net are all active on this branch. |
| **Phase 1: In-Flow Placeholders** | Done | Empty region and non-page component placeholders now render through per-node shadow islands, including error-state cards. The legacy placeholder DOM is suppressed for surfaces owned by the new runtime. |
| **Phase 2: Overlay Surfaces** | Done | Hover highlighter, selection crosshair, shader, and context menu now render inside the shared overlay shadow root, with legacy overlay chrome suppressed via `body.pe-overlay-active`. |
| **Phase 3: Interaction Systems** | Done | Hover detection, click selection, deselection, right-click context menu, keyboard forwarding, selection persistence, and bus-driven reconciliation are owned by the new runtime for both page and fragment mode. |
| **Phase 4: Drag and Drop** | Partial | The legacy jQuery UI sortable/draggable engine still performs physical moves and context-window inserts, but the new runtime now owns drag-session feedback state: it renders the fixed drag preview, target-region highlighter, shadow-root drop placeholder, suppresses conflicting overlay chrome during drag, and preserves the legacy post-drop click guard. |
| **Phase 5: Text Editing & Advanced Features** | Partial | Session-storage selection persistence, fragment mode, the async page placeholder, and legacy text-mode synchronization are now implemented on this branch. Inline rich-text editing itself still needs its own design and migration pass. |

### Phase 0: Runtime Primitives

**Goal:** Build the infrastructure that all subsequent phases depend on.

**Deliverables:**

1. **Overlay host** — Single shadow root for all fixed-position overlay chrome
2. **Placeholder island factory** — Function to create per-node shadow islands
3. **Style injection** — Shared `editor-ui.css` built from Tailwind + @enonic/ui tokens
4. **Path registry** — `$registry` store + `elementIndex` WeakMap
5. **Parse function** — Walk DOM, produce `Record<string, ComponentRecord>`
6. **Geometry scheduler** — rAF-coalesced measurement loop with scroll/resize triggers
7. **Bus adapter skeleton** — Event listener registration/teardown, store mutation hooks
8. **Reconciliation engine** — Subtree re-parse + index rebuild
9. **MutationObserver** — Safety net for non-bus DOM changes

**Files to create:**

```
src/main/resources/assets/js/new-ui/
├── rendering/
│   ├── overlay-host.ts          # Shared overlay shadow root
│   ├── placeholder-island.ts    # Per-node shadow root factory
│   └── inject-styles.ts         # Style injection utility
├── stores/
│   ├── registry.ts              # $registry, $selectedPath, $hoveredPath, etc.
│   └── element-index.ts         # WeakMap reverse lookup
├── parse/
│   ├── parse-page.ts            # Full DOM walk → registry records
│   ├── parse-subtree.ts         # Partial re-parse for reconciliation
│   └── emptiness.ts             # Empty detection (excludes editor nodes)
├── geometry/
│   ├── scheduler.ts             # rAF measurement loop
│   └── resize-tracker.ts        # ResizeObserver supplement
├── adapter/
│   ├── bus-adapter.ts           # IframeEventBus → store mutations
│   └── reconcile.ts             # Event-driven subtree reconciliation
├── interaction/
│   ├── click-guard.ts           # Suppress customer page interactions
│   ├── hover-handler.ts         # Document-level mouseover → $hoveredPath
│   └── selection-handler.ts     # Click → $selectedPath + bus event
└── init.ts                      # Entry point: create hosts, parse, register bus
```

**Acceptance criteria:**
- Overlay host renders into a shadow root, styles are isolated
- Placeholder island renders styled content inside a customer DOM node
- Parse produces correct records for a sample page with nested regions/components
- Geometry scheduler tracks element position through scroll
- Bus adapter responds to at least `InitializeLiveEditEvent`

---

### Phase 1: In-Flow Placeholders

**Goal:** Replace legacy `RegionPlaceholder`, `ItemViewPlaceholder`, and descriptor-based placeholders with Preact components rendered in shadow islands.

**Migration order (simplest → most complex):**

#### 1a. RegionPlaceholder

The cleanest test case. An empty region shows a drop-zone affordance.

Legacy: [`RegionPlaceholder.ts`](../src/main/resources/assets/js/page-editor/RegionPlaceholder.ts) — 19 lines, extends `ItemViewPlaceholder`, adds "Drop here" text.

New:

```tsx
// components/placeholders/RegionPlaceholder.tsx

type RegionPlaceholderProps = {
  regionName: string;
};

function RegionPlaceholder({ regionName }: RegionPlaceholderProps) {
  return (
    <div
      data-component="RegionPlaceholder"
      class="flex items-center justify-center min-h-[60px] border border-dashed border-bdr-soft rounded-lg bg-surface-soft/50"
    >
      <span class="text-sm text-fg-muted">
        {i18n('live.view.region.placeholder', regionName)}
      </span>
    </div>
  );
}
RegionPlaceholder.displayName = 'RegionPlaceholder';
```

Integration:

```typescript
// In syncPlaceholders(), when a region record is empty:
const island = createPlaceholderIsland(
  record.element,
  <RegionPlaceholder regionName={record.path.getLastSegment()} />,
);
```

#### 1b. Component Placeholders (Text, Part, Layout, Fragment)

Each empty component type has a specific placeholder with icon, type label, and descriptor info.

Legacy: `TextPlaceholder.ts` (12 lines), `PartPlaceholder.ts` (18 lines), `LayoutPlaceholder.ts` (18 lines), `FragmentPlaceholder.ts` (10 lines) — all extend `ItemViewPlaceholder`.

New — unified component with type-specific rendering:

```tsx
// components/placeholders/ComponentPlaceholder.tsx

type ComponentPlaceholderProps = {
  type: ComponentRecord['type'];
  descriptor: string | undefined;
  error: boolean;
};

function ComponentPlaceholder({ type, descriptor, error }: ComponentPlaceholderProps) {
  if (error) {
    return (
      <div
        data-component="ComponentPlaceholder"
        class="flex items-center gap-2 p-4 min-h-[80px] border border-red-300 rounded-lg bg-red-50"
      >
        <IconError class="size-5 text-red-500 shrink-0" />
        <span class="text-sm text-red-700">
          {i18n('live.view.component.error')}
        </span>
      </div>
    );
  }

  return (
    <div
      data-component="ComponentPlaceholder"
      class="flex items-center gap-2 p-4 min-h-[80px] border border-dashed border-bdr-soft rounded-lg bg-surface-soft/50"
    >
      <ComponentIcon type={type} class="size-5 text-fg-muted shrink-0" />
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-fg-default">
          {getTypeLabel(type)}
        </span>
        {descriptor && (
          <span class="text-xs text-fg-muted truncate max-w-[200px]">
            {descriptor}
          </span>
        )}
      </div>
    </div>
  );
}
ComponentPlaceholder.displayName = 'ComponentPlaceholder';
```

#### 1c. PagePlaceholder

**Deferred.** The page placeholder carries async behavior: a `PageDescriptorDropdown` fetched via `GetContentTypeByNameRequest` ([PagePlaceholder.ts:29](../src/main/resources/assets/js/page-editor/PagePlaceholder.ts)). This requires:
- A Preact async component or `useSWR`-style hook
- A way to fire `SelectPageDescriptorEvent` from the new UI
- Replacing the `q` promise with native `async/await`

Migrate this **after** the simpler placeholders are stable.

**Acceptance criteria (Phase 1):**
- Empty regions show styled placeholder inside a shadow island
- Empty components show type-appropriate placeholder
- Error components show red error card
- Customer page CSS does not affect placeholder styling
- Placeholder hosts are excluded from empty detection (no flicker)
- Adding content to a region removes the placeholder
- Placeholder appearance matches Storybook stories

---

### Phase 2: Overlay Surfaces

**Goal:** Replace legacy `Highlighter`, `SelectedHighlighter`, `Shader`, and `ContextMenu` with Preact components in the shared overlay shadow root.

**Migration order:**

#### 2a. Highlighter (Hover)

Legacy: [`Highlighter.ts`](../src/main/resources/assets/js/page-editor/Highlighter.ts) — 164 lines. SVG-based with two modes: `RECTANGLE` (simple border on hover) and `CROSSHAIR` (crosshair lines through element for selection).

New — hover mode only first:

```tsx
// components/overlay/Highlighter.tsx

function Highlighter() {
  const hoveredPath = useStore($hoveredPath);
  const [rect, setRect] = useState<DOMRect | undefined>();

  useEffect(() => {
    if (!hoveredPath) return;
    return registerConsumer({ targetPath: hoveredPath, callback: setRect });
  }, [hoveredPath]);

  if (!hoveredPath || !rect) return null;

  return (
    <div
      data-component="Highlighter"
      class="pointer-events-none fixed border-2 border-neutral-700/80 rounded-sm"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    />
  );
}
Highlighter.displayName = 'Highlighter';
```

#### 2b. SelectionHighlighter (Crosshair Mode)

The crosshair mode draws full-viewport SVG lines through the selected element. This is kept as SVG:

```tsx
// components/overlay/SelectionHighlighter.tsx

function SelectionHighlighter() {
  const selectedPath = useStore($selectedPath);
  const [rect, setRect] = useState<DOMRect | undefined>();

  useEffect(() => {
    if (!selectedPath) return;
    return registerConsumer({ targetPath: selectedPath, callback: setRect });
  }, [selectedPath]);

  if (!selectedPath || !rect) return null;

  const { top, left, width, height } = rect;

  return (
    <svg
      data-component="SelectionHighlighter"
      class="pointer-events-none fixed inset-0 w-full h-full"
    >
      {/* Crosshair lines extending to viewport edges */}
      <line x1={left} y1="0" x2={left} y2="100%" class="stroke-blue-500 stroke-[0.5]" />
      <line x1={left + width} y1="0" x2={left + width} y2="100%" class="stroke-blue-500 stroke-[0.5]" />
      <line x1="0" y1={top} x2="100%" y2={top} class="stroke-blue-500 stroke-[0.5]" />
      <line x1="0" y1={top + height} x2="100%" y2={top + height} class="stroke-blue-500 stroke-[0.5]" />
      {/* Selection rectangle */}
      <rect
        x={left} y={top} width={width} height={height}
        class="fill-blue-500/5 stroke-blue-500 stroke-2"
        rx="2"
      />
    </svg>
  );
}
SelectionHighlighter.displayName = 'SelectionHighlighter';
```

#### 2c. Shader (Locked Page Overlay)

Legacy: [`Shader.ts`](../src/main/resources/assets/js/page-editor/Shader.ts) — 218 lines. Creates 5 div overlays for a "frame" effect around the selected/locked element.

New — simplified full-page overlay with click handling for locked menu:

```tsx
// components/overlay/Shader.tsx

function Shader() {
  const locked = useStore($locked);
  const selectedPath = useStore($selectedPath);
  const [rect, setRect] = useState<DOMRect | undefined>();

  useEffect(() => {
    if (!selectedPath) return;
    return registerConsumer({ targetPath: selectedPath, callback: setRect });
  }, [selectedPath]);

  if (!locked) return null;

  function handleShaderClick(e: MouseEvent) {
    // Show locked context menu at click position
    const position = { x: e.clientX, y: e.clientY };
    showLockedContextMenu(position);
  }

  return (
    <div
      data-component="Shader"
      class="fixed inset-0 bg-black/20 cursor-pointer"
      style={{ pointerEvents: 'auto' }}
      onClick={handleShaderClick}
    />
  );
}
Shader.displayName = 'Shader';
```

#### 2d. Context Menu

Legacy: `ItemViewContextMenu` from lib-contentstudio. Renders a dropdown with actions (inspect, remove, duplicate, reset, etc.).

New — positioned relative to the selected element:

```tsx
// components/overlay/ContextMenu.tsx

function ContextMenu() {
  const selectedPath = useStore($selectedPath);
  const [position, setPosition] = useState<{ x: number; y: number } | undefined>();
  const record = selectedPath ? getRecord(selectedPath) : undefined;

  // Position below the selected element
  useEffect(() => {
    if (!record?.element) return;
    return registerConsumer({
      targetPath: selectedPath!,
      callback: (rect) => setPosition({ x: rect.left, y: rect.bottom + 4 }),
    });
  }, [selectedPath]);

  if (!selectedPath || !position || !record) return null;

  const actions = getActionsForType(record.type, record);

  return (
    <div
      data-component="ContextMenu"
      class="fixed bg-surface-default border border-bdr-default rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ top: `${position.y}px`, left: `${position.x}px`, pointerEvents: 'auto' }}
    >
      {actions.map(action => (
        <button
          key={action.id}
          class="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-50"
          disabled={!action.enabled}
          onClick={() => action.execute()}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
ContextMenu.displayName = 'ContextMenu';
```

**Acceptance criteria (Phase 2):**
- Hover highlight tracks element position through scroll
- Selection highlight shows crosshair mode
- Shader covers page in locked state
- Context menu appears for selected components
- All overlay chrome is inside the shared shadow root
- Legacy highlighting CSS is disabled (add `.pe-overlay-active` body class to suppress)

---

### Phase 3: Interaction Systems

**Goal:** Migrate hover detection, click selection, deselection, and keyboard handling. Drag-and-drop is deferred to Phase 4.

#### 3a. Hover Detection

```typescript
// interaction/hover-handler.ts

function initHoverDetection(): () => void {
  function handleMouseOver(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest(
      '[data-portal-component-type], [data-portal-region]'
    ) as HTMLElement | null;

    if (target) {
      const path = elementIndex.get(target);
      if (path && path !== $hoveredPath.get()) {
        $hoveredPath.set(path);
      }
    }
  }

  function handleMouseOut(e: MouseEvent) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget?.closest('[data-portal-component-type], [data-portal-region]')) {
      $hoveredPath.set(undefined);
    }
  }

  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  document.addEventListener('mouseout', handleMouseOut, { passive: true });

  return () => {
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);
  };
}
```

Key difference from original proposal: uses `mouseout` with `relatedTarget` check to clear hover state.

#### 3b. Click Selection & Deselection

```typescript
// interaction/selection-handler.ts

const OVERLAY_HOST_ID = 'pe-overlay-host';

function isOverlayChromeEvent(e: Event): boolean {
  // Shadow DOM retargets events: a click inside the overlay shadow root
  // appears at document level as targeting the overlay host element.
  // Use composedPath() to check the real origin.
  const path = e.composedPath();
  return path.some(
    (el) => el instanceof HTMLElement && el.id === OVERLAY_HOST_ID
  );
}

function initSelectionDetection(): () => void {

  function handleClick(e: MouseEvent) {
    // ! Ignore clicks originating from overlay chrome (context menu, shader, etc.)
    // Without this, clicking a menu action would deselect the component
    // because the overlay host is not inside [data-portal-*] tree.
    if (isOverlayChromeEvent(e)) return;

    const target = (e.target as HTMLElement).closest(
      '[data-portal-component-type], [data-portal-region]'
    ) as HTMLElement | null;

    if (target) {
      e.preventDefault();
      e.stopPropagation();

      const path = elementIndex.get(target);
      if (!path) return;

      const currentSelected = $selectedPath.get();

      if (currentSelected === path) {
        // Click on already-selected → deselect
        $selectedPath.set(undefined);
        new DeselectComponentEvent().fire();
      } else {
        // Deselect previous
        if (currentSelected) {
          new DeselectComponentEvent().fire();
        }
        // Select new
        $selectedPath.set(path);
        const record = getRecord(path);
        if (record) {
          new SelectComponentEvent({
            path: record.path,
            position: { x: e.clientX, y: e.clientY },
            rightClicked: false,
          }).fire();
        }
      }
    } else {
      // Click on empty space → deselect
      if ($selectedPath.get()) {
        $selectedPath.set(undefined);
        new DeselectComponentEvent().fire();
      }
    }
  }

  function handleContextMenu(e: MouseEvent) {
    // Right-click / context menu on a component → select with menu
    if (isOverlayChromeEvent(e)) return;

    const target = (e.target as HTMLElement).closest(
      '[data-portal-component-type], [data-portal-region]'
    ) as HTMLElement | null;

    if (target) {
      e.preventDefault();
      e.stopPropagation();

      const path = elementIndex.get(target);
      if (!path) return;

      // Select the component (or keep selection if already selected)
      $selectedPath.set(path);
      const record = getRecord(path);
      if (record) {
        new SelectComponentEvent({
          path: record.path,
          position: { x: e.clientX, y: e.clientY },
          rightClicked: true,
        }).fire();
      }
    }
  }

  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  return () => {
    document.removeEventListener('click', handleClick, { capture: true });
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  };
}
```

Key details:
- **`isOverlayChromeEvent()`** uses `event.composedPath()` to detect clicks originating inside the overlay shadow root. Shadow DOM retargets events: at the document level, `e.target` appears as the overlay host element, but `composedPath()` reveals the real origin inside the shadow tree.
- **`click` handler** never fires `rightClicked: true` — that's exclusively handled by the `contextmenu` event.
- **`contextmenu` handler** handles right-click selection and fires `SelectComponentEvent` with `rightClicked: true` to trigger the context menu in the parent Content Studio.
- Both handlers exit early for overlay chrome interactions, preventing deselection when clicking menus, shader, or other editor UI.

#### 3c. Keyboard Handling

Preserve existing behavior: intercept keyboard events, check parent key bindings, forward modifier combos:

```typescript
// interaction/keyboard-handler.ts

function initKeyboardHandling(): () => void {
  function handleKeyEvent(e: KeyboardEvent) {
    // Check if this matches a parent-frame key binding
    const bindings = Store.parentInstance()?.get('keyBindings') as KeyBinding[] | undefined;
    if (!bindings) return;

    const match = bindings.find(b => b.matches(e));
    if (match) {
      e.preventDefault();
      // Forward to parent via IframeEvent
      const modifierEvent = new IframeEvent('editor-modifier-pressed').setData({
        type: e.type,
        config: {
          bubbles: e.bubbles,
          cancelable: e.cancelable,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          keyCode: e.keyCode,
          charCode: e.charCode,
        },
      });
      IframeEventBus.get().fireEvent(modifierEvent);
    }
  }

  document.addEventListener('keydown', handleKeyEvent);
  document.addEventListener('keyup', handleKeyEvent);
  return () => {
    document.removeEventListener('keydown', handleKeyEvent);
    document.removeEventListener('keyup', handleKeyEvent);
  };
}
```

**Acceptance criteria (Phase 3):**
- Hover detection highlights components, clears on leave
- Click selects, click-on-selected deselects, click-on-empty deselects
- Customer page links/buttons don't fire
- Keyboard shortcuts forward to parent frame
- Selection state survives incoming bus events (reconciliation preserves path)

---

### Phase 4: Drag and Drop

**Partially implemented on this branch.** The drag-and-drop system ([`DragAndDrop.ts`](../src/main/resources/assets/js/page-editor/DragAndDrop.ts) — 638 lines) still relies on the legacy jQuery UI engine to:
- Manage sortable regions (jQuery UI sortable)
- Handle cross-region moves
- Create draggable items from the context window
- Validate drop targets (no nested layouts, fragment containment rules)
- Fire start/stop/dropped/canceled events to parent
- Maintain the 100ms "newly dropped" click suppression contract used by click handling

The new runtime now consumes an explicit drag-session seam from that engine and owns the drag feedback surfaces:
- Fixed drag preview in the shared overlay shadow root
- Target-region highlighter in the shared overlay shadow root
- Shadow-root drop placeholder mounted into the sortable placeholder container
- Hover/context-menu/highlighter suppression while dragging
- Click-selection parity with the legacy `isNewlyDropped()` / `nextClickDisabled` guards

This leaves the physical drag engine itself in legacy code for now. A future pass can replace the jQuery UI move/add mechanics entirely once the new drag visuals and interaction guards are proven stable.

---

### Phase 5: Text Editing & Advanced Features (Future)

**Mostly out of scope for Phases 0-3.** These features either required dedicated design work or were intentionally postponed so they would not block the core migration path.

| Feature | Why Deferred | Dependency |
|---------|-------------|------------|
| **Text editing** | The new runtime now mirrors the legacy `textMode` flag so hover, selection chrome, keyboard forwarding, and context-menu behavior back off correctly while CKEditor is active. Inline editing itself still requires a dedicated rich-text integration design pass. | Phase 3 (selection) must be stable first |
| **Page placeholder** | Implemented on this branch as a shadow-root overlay surface that loads page controllers with native async request handling and fires `SelectPageDescriptorEvent` from the new runtime. | Done |
| **Fragment mode** | Implemented on this branch. The new runtime now boots in fragment mode, parses the single root-component DOM shape, and preserves root-path selection semantics in session storage and reconciliation. | Done |
| **Session storage persistence** | Implemented on this branch. The new runtime now syncs `$selectedPath` to `SessionStorageHelper` and restores it during boot so selection survives live-editor reloads. | Done |

Each of these should get its own design section added to this document when ready for implementation. They do not affect the architectural decisions for Phases 0-3.

---

## Testing Strategy

### Current Coverage On This Branch

- Unit tests cover DOM parsing, subtree parsing, empty-state detection, placeholder/overlay shadow mounting, page-placeholder async loading and UI selection flow, reconciliation, selection persistence, drag-session syncing, hover handling, click selection, post-drop click suppression, context-menu opening, and keyboard forwarding.
- Storybook now includes runtime stories for the actual migrated surfaces:
  - `InFlowPlaceholderInFlex`
  - `PlaceholderStyleIsolation`
  - `OverlayOnScrolledPage`
  - `MultipleOverlays`
  - `DragSessionFeedback`
- `pnpm build:dev` exercises the Vite bundle for the migrated runtime, and `pnpm build-storybook` verifies the new Storybook stories compile against the real runtime components.

### Per-Phase Validation

| Phase | Storybook | Unit Tests | Integration |
|-------|-----------|------------|-------------|
| 0 | Shadow root renders styled content | Parse produces correct records | Bus adapter responds to init event |
| 1 | Placeholder variants match design | Empty detection excludes editor nodes | Placeholder appears/disappears on add/remove |
| 2 | Overlay positions track scroll | Geometry scheduler coalesces updates | Highlight follows component through page scroll |
| 3 | - | Click/hover handlers dispatch correct events | Full selection flow end-to-end in live editor |
| 4 | Drag feedback surfaces layer correctly during an active session | Drag state sync, hover suppression, keyboard suppression, and post-drop click suppression stay aligned with legacy drag semantics | Cross-region drag keeps placeholder/highlighter feedback aligned with the active target |

### Storybook Stories (Extending Existing)

The existing stories in [`.storybook/page-editor/`](../.storybook/page-editor/) validate visual appearance. Add stories for:
- Placeholder inside narrow flex container (tests in-flow behavior)
- Placeholder with aggressive customer CSS (tests shadow isolation)
- Overlay on scrolled page (tests geometry tracking)
- Multiple overlays simultaneously (tests z-index ordering)

### Runtime Verification

After each phase, test in the live editor against:
- A page with aggressive global CSS (`* { all: initial; }`, heavy resets)
- A page with 50+ components (performance)
- Narrow/wide viewports
- Locked and unlocked states
- Fragment editing mode

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Per-placeholder shadow roots cause layout issues | Medium | High | Test with flex/grid containers in Storybook. Use `display: contents` on host if needed. |
| Style injection per island is expensive (many empty components) | Low | Medium | Benchmark with 20+ placeholders. Consider shared `adoptedStyleSheets` if supported. |
| MutationObserver fires too often during complex operations | Medium | Medium | Debounce with `queueMicrotask`. Only observe `childList` on tracked subtrees. |
| Legacy and new systems conflict during coexistence | Medium | High | Ownership-switch registry (`isOwnedByNewUI()`) disables legacy handlers per surface. See [Coexistence Strategy](#coexistence-strategy). |
| ResizeObserver not supported in target browsers | Low | Low | Core product targets modern browsers. No polyfill needed. |
| `adoptedStyleSheets` not available in older Safari | Medium | Medium | Fall back to `<style>` injection (already the default approach). |
| Reconciliation after rapid add/remove causes flicker | Medium | Medium | Batch store updates. Use Preact's `batch()` for grouped mutations. |
| Cross-frame `instanceof` issues with event classes | Low | High | Preserve `iFrameSafeInstanceOf` checks in adapter layer. |

---

## Summary

The architecture splits cleanly into:
- **Rendering**: Two shadow DOM strategies (shared overlay + per-node islands)
- **State**: Path-first registry with element refs as cache
- **Events**: Bus adapter translates incoming events to store mutations
- **Geometry**: Central rAF scheduler with scroll/resize/observer triggers
- **Coexistence**: Adapter pattern, legacy stays until each surface is proven

Implementation proceeds Phase 0 → 1 → 2 → 3 → 4 → 5, with each phase delivering independently testable value. Drag-and-drop and text editing are explicitly deferred until the new rendering model is stable.
