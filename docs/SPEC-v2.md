# Page Editor v2 Spec

v2 is a clean reimplementation of the page editor UI layer. It replaces both the legacy jQuery/class-based code (`page-editor/`) and the transitional Preact layer (`new-ui/`) with a single, self-contained module that has no legacy dependencies.

## Goals

- No jQuery, no `lib-admin-ui`, no `lib-contentstudio` imports
- No class hierarchy (ItemView, ComponentView, RegionView, PageView)
- Page editor defines its own protocol — Content Studio imports it, not the other way around
- `ComponentPath` as a branded string type with pure utility functions
- Typed `postMessage` replaces `IframeEventBus` and class registration
- Context menu actions as data, not mutable `Action` class instances
- Inline rich-text editing removed (no text editing mode)

## Tech Stack

- **Preact** (via `preact/compat`, imported as `react`)
- **Nanostores** for reactive state
- **Shadow DOM** for style isolation (overlay host + placeholder islands)
- **Tailwind + @enonic/ui tokens** for styling
- **postMessage** for iframe communication

## Directory Structure

```
src/main/resources/assets/js/v2/
├── result.ts                ← Result<T, E> type + ok/err constructors
├── protocol/                ← PUBLIC: exported for Content Studio
│   ├── messages.ts          ← incoming/outgoing message types
│   ├── path.ts              ← ComponentPath type + pure functions
│   └── index.ts
├── transport/               ← postMessage communication
│   ├── channel.ts           ← typed send/receive wrapper
│   ├── adapter.ts           ← incoming messages → store mutations
│   └── index.ts
├── state/                   ← nanostores, one file per concern
│   ├── registry.ts          ← $registry (component tree)
│   ├── selection.ts         ← $selectedPath
│   ├── hover.ts             ← $hoveredPath
│   ├── drag.ts              ← $dragState
│   ├── page.ts              ← $locked, $modifyAllowed, $config
│   ├── context-menu.ts      ← $contextMenuState
│   ├── element-index.ts     ← WeakMap element→path
│   └── index.ts
├── parse/                   ← DOM → ComponentRecord
│   ├── parse-page.ts
│   ├── parse-subtree.ts
│   ├── emptiness.ts
│   └── index.ts
├── geometry/                ← layout measurement
│   ├── scheduler.ts         ← rAF-batched measurement loop
│   ├── resize-tracker.ts    ← ResizeObserver wrapper
│   └── index.ts
├── interaction/             ← user input handlers
│   ├── hover.ts
│   ├── selection.ts
│   ├── keyboard.ts
│   ├── navigation.ts
│   ├── component-drag.ts
│   ├── context-window-drag.ts
│   └── index.ts
├── actions/                 ← context menu system
│   ├── definitions.ts       ← action specs per component type
│   ├── resolve.ts           ← (type, state) → available actions
│   └── index.ts
├── rendering/               ← shadow DOM infrastructure
│   ├── overlay-host.ts
│   ├── placeholder-island.tsx
│   ├── inject-styles.ts
│   └── index.ts
├── components/              ← Preact UI
│   ├── OverlayApp.tsx
│   ├── Highlighter.tsx
│   ├── SelectionHighlighter.tsx
│   ├── Shader.tsx
│   ├── ContextMenu.tsx
│   ├── DragPreview.tsx
│   ├── DragTargetHighlighter.tsx
│   ├── ComponentPlaceholder.tsx
│   ├── RegionPlaceholder.tsx
│   ├── DragPlaceholder.tsx
│   ├── PagePlaceholderOverlay.tsx
│   └── index.ts
├── hooks/                   ← Preact hooks
│   ├── use-store.ts
│   ├── use-tracked-rect.ts
│   └── index.ts
├── reconcile.ts             ← DOM parse → registry update → placeholder sync
├── persistence.ts           ← selection session storage
└── init.ts                  ← entry point
```

---

## Conventions

### Error Handling

Use the `Result<T, E>` pattern (`v2/result.ts`) instead of throwing exceptions for operations that can fail with expected/recoverable errors (validation, parsing, lookups). Reserve `throw` for programmer errors and truly exceptional conditions.

```ts
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
```

---

## Module Designs

### protocol/

Public contract. Content Studio imports from here. Nothing in `protocol/` imports from any other v2 module.

#### path.ts

`ComponentPath` is a branded string with pure utility functions:

```ts
type ComponentPath = string & { readonly __brand: 'ComponentPath' };
```

Paths use an alternating `region-name / component-index` segment structure:

| Path | Kind | Meaning |
|------|------|---------|
| `"/"` | page (root) | The page node itself |
| `"/main"` | region | Top-level region named "main" |
| `"/main/0"` | component | First component in "main" region |
| `"/main/0/left"` | region | "left" region inside the layout at `/main/0` |
| `"/main/0/left/2"` | component | Third component in the nested "left" region |

