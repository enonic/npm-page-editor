# 04 — Page & Component Mutations

Covers how Content Studio communicates page mutations to the editor (drop the per-event messages, keep `page-state` as the single source of truth) and how page-level reset is discriminated from component-level reset. G24 (`customize-page` outgoing) was investigated and closed — the legacy event has no iframe emitter, so no v2 surface is needed.

Scope: gaps **G4**, **G11**, **G24** from `docs/compatibility.md`.

---

## G4 — Drop the no-op incoming mutation messages

### Problem

Current incoming protocol has five variants that the adapter explicitly no-ops (`src/transport/adapter.ts:44–48`):

```ts
case 'add':
case 'remove':
case 'move':
case 'duplicate':
case 'reset':
  break;
```

CS fires all five today from `LiveEditPageProxy.ts:549–582`, then immediately fires `PageStateEvent` carrying the complete new page tree. Legacy mutated an ItemView tree incrementally from these per-event messages. v2 reconciles from the subsequent `page-state` snapshot, so the per-event messages are pure redundant traffic and dead protocol surface.

### Decision

Delete them from the incoming protocol.

```ts
// src/protocol/messages.ts — IncomingMessage shrinks from 17 → 12 variants
export type IncomingMessage =
  | {type: 'init'; config: PageConfig}
  | {type: 'select'; path: ComponentPath; silent?: boolean}
  | {type: 'deselect'; path?: ComponentPath}
  | {type: 'load'; path: ComponentPath; existing: boolean}          // per topic 3
  | {type: 'set-component-state'; path: ComponentPath; processing: boolean}
  | {type: 'page-state'; page: PageDescriptor}
  | {type: 'set-lock'; locked: boolean}
  | {type: 'set-modify-allowed'; allowed: boolean}
  | {type: 'set-theme'; theme: 'light' | 'dark'}
  | {type: 'create-draggable'; componentType: string}
  | {type: 'destroy-draggable'}
  | {type: 'set-draggable-visible'; visible: boolean}
  | {type: 'page-controllers'; controllers: PageController[]};
```

`INCOMING_MESSAGE_TYPES` constant at `src/protocol/messages.ts:38–57` loses its `add`/`remove`/`move`/`duplicate`/`reset` entries. Adapter loses the no-op cases.

### What this does NOT affect

The outgoing counterparts stay unchanged — editor → CS still sends:

```ts
| {type: 'add'; path: ComponentPath; componentType: ComponentType}
| {type: 'remove'; path: ComponentPath}
| {type: 'move'; from: ComponentPath; to: ComponentPath}
| {type: 'duplicate'; path: ComponentPath}
| {type: 'reset'; path: ComponentPath}
```

Those are user-intent signals (drag-drop, menu actions). Keep them.

### CS migration

CS's three current subscriptions collapse to one:

```ts
// Before — LiveEditPageProxy.ts:549–582
PageState.getEvents().onComponentAdded((event) => {
  if (this.isFrameLoaded) {
    if (event instanceof ComponentDuplicatedEvent) new DuplicateComponentViewEvent(event.getPath()).fire();
    else if (event instanceof ComponentMovedEvent) new MoveComponentViewEvent(event.getFrom(), event.getTo()).fire();
    else new AddComponentViewEvent(event.getPath(), event.getComponent().getType()).fire();
    new PageStateEvent(PageState.getState().toJson()).fire();
  }
});
PageState.getEvents().onComponentRemoved((event) => {
  if (this.isFrameLoaded) {
    if (event instanceof ComponentRemovedOnMoveEvent) return;
    new RemoveComponentViewEvent(event.getPath()).fire();
    new PageStateEvent(PageState.getState().toJson()).fire();
  }
});
PageState.getEvents().onComponentUpdated((event) => {
  new PageStateEvent(PageState.getState().toJson()).fire();
  // text update still fires UpdateTextComponentViewEvent — handled in topic 6 (text round-trip)
});

// After
const pushPageState = (): void => {
  if (this.isFrameLoaded) postToIframe({type: 'page-state', page: PageState.getState().toJson()});
};
PageState.getEvents().onComponentAdded(pushPageState);
PageState.getEvents().onComponentRemoved((event) => {
  if (event instanceof ComponentRemovedOnMoveEvent) return;
  pushPageState();
});
PageState.getEvents().onComponentUpdated(pushPageState);
// text round-trip handled in topic 6
```

`ComponentRemovedOnMoveEvent` discrimination stays — a move fires both a removed-on-move and an added event; CS skips the removed half to avoid double `page-state`.

---

## G11 — Page reset vs component reset

### Problem

Legacy CS listens on two separate channels:
- `PageResetEvent.on(...)` at `LiveEditPageProxy.ts:457–459` → `notifyPageResetRequested()`
- `ResetComponentEvent.on(...)` at `528–532` → `notifyComponentResetRequested(path)`

v2 has one outgoing `reset` message with a `path`. CS must discriminate which one was hit.

