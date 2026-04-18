# 05 — Palette Drag Protocol

Corrects a mis-characterization in the compatibility audit: the palette-to-page drag protocol between Content Studio and the v2 editor is already fully wired. This doc documents how it actually works, what CS needs to change during migration, and the tiny adapter-comment fix that removes future confusion.

Scope: gap **G5** from `docs/compatibility.md`.

---

## Correction — G5 was mis-labeled INCOMPATIBLE

The compatibility audit flagged `create-draggable`/`destroy-draggable`/`set-draggable-visible` as "INCOMPATIBLE — v2 adapter no-ops the messages." That's misleading. The top-level adapter at `src/transport/adapter.ts:79–81` does no-op these messages, but `src/interaction/context-window-drag.ts` subscribes to the channel directly (`channel.subscribe(handleMessage)` at line 193) and owns the drag session entirely. The messages flow end-to-end.

Two subscribers on the same channel is a valid pattern here: the adapter enumerates every incoming type for TypeScript exhaustiveness, while drag-specific behavior lives in the module that already holds the rest of the drag state machine. No refactor needed; just a pointer comment so the next reader doesn't repeat the mistake.

---

## Architecture

The drag flow is split across the iframe boundary:

```
CS chrome (parent)                                   iframe (v2)
─────────────────                                    ──────────

palette item                                         context-window-drag.ts
   │                                                        │
   │  user mousedown                                        │
   │                                                        │
   ├──► postMessage {type:'create-draggable',               │
   │                 componentType}             ──────────► session = {itemType, ...}
   │                                                        setDragState(...)
   │                                                ◄────── send {type:'drag-started'}
   │                                                        │
   │  cursor enters iframe rect                             │
   ├──► postMessage {type:'set-draggable-visible',          │
   │                 visible: true}               ──────────► session.visible = true
   │                                                        mousemove/up listeners active
   │                                                        │
   │  (CS DragMask keeps receiving palette mouse events)    │
   │                                                        mousemove inside iframe
   │                                                        → inferDropTarget(x, y)
   │                                                        → validateDrop(...)
   │                                                        → render placeholder via OverlayApp
   │                                                        │
   │  cursor leaves iframe rect                             │
   ├──► postMessage {type:'set-draggable-visible',          │
   │                 visible: false}              ──────────► session.visible = false
   │                                                        clear placeholder
   │                                                        │
   │  user mouseup on valid target                          │
   │                                                ◄────── send {type:'add', path, componentType}
   │                                                ◄────── send {type:'drag-dropped', to}
   │                                                        session destroyed
   │                                                        │
   │  user mouseup outside / on invalid target              │
   │                                                ◄────── send {type:'drag-stopped'}
   │                                                        session destroyed
   │                                                        │
   │  CS tears down palette drag                            │
   ├──► postMessage {type:'destroy-draggable'}    ──────────► session destroyed (if still alive)
   │                                                ◄────── send {type:'drag-stopped'}
```

CS's existing `DragMask` (`LiveEditPageProxy.ts:102,223–229,638`) is unchanged. It's a transparent CS-chrome overlay on top of the iframe that keeps palette mouse events flowing to CS during drag. Parent-side concern; v2 doesn't touch it.

---

## Wire-shape deltas from legacy

| Legacy event | v2 message(s) | Notes |
|---|---|---|
| `CreateOrDestroyDraggableEvent({type, isCreate: true})` | `{type: 'create-draggable', componentType: string}` | Split from the combined legacy event — one message per intent. Field renamed `type` → `componentType` to avoid clashing with the message-discriminator `type`. |
| `CreateOrDestroyDraggableEvent({type, isCreate: false})` | `{type: 'destroy-draggable'}` | No payload. v2 tracks a single active session; there's nothing else to destroy. |
| `SetDraggableVisibleEvent({type, isVisible})` | `{type: 'set-draggable-visible', visible: boolean}` | No `componentType`. v2's single session knows its own type from the prior `create-draggable`. |

v2's shape is strictly leaner. All three messages already exist in `src/protocol/messages.ts:74–76`; no changes needed.

---

## Decisions