Region paths always end with a name segment. Component paths always end with a numeric index. The root path `"/"` is a special case representing the page.

Functions:

- `root()` — returns root path `"/"`
- `fromString(raw)` — validates and brands a string; returns `Result<ComponentPath>` with an error string on malformed input (empty segments, negative indices, mismatched alternation)
- `parent(path)` — returns parent path or `undefined` for root
- `regionName(path)` — last region segment (valid on region paths and component paths — for components, returns the parent region name)
- `componentIndex(path)` — last numeric segment (valid on component paths; `undefined` for region paths and root)
- `append(path, region, index)` — builds a child path: `append("/main", undefined, 0)` → `"/main/0"`, `append("/main/0", "left", undefined)` → `"/main/0/left"`
- `insertAt(regionPath, index)` — shorthand for building an insertion target: `insertAt("/main", 2)` → `"/main/2"`
- `isRegion(path)` — true if path ends with a name segment (or is root)
- `isComponent(path)` — true if path ends with a numeric index
- `equals(a, b)` — string comparison
- `isDescendantOf(child, ancestor)` — prefix check
- `depth(path)` — number of segments

#### messages.ts

Typed discriminated unions for iframe communication. Every message includes `{ version: 2, source: 'page-editor' }` to distinguish from v1 IframeEventBus traffic during transition.

**Incoming (Content Studio → page editor):**

```ts
type IncomingMessage =
  | { type: 'init'; config: PageConfig }
  | { type: 'select'; path: ComponentPath; silent?: boolean }
  | { type: 'deselect'; path?: ComponentPath }
  | { type: 'add'; path: ComponentPath; componentType: ComponentType }
  | { type: 'remove'; path: ComponentPath }
  | { type: 'move'; from: ComponentPath; to: ComponentPath }
  | { type: 'load'; path: ComponentPath }
  | { type: 'duplicate'; path: ComponentPath }
  | { type: 'reset'; path: ComponentPath }
  | { type: 'set-component-state'; path: ComponentPath; processing: boolean }
  | { type: 'page-state'; page: PageDescriptor }
  | { type: 'set-lock'; locked: boolean }
  | { type: 'set-modify-allowed'; allowed: boolean }
  | { type: 'create-draggable'; componentType: string }
  | { type: 'destroy-draggable' }
  | { type: 'set-draggable-visible'; visible: boolean }
  | { type: 'page-controllers'; controllers: PageController[] };
```

**Outgoing (page editor → Content Studio):**

```ts
type OutgoingMessage =
  | { type: 'ready' }
  | { type: 'select'; path: ComponentPath; position?: { x: number; y: number }; rightClicked?: boolean }
  | { type: 'deselect'; path: ComponentPath }
  | { type: 'move'; from: ComponentPath; to: ComponentPath }
  | { type: 'add'; path: ComponentPath; componentType: ComponentType }
  | { type: 'remove'; path: ComponentPath }
  | { type: 'duplicate'; path: ComponentPath }
  | { type: 'reset'; path: ComponentPath }
  | { type: 'inspect'; path: ComponentPath }
  | { type: 'create-fragment'; path: ComponentPath }
  | { type: 'save-as-template' }
  | { type: 'select-page-descriptor'; descriptorKey: string }
  | { type: 'page-reload-request' }
  | { type: 'component-loaded'; path: ComponentPath }
  | { type: 'component-load-failed'; path: ComponentPath; reason: string }
  | { type: 'drag-started'; path?: ComponentPath }
  | { type: 'drag-stopped'; path?: ComponentPath }
  | { type: 'drag-dropped'; from?: ComponentPath; to: ComponentPath }
  | { type: 'keyboard-event'; eventType: string; key: string; keyCode: number; modifiers: Modifiers }
  | { type: 'iframe-loaded' }
  | { type: 'navigate'; path: string };
```

**Shared types:**

```ts
type ComponentType = 'page' | 'region' | 'text' | 'part' | 'layout' | 'fragment';

type Modifiers = { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean };

type PageConfig = {
  contentId: string;
  pageName: string;
  pageIconClass: string;
  locked: boolean;
  modifyPermissions: boolean;
  pageEmpty: boolean;
  pageTemplate: boolean;
  fragment: boolean;
  fragmentAllowed: boolean;
  resetEnabled: boolean;
  phrases: Record<string, string>;
};

type PageDescriptor = {
  components: Record<string, { descriptor?: string; fragment?: string; name?: string }>;
};

type PageController = {
  descriptorKey: string;
  displayName: string;
  iconClass: string;
};
```