### Decision

Keep `reset` unified. Add `isRoot(path)` helper to `src/protocol/path.ts`:

```ts
// src/protocol/path.ts
export function isRoot(path: ComponentPath): boolean {
  return path === '/';
}
```

v2 already exports `root()` as the root-path constructor (`path.ts:5–7`); `isRoot` is the matching predicate. One-liner, no runtime cost.

### CS migration

```ts
// In the outgoing-message handler CS mounts on the iframe:
if (msg.type === 'reset') {
  if (isRoot(msg.path)) {
    PageEventsManager.get().notifyPageResetRequested();
  } else {
    PageEventsManager.get().notifyComponentResetRequested(msg.path);
  }
}
```

### Why unified, not split

Splitting back to `reset-page` and `reset-component` bloats the protocol for a discriminator CS can do in three lines. The path itself is the correct discriminator — it's the data model; separate messages would duplicate it.

---

## G24 — `customize-page` outgoing → CLOSED (no iframe emitter)

### Verification result

Grep across `~/repo/app-contentstudio/modules/lib/src`, `~/repo/app-contentstudio/modules/app/src`, `~/repo/lib-admin-ui/src`, and `.worktrees/master` returns **zero** matches for `new CustomizePageEvent(`. The listener at `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:511–513` is dead code — the event is registered on `IframeEventBus` but never fired from any iframe-side code.

The real entry points for the customize flow are all **parent-side**:

- `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/PageEventsManager.ts:541` — `notifyCustomizePageRequested()` is the actual trigger.
- `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:474` — auto-synthesized parent-side when `AddComponentEvent` arrives on a locked page (auto-customize-before-add).
- `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/contextwindow/inspect/page/PageTemplateAndControllerForm.ts:40` — inspect-panel "Yes" callback in the template-switch dialog.
- `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/v6/features/store/page-editor/commands.ts:39` — v6 `requestCustomizePage()` invoked from `PageInspectionPanel.tsx:31` confirmation dialog.

CS never needed an iframe→parent customize signal. Customize is always initiated parent-side (dialog, inspect panel, or inferred from a locked-page add).

### Decision

**No v2 outgoing needed.** Do not add `customize-page` to `OutgoingMessage`, no action definition, no menu entry.

### CS migration

The dead `CustomizePageEvent.on()` listener at `LiveEditPageProxy.ts:511–513` can be removed during CS migration along with the `IframeEventBus.registerClass('CustomizePageEvent', …)` call at `LiveEditPageProxy.ts:161`-adjacent. None of the parent-side `notifyCustomizePageRequested()` callers are affected.

---

## Implementation checklist

1. `src/protocol/messages.ts`
   - Remove `add`, `remove`, `move`, `duplicate`, `reset` from `IncomingMessage`.
   - Remove them from `INCOMING_MESSAGE_TYPES`.
2. `src/transport/adapter.ts:44–48` — delete the no-op cases. TypeScript's exhaustiveness check at `adapter.ts:87–90` catches any we forget.
3. `src/protocol/path.ts` — add `export function isRoot(path)`.
4. Tests:
   - `src/transport/adapter.test.ts` — drop tests that assert no-op behavior for the removed messages; they should no longer compile against `IncomingMessage`.
   - `src/protocol/path.test.ts` — cover `isRoot('/')`, `isRoot('/region/0')`, edge cases.
5. Update integration stories and the `OutgoingMessage` documentation in `README.md`.

---

## Tradeoffs captured

- **Dropping incoming `add`/`remove`/`move`/`duplicate`/`reset` is a breaking change** to the incoming protocol. Blast radius is zero because no shipped consumer uses v2 yet; CS migration is a single-PR collapse of three subscriptions into one. If a future feature wants per-mutation hints (animation sequencing, perf optimizations), reintroducing is trivial — but keeping them as dead no-ops today invites consumers to implement handlers that do nothing, which is worse than silence.
- **Unified `reset` with `isRoot` discrimination** instead of split messages keeps the protocol lean. Tradeoff: CS must know about `isRoot` — but it's a named export, easy to discover.
- **`customize-page` outgoing closed** — verification found no iframe emitter in the current codebase. Customize is a parent-side flow (inspect panel, template dialog, auto-triggered on locked-page add). If a future feature needs the iframe to request a customize (e.g., a right-click "Customize" entry), reintroducing is straightforward: one message, one action, one CS listener wire-up.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md` (G4, G11, G24)
- Load-component flow: `docs/gaps/03-LOAD-COMPONENT.md` (new `load` shape was added to the trimmed `IncomingMessage` above)
- Init & lifecycle: `docs/gaps/01-INIT.md`
- Legacy CS bridge: `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts`
- v2 protocol: `src/protocol/messages.ts`
- v2 path helpers: `src/protocol/path.ts`
- v2 adapter: `src/transport/adapter.ts`
- v2 actions: `src/actions/definitions.ts`

<sub>*Drafted with AI assistance*</sub>