| Item | Decision |
|---|---|
| Protocol shape | **Keep as-is.** The three messages are already in `IncomingMessage` and already handled in `context-window-drag.ts`. |
| Adapter no-op comment | **Add one-line comment** at `src/transport/adapter.ts:79–81` pointing to `context-window-drag.ts` as the real handler. |
| Drag hover feedback outgoing to CS | **Not added.** v2 renders drag visualization inside the iframe (placeholder, highlighter, shader). CS chrome doesn't need to mirror iframe hover state. |
| `create-draggable`/`destroy-draggable` as two separate messages vs. one toggle | **Keep split.** Exhaustiveness at the call site is worth one extra type. Legacy's single-event-with-boolean was a worse shape. |
| `DragMask` in CS | **Unchanged.** Parent-side chrome; works as-is. |

---

## CS migration — direct translations

### LiveEditPageProxy.ts changes

```ts
// Before — LiveEditPageProxy.ts:205–221
public createDraggable(data: {type: string}) {
  if (this.isFrameLoaded) new CreateOrDestroyDraggableEvent(data.type, true).fire();
}
public destroyDraggable(data: {type: string}) {
  if (this.isFrameLoaded) new CreateOrDestroyDraggableEvent(data.type, false).fire();
}
public setDraggableVisible(data: {type: string}, visible: boolean) {
  if (this.isFrameLoaded) new SetDraggableVisibleEvent(data.type, visible).fire();
}

// After — same public API, different wire
public createDraggable(data: {type: string}) {
  if (this.isFrameLoaded) postToIframe({type: 'create-draggable', componentType: data.type});
}
public destroyDraggable(_data: {type: string}) {
  if (this.isFrameLoaded) postToIframe({type: 'destroy-draggable'});
}
public setDraggableVisible(_data: {type: string}, visible: boolean) {
  if (this.isFrameLoaded) postToIframe({type: 'set-draggable-visible', visible});
}
```

Note the `_data` prefixes — the `type` argument on `destroyDraggable`/`setDraggableVisible` is now dead on the wire but kept in the CS public API for source-compat with the InsertablesPanel callers. A follow-up CS cleanup can drop the argument once no consumer reads it.

### Callers

`InsertablesPanel.ts` and `FrameContainer.ts` (per the earlier grep) call `proxy.createDraggable(...)` etc. No changes needed in those files — the proxy hides the wire format.

---

## Implementation checklist

1. `src/transport/adapter.ts:79–81` — add comment:
   ```ts
   // Handled by context-window-drag.ts (channel subscriber); no adapter work required.
   case 'create-draggable':
   case 'destroy-draggable':
   case 'set-draggable-visible':
     break;
   ```
2. `README.md` / integration story — document the drag flow using the sequence diagram above.
3. CS-side (not in this repo): replace three `new *Event(...)fire()` calls in `LiveEditPageProxy.ts:205–221` with `postToIframe(...)`.
4. Add integration test or story that exercises the full palette drag path end-to-end (palette mousedown → drop on region → `add` + `drag-dropped` verification).

---

## Tradeoffs captured

- **Two subscribers on the channel** (adapter + context-window-drag) is unusual but correct. Adapter holds state-init, hover, selection, etc.; drag has its own lifecycle with its own session state, and coupling it into the adapter would bloat that file. Documented in the comment fix.
- **Leaner v2 payload drops `componentType` on destroy/set-visible**. A future feature that needs multiple concurrent palette drags (e.g. multi-touch) would require reintroducing it. Not a realistic case; skip.
- **No outgoing hover/feedback stream** to CS during drag. CS chrome shows only "dragging" state (via `DragMask`); fine-grained feedback (drop-allowed, target region name) is rendered inside the iframe. If CS ever needs parent-side HUD during drag, add a dedicated outgoing event then.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md` (G5 — correction above)
- Init & lifecycle: `docs/gaps/01-INIT.md`
- Mount-time options: `docs/gaps/02-PREVIEW-MODE.md`
- Mutations protocol: `docs/gaps/04-MUTATIONS.md`
- Legacy CS bridge: `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:205–221`
- v2 palette drag: `src/interaction/context-window-drag.ts`
- v2 adapter: `src/transport/adapter.ts:79–81`
- v2 drop-target logic: `src/interaction/drop-target.ts`
- v2 protocol: `src/protocol/messages.ts:74–76`

<sub>*Drafted with AI assistance*</sub>