---

### transport/

Wraps `postMessage`. No class registration, no serialization gymnastics.

#### channel.ts

```ts
type MessageHandler = (message: IncomingMessage) => void;

interface Channel {
  send(message: OutgoingMessage): void;
  subscribe(handler: MessageHandler): () => void;
  destroy(): void;
}

function createChannel(target: Window, origin?: string): Channel;

function setChannel(channel: Channel): void;
function getChannel(): Channel;
```

- `send` calls `target.postMessage({ version: 2, source: 'page-editor', ...message }, origin ?? '*')`. When `origin` is provided (recommended for production), messages are only deliverable to that origin. When omitted, falls back to `'*'` for development convenience.
- `subscribe` adds a `message` listener on `window`, filters by source/version, and validates `event.origin` against the expected origin (if provided). Messages from unexpected origins are silently dropped.
- `destroy` removes the listener

#### adapter.ts

```ts
function createAdapter(channel: Channel, callbacks?: RendererCallbacks): () => void;
```

Subscribes to incoming messages and translates them into store mutations. The adapter queues all non-`init` messages until the first `init` message has been processed. This prevents operating on an empty registry and undefined `$config` during the window between `ready` and `init`.

| Message | Store effect |
|---------|-------------|
| `init` | `setPageConfig(config)`, flush queued messages |
| `select` | `setSelectedPath(path)` |
| `deselect` | `setSelectedPath(undefined)` |
| `add` | no-op (MutationObserver triggers reconcile after DOM update) |
| `remove` | no-op (MutationObserver triggers reconcile after DOM update) |
| `move` | no-op (MutationObserver triggers reconcile after DOM update) |
| `load` | `markLoading(path, true)`, then calls `callbacks.onComponentLoadRequest(path)` if provided |
| `duplicate` | no-op (MutationObserver triggers reconcile after DOM update) |
| `reset` | no-op (MutationObserver triggers reconcile after DOM update) |
| `set-component-state` | `markLoading(path, processing)` |
| `page-state` | update descriptor map, `reconcilePage()` |
| `set-lock` | `setLocked(locked)` |
| `set-modify-allowed` | `setModifyAllowed(allowed)`; if `allowed` is `false`, also `setLocked(true)` |
| `create-draggable` | enable context window drag with component type |
| `destroy-draggable` | disable context window drag |
| `set-draggable-visible` | toggle drag visibility |
| `page-controllers` | store controller list in `$pageControllers` atom for `PagePlaceholderOverlay` |

Outgoing messages are **not** sent by the adapter. They are sent explicitly by interaction handlers and action execution. The adapter is one-directional: incoming → stores.

---

### state/

Nanostores atoms split by concern. Each file exports its atom(s) and pure setter/getter functions. State files only import from `protocol/` (for types).

#### registry.ts

Stores both region and component records in a flat map keyed by path string. Region records have `type: 'region'` and `children` listing their component child paths. Component records list their nested region paths in `children`.

```ts
type ComponentRecord = {
  path: ComponentPath;
  type: ComponentType;
  element: HTMLElement | undefined;
  parentPath: ComponentPath | undefined;
  children: ComponentPath[];
  empty: boolean;
  error: boolean;
  descriptor: string | undefined;
  loading: boolean;
};

const $registry: MapStore<Record<string, ComponentRecord>>;

function setRegistry(records: Record<string, ComponentRecord>): void;
function getRecord(path: ComponentPath): ComponentRecord | undefined;
function updateRecord(path: ComponentPath, partial: Partial<ComponentRecord>): void;
function removeRecord(path: ComponentPath): void;
```

#### selection.ts

```ts
const $selectedPath: WritableAtom<ComponentPath | undefined>;

function setSelectedPath(path: ComponentPath | undefined): void;
function getSelectedPath(): ComponentPath | undefined;
```

#### hover.ts

```ts
const $hoveredPath: WritableAtom<ComponentPath | undefined>;

function setHoveredPath(path: ComponentPath | undefined): void;
function getHoveredPath(): ComponentPath | undefined;
```

#### drag.ts

```ts
type DragState = {
  itemType: ComponentType;
  itemLabel: string;
  sourcePath: ComponentPath | undefined;   // undefined = context window insert
  targetRegion: ComponentPath | undefined; // region path (e.g. "/main")
  targetIndex: number | undefined;         // insertion index within the region
  dropAllowed: boolean;
  message: string | undefined;
  placeholderElement: HTMLElement | undefined;
  x: number | undefined;
  y: number | undefined;
};

const $dragState: WritableAtom<DragState | undefined>;

function setDragState(state: DragState | undefined): void;
function getDragState(): DragState | undefined;
function isDragging(): boolean;
function isPostDragCooldown(): boolean;
```

**Mutual exclusion**: `setDragState` is the single entry point for starting a drag. Both `initComponentDrag` and `initContextWindowDrag` must check `isDragging()` before writing to `$dragState`. If a drag is already active, the new drag is rejected.

**Post-drag cooldown**: After a drop or cancel, `isPostDragCooldown()` returns `true` for 100ms. This prevents the mouseup that ends a drag from triggering a click-selection on the drop target. The cooldown flag is stored alongside `$dragState` (not as a separate atom) and cleared via `setTimeout`.

`undefined` means no drag in progress.

#### page.ts

```ts
const $locked: WritableAtom<boolean>;
const $modifyAllowed: WritableAtom<boolean>;
const $config: WritableAtom<PageConfig | undefined>;
const $pageControllers: WritableAtom<PageController[]>;

function setLocked(value: boolean): void;
function setModifyAllowed(value: boolean): void;
function setPageConfig(config: PageConfig): void;
function getPageConfig(): PageConfig | undefined;
function setPageControllers(controllers: PageController[]): void;
```

#### context-menu.ts

```ts
type ContextMenuState = {
  kind: 'component' | 'locked-page';
  path: ComponentPath;
  x: number;
  y: number;
};

const $contextMenu: WritableAtom<ContextMenuState | undefined>;

function openContextMenu(state: ContextMenuState): void;
function closeContextMenu(): void;
```

#### element-index.ts

```ts
function rebuildIndex(registry: Record<string, ComponentRecord>): void;
function getPathForElement(element: HTMLElement): ComponentPath | undefined;
```

WeakMap-based reverse index: HTMLElement → ComponentPath. Rebuilt after every reconciliation.

---

### parse/

DOM scanning. Reads `data-portal-*` attributes and builds `ComponentRecord` entries.

#### parse-page.ts

```ts
type DescriptorMap = Record<string, { descriptor?: string; fragment?: string; name?: string }>;

function parsePage(
  root: HTMLElement,
  descriptors: DescriptorMap,
): Record<string, ComponentRecord>;
```

Walks the DOM recursively. For each element with `data-portal-component-type` or `data-portal-region`:

- Reads type from `data-portal-component-type` attribute
- Computes path from position in tree (region name + child index)
- Checks emptiness via `isNodeEmpty()`
- Checks error via `data-portal-placeholder-error`
- Resolves descriptor from the `descriptors` map using the computed path
- Builds parent/children relationships

Returns a flat record keyed by path string.

#### parse-subtree.ts

```ts
function parseSubtree(
  element: HTMLElement,
  parentPath: ComponentPath,
  descriptors: DescriptorMap,
): Record<string, ComponentRecord>;
```

Same logic scoped to a single subtree. Used after targeted DOM mutations when a full page re-parse isn't needed.

#### emptiness.ts

```ts
function isNodeEmpty(element: HTMLElement): boolean;
function isEditorInjectedElement(element: Element): boolean;
```

Checks whether an element has meaningful content, excluding editor-injected elements (placeholder hosts, overlay host, drag anchors).

DOM selectors and attribute names used throughout parsing:

- `[data-portal-component-type]` — component elements
- `[data-portal-region]` — region elements
- `data-portal-placeholder-error` — error marker
- `data-pe-placeholder-host` — editor placeholder (excluded from emptiness)
- `data-pe-drag-anchor` — drag handle (excluded from emptiness)

---

### geometry/

rAF-batched DOM measurement. No legacy dependencies.

#### scheduler.ts

```ts
function initGeometryScheduler(): () => void;
function registerConsumer(path: ComponentPath, callback: (rect: DOMRect) => void): () => void;
function markDirty(): void;
```

- Listens to `scroll` (capture phase, for nested scroll containers) and `resize` (passive) on `window`
- On dirty: batches all measurements into a single `requestAnimationFrame` pass
- Calls each registered consumer's callback with the element's `getBoundingClientRect()`
- `initGeometryScheduler()` returns a cleanup function that removes listeners

#### resize-tracker.ts

```ts
function trackElementResize(element: HTMLElement, onResize: () => void): () => void;
```

Single shared `ResizeObserver` instance. Calls `markDirty()` when a tracked element changes size. Returns an unobserve cleanup function.

---

### interaction/

User input handlers. Each exports an `init*` function that attaches listeners and returns a cleanup function.

#### selection.ts

```ts
function initSelectionDetection(channel: Channel): () => void;
```

`click` and `contextmenu` listeners on `document` (capture phase).

Click: resolves target → path via `getPathForElement()`, toggles `$selectedPath`, sends `'select'` or `'deselect'` message.

Context menu: resolves target → path, sets `$selectedPath`, opens `$contextMenu` with position, sends `'select'` with `rightClicked: true`.

Guards: ignores if `isDragging()`, if `isPostDragCooldown()`, or if event came from overlay chrome.

#### hover.ts

```ts
function initHoverDetection(): () => void;
```

`mouseover` and `mouseout` on `document`. Resolves target → path via `getPathForElement()`, sets `$hoveredPath`. Clears when `isDragging()`. No outgoing messages — hover is local state only.

#### keyboard.ts

```ts
function initKeyboardHandling(channel: Channel): () => void;
```

`keypress`, `keydown`, `keyup` on `document`. Detects modifier combos, sends `'keyboard-event'` with key and modifiers to Content Studio. Content Studio matches against its own active key bindings.

Prevents browser defaults for known editor combos (mod+S, mod+Del, etc.).

#### navigation.ts

```ts
function initNavigationInterception(channel: Channel): () => void;
```

`click` listener on `document` (capture phase). Intercepts clicks on `<a>` elements (or their descendants) that would navigate within XP. When a link targets a different content path (not same-page anchor, not download), the handler calls `event.preventDefault()` and sends `{ type: 'navigate', path }` to Content Studio so it can update the URL bar and reload the preview. Also sends `{ type: 'iframe-loaded' }` to notify Content Studio that the iframe content has finished loading. If `document.readyState === 'complete'` at init time, sends immediately; otherwise waits for the `window` `load` event.

#### component-drag.ts

```ts
function initComponentDrag(channel: Channel): () => void;
```

Drag-and-drop for existing components within the page.

- Initiates on `mousedown` at `[data-pe-drag-anchor]` elements; aborts if `isDragging()` (mutual exclusion)
- Sets `$dragState`, sends `'drag-started'`
- During drag: infers drop target via `elementsFromPoint()`, detects region layout axis, computes insertion index
- Updates `$dragState` continuously (targetRegion, targetIndex, dropAllowed, coordinates)
- Drop validation: no layout inside layout, no drop on own descendant, no fragment-with-layout inside layout (checked from `$registry`)
- On drop: computes final path via `insertAt(targetRegion, targetIndex)`, sends `'move'` with `{ from: sourcePath, to: insertAt(targetRegion, targetIndex) }`, clears `$dragState`
- On cancel: clears `$dragState`, sends `'drag-stopped'`

Shared drop-target inference logic (find region at point, detect axis, compute index) is extracted into a local helper used by both component-drag and context-window-drag.

**Reconciliation guard**: During an active drag (`isDragging() === true`), `reconcilePage` and `reconcileSubtree` skip registry updates and placeholder diffing. The MutationObserver still fires, but reconciliation is deferred until the drag ends. This prevents path renumbering from invalidating `sourcePath`/`targetRegion` mid-drag. On drag end (drop or cancel), a full `reconcilePage()` is triggered to sync any DOM changes that occurred during the drag.

#### context-window-drag.ts

```ts
function initContextWindowDrag(channel: Channel): () => void;
```

Drag from Content Studio's component palette into the page.

- Activated when adapter receives `'create-draggable'`; ignored if `isDragging()` (mutual exclusion). Deactivated on `'destroy-draggable'`
- Same drop-target inference as component-drag
- On drop: sends `'add'` (not `'move'`) with `{ path: insertAt(targetRegion, targetIndex), componentType }` and component type
- `sourcePath` in `$dragState` is `undefined` (insert, not move)

---

### actions/

Data-driven context menu. No `Action` class instances, no mutable visibility toggling.

#### definitions.ts

```ts
type ActionId =
  | 'select-parent'
  | 'insert'
  | 'insert-part'
  | 'insert-layout'
  | 'insert-text'
  | 'insert-fragment'
  | 'inspect'
  | 'reset'
  | 'remove'
  | 'duplicate'
  | 'create-fragment'
  | 'save-as-template'
  | 'page-settings';

type ActionDef = {
  id: ActionId;
  label: string;
  sortOrder: number;
  children?: ActionDef[];
  enabled?: boolean;           // default true
};

function executeAction(action: ActionId, path: ComponentPath, channel: Channel): void;
```

`executeAction` maps action ID → outgoing message:

| Action | Message |
|--------|---------|
| `inspect` | `{ type: 'inspect', path }` |
| `remove` | `{ type: 'remove', path }` |
| `duplicate` | `{ type: 'duplicate', path }` |
| `reset` | `{ type: 'reset', path }` |
| `select-parent` | sets `$selectedPath` to parent, sends `'select'` |
| `insert-part` | `{ type: 'add', path: resolveInsertPath(path), componentType: 'part' }` |
| `insert-layout` | `{ type: 'add', path: resolveInsertPath(path), componentType: 'layout' }` |
| `insert-text` | `{ type: 'add', path: resolveInsertPath(path), componentType: 'text' }` |
| `insert-fragment` | `{ type: 'add', path: resolveInsertPath(path), componentType: 'fragment' }` |
| `create-fragment` | `{ type: 'create-fragment', path }` |
| `save-as-template` | `{ type: 'save-as-template' }` |
| `page-settings` | `{ type: 'inspect', path: root }` |

`resolveInsertPath(path)` converts the current selection into an insertion target:

| Selection kind | Rule | Example |
|----------------|------|---------|
| Region (`isRegion(path)`) | Append at end: `insertAt(path, regionChildCount)` | `"/main"` with 3 children → `"/main/3"` |
| Component (`isComponent(path)`) | Insert after: `insertAt(parent(path), componentIndex(path) + 1)` | `"/main/1"` → `"/main/2"` |

#### resolve.ts

```ts
type ActionContext = {
  type: ComponentType;
  path: ComponentPath;
  empty: boolean;
  error: boolean;
  locked: boolean;
  modifyAllowed: boolean;
  fragment: boolean;
  fragmentAllowed: boolean;
  resetEnabled: boolean;
  pageTemplate: boolean;
  hasParentLayout: boolean;
  isTopFragment: boolean;
};

function resolveActions(context: ActionContext): ActionDef[];
```

Pure function. Returns available actions based on type and state:

**Component** (part/layout/text/fragment):
- Select Parent (always, unless root)
- Insert → Part, Layout (unless inside layout), Text, Fragment
- Inspect
- Reset (if not empty)
- Remove (if not top fragment component)
- Duplicate
- Create Fragment (if fragmentAllowed, not inside layout)

**Region:**
- Select Parent
- Insert → same children as component
- Reset (if not empty)

**Page:**
- Inspect
- Reset (if resetEnabled)
- Save as Template (if not pageTemplate)

**Locked page:**
- Page Settings

---

### rendering/

Shadow DOM infrastructure.

#### overlay-host.ts

```ts
type OverlayHost = {
  root: ShadowRoot;
  unmount: () => void;
};

function createOverlayHost(app: preact.VNode): OverlayHost;
```

Creates a fixed-position `<div>` on `document.body` with `z-index: 2147483646`, `pointer-events: none`. Attaches open shadow root, injects editor styles, renders Preact app.

#### placeholder-island.tsx

```ts
type PlaceholderIsland = {
  container: HTMLElement;
  host: HTMLElement;
  shadow: ShadowRoot;
  unmount: () => void;
};

function createPlaceholderIsland(target: HTMLElement, content: preact.VNode): PlaceholderIsland;
```

Creates a host `<div>` with `data-pe-placeholder-host` attribute (excluded from emptiness detection). Appends to target, attaches shadow root, injects styles, renders content.

#### inject-styles.ts

```ts
function injectStyles(shadowRoot: ShadowRoot): void;
```

Uses `adoptedStyleSheets` with a single shared `CSSStyleSheet` instance. The stylesheet is created once (via `new CSSStyleSheet()` + `replaceSync()`) and adopted by every shadow root (overlay host + all placeholder islands). This avoids O(n) style duplication across shadow roots.

---

### components/

Preact UI. All components read from state atoms via hooks. No legacy imports.

#### OverlayApp.tsx

Root component rendered into the overlay host. Composes all overlay layers:

- `Highlighter` — hover indicator, reads `$hoveredPath`
- `SelectionHighlighter` — selection indicator, reads `$selectedPath`
- `DragTargetHighlighter` — drop zone highlight, reads `$dragState`
- `DragPreview` — floating label following cursor during drag, reads `$dragState`
- `Shader` — locked page overlay, reads `$locked` and `$modifyAllowed`
- `ContextMenu` — right-click menu, reads `$contextMenu`
- `PagePlaceholderOverlay` — empty page controller selector, reads `$registry` and `$modifyAllowed`

#### Overlay components

- **Highlighter** — rounded border box at hovered element position via `useTrackedRect()`; hidden when dragging
- **SelectionHighlighter** — crosshair corners + bounding box at selected element; hidden when dragging. When the selected path changes, scrolls the selected element into view if it is outside the viewport.
- **DragTargetHighlighter** — target zone highlight; green (allowed) or red (forbidden)
- **DragPreview** — floating label at cursor with item label, mode indicator, status message
- **Shader** — semi-transparent overlay when locked; intercepts clicks, opens locked-page context menu if `modifyAllowed`
- **ContextMenu** — calls `resolveActions()` to get action list, renders items, calls `executeAction()` on click
- **PagePlaceholderOverlay** — reads `$pageControllers` (populated by `'page-controllers'` incoming message), renders selector dropdown; sends `'select-page-descriptor'` on selection. No REST calls — Content Studio provides the controller list.

#### Placeholder components

Rendered inside placeholder islands by reconciliation logic:

- **ComponentPlaceholder** — icon + type label for empty/error components
- **RegionPlaceholder** — "Drop components here" for empty regions

#### Drag components

- **DragPlaceholder** — visual marker at the drop insertion point, rendered inline in the page DOM during drag (not in a placeholder island)

---

### hooks/

#### use-store.ts

```ts
function useStoreValue<T>(store: ReadableAtom<T>): T;
```

Subscribes to a nanostores atom, re-renders on change.

#### use-tracked-rect.ts

```ts
function useTrackedRect(path: ComponentPath | undefined): DOMRect | undefined;
```

Combines geometry scheduler + resize tracker. Registers a consumer, tracks element resize, returns current `DOMRect`. Used by Highlighter, SelectionHighlighter, DragTargetHighlighter.

The hook subscribes to `$registry` and reads `getRecord(path)?.element`. Its effects are keyed on `[path, element]` — not just `[path]`. When reconciliation replaces the DOM element at the same path (e.g., after component reload), the element reference changes, the effects re-run, and the ResizeObserver re-binds to the new node.

---

### reconcile.ts

Coordinator that connects parsing, state, and rendering. Triggered primarily by the MutationObserver after DOM changes. The transport adapter does **not** call reconcile directly for `add`, `remove`, `duplicate`, `reset`, or `move` — those messages cause Content Studio to update the server, which re-renders the component, which mutates the DOM, which triggers the MutationObserver, which calls reconcile. The adapter only calls reconcile for `page-state` (descriptor map update that requires re-evaluating the existing DOM).

```ts
function reconcilePage(root: HTMLElement, descriptors: DescriptorMap): void;
function reconcileSubtree(element: HTMLElement, parentPath: ComponentPath, descriptors: DescriptorMap): void;
function destroyPlaceholders(): void;
```

`reconcilePage` — all store mutations are wrapped in a nanostores `batch()` to prevent intermediate renders (tearing) between registry update and index rebuild:
1. Calls `parsePage(root, descriptors)` to get component records
2. Inside `batch()`: calls `setRegistry(records)`, `rebuildIndex(records)`, validates `$selectedPath` still exists (if the selected path's record is gone, clears `$selectedPath`, closes `$contextMenu`, and sends `{ type: 'deselect', path }` to Content Studio so the inspect panel updates)
3. Diffs against previous registry to create/destroy placeholder islands for empty components/regions
4. Calls `markDirty()` to trigger geometry remeasurement

`reconcileSubtree`: same but scoped to a subtree, merges result into existing registry.

`destroyPlaceholders`: unmounts all placeholder islands. Called during teardown.

---

### persistence.ts

Selection persistence via `sessionStorage`.

```ts
function initSelectionPersistence(channel: Channel): () => void;
```

- Subscribes to `$selectedPath` → writes to `sessionStorage` keyed by content ID from `$config`
- On init: reads stored path, validates it exists in `$registry`, if valid sets `$selectedPath` and sends `'select'`. Scroll-into-view is handled by the `SelectionHighlighter` component when selection changes (not by persistence).
- Skips root path unless page is a fragment
- Returns unsubscribe cleanup function

---

### init.ts

Entry point. Wires all modules together.

```ts
type RendererCallbacks = {
  onComponentLoadRequest?: (path: ComponentPath) => void;
};

type PageEditorInstance = {
  destroy: () => void;
  notifyComponentLoaded: (path: ComponentPath) => void;
  notifyComponentLoadFailed: (path: ComponentPath, reason: string) => void;
  requestPageReload: () => void;
};

function initPageEditor(
  root: HTMLElement,
  target: Window,
  callbacks?: RendererCallbacks,
): PageEditorInstance;
```

`root` is the page body element. `target` is `window.parent` (Content Studio frame).

Initialization sequence:
1. Create channel (`createChannel(target)`)
2. Store channel in a module-level reference via `setChannel(channel)` (exported from `transport/channel.ts`). Components and action handlers import `getChannel()` to send outgoing messages.
3. Add `pe-overlay-active` class to body
4. Create overlay host with `<OverlayApp />`
5. Start adapter (`createAdapter(channel, callbacks)`)
6. Start geometry scheduler
7. Start interaction handlers (hover, selection, keyboard, navigation, component drag, context window drag)
8. Start selection persistence
9. Start MutationObserver on root (triggers reconciliation on meaningful DOM changes)
10. Send `{ type: 'ready' }` message

Returns a `PageEditorInstance` with:

- `destroy()` — tears down everything in reverse order, then resets all store atoms to initial values (`$registry` → empty, `$selectedPath` → `undefined`, `$hoveredPath` → `undefined`, `$dragState` → `undefined`, `$config` → `undefined`, `$locked` → `false`, `$modifyAllowed` → `true`, `$contextMenu` → `undefined`, `$pageControllers` → `[]`). This ensures a subsequent `initPageEditor` call starts with clean state.
- `notifyComponentLoaded(path)` — renderer calls this after successfully rendering a component; sends `{ type: 'component-loaded', path }` to Content Studio
- `notifyComponentLoadFailed(path, reason)` — renderer calls this when component rendering fails; sends `{ type: 'component-load-failed', path, reason }` to Content Studio
- `requestPageReload()` — renderer calls this to request a full page reload; sends `{ type: 'page-reload-request' }` to Content Studio

The MutationObserver watches `root` for `childList` changes (subtree, no attributes/characterData). Filters out mutations that only add/remove editor-injected elements. On meaningful mutations, calls `reconcilePage()` via `queueMicrotask` to coalesce rapid changes.

---

## Dependency Graph

```
protocol/      ← no internal deps (this is what Content Studio imports)

state/         ← protocol/
parse/         ← protocol/, state/
geometry/      ← (no internal deps)
rendering/     ← (Preact + CSS only)

hooks/         ← state/, geometry/
actions/       ← protocol/, state/

reconcile      ← parse/, state/, rendering/, geometry/, transport/channel (sends deselect via getChannel())
transport/     ← protocol/, state/, reconcile (adapter calls reconcile for page-state only)
persistence    ← state/, transport/
interaction/   ← state/, transport/

components/    ← state/, hooks/, actions/, rendering/

init           ← all of the above
```

No file-level circular dependencies. `transport/adapter` calls reconcile for `page-state`; `reconcile` uses `getChannel()` to send deselect notifications. Interaction handlers and actions send outgoing messages via channel; components are leaf consumers that render state.

---

## Public API

The package exports from `protocol/` are added to the main package entry point:

```ts
// src/main/resources/assets/js/index.ts (addition)
export * from './v2/protocol';
```

Content Studio imports message types and path utilities:

```ts
import { type IncomingMessage, type OutgoingMessage, type ComponentPath } from '@enonic/page-editor';
```

The `initPageEditor` function is also exported for the host to call:

```ts
import { initPageEditor } from '@enonic/page-editor';

const editor = initPageEditor(document.body, window.parent, {
  onComponentLoadRequest(path) {
    // Renderer: fetch and render the component at this path
    fetchAndRender(path)
      .then(() => editor.notifyComponentLoaded(path))
      .catch((err) => editor.notifyComponentLoadFailed(path, err.message));
  },
});
```

The returned `PageEditorInstance` provides the renderer-facing API:

| Method | Purpose |
|--------|---------|
| `destroy()` | Tear down the editor and all listeners |
| `notifyComponentLoaded(path)` | Renderer signals a component finished rendering |
| `notifyComponentLoadFailed(path, reason)` | Renderer signals a component failed to render |
| `requestPageReload()` | Renderer requests a full page reload |

---

## What This Replaces

| v1/new-ui | v2 | Change |
|-----------|-----|--------|
| `PageView`, `ItemView`, `ComponentView`, `RegionView` | `$registry` + `ComponentRecord` | Class hierarchy → flat store |
| `IframeEventBus` + class registration | `transport/channel.ts` (typed postMessage) | Heavy serialization → native structured clone |
| Event classes from `lib-contentstudio` | `protocol/messages.ts` (discriminated unions) | External dependency → v2 defines protocol |
| `ComponentPath` class from `lib-contentstudio` | Branded string + pure functions | Class → type + utilities |
| `Action` class + mutable visibility | `ActionDef` data + `resolveActions()` pure function | OOP mutation → functional data |
| `bridge.ts` (legacy view method calls) | Direct store access + postMessage | Removed entirely |
| `coexistence/ownership.ts` | Removed | v2 owns everything |
| `DragAndDrop` (jQuery UI sortable) | `interaction/component-drag.ts` (pointer events) | jQuery UI → native events |
| `Highlighter`, `Shader`, `Cursor` singletons | Preact components reading atoms | Class singletons → reactive components |
| Text editing sync | Removed | Feature no longer needed |
| `PageEditor.on/notify()` | `PageEditorInstance` methods + `RendererCallbacks` | Static event API → instance methods |
| `LiveEditParams` from PageView | `$config` atom from `'init'` message | View getter → store |
