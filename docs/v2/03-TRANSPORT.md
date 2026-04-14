# Step 03 — Transport

> SPEC ref: [transport/](../SPEC-v2.md#transport), [channel.ts](../SPEC-v2.md#channelts), [adapter.ts](../SPEC-v2.md#adapterts)

## Goal

Replace `IframeEventBus` + class-based event registration with typed `postMessage` communication. The transport layer is the boundary between the page editor iframe and Content Studio.

## Scope

```
src/main/resources/assets/js/v2/transport/
├── channel.ts    ← typed send/receive wrapper around postMessage
├── adapter.ts    ← incoming messages -> store mutations
└── index.ts      ← barrel export
```

### channel.ts

```ts
interface Channel {
  send(message: OutgoingMessage): void;
  subscribe(handler: MessageHandler): () => void;
  destroy(): void;
}

function createChannel(target: Window, origin?: string): Channel;
function setChannel(channel: Channel): void;
function getChannel(): Channel;
```

- `send` wraps `target.postMessage({ version: 2, source: 'page-editor', ...message }, origin ?? '*')`
- `subscribe` filters by `source === 'page-editor'` and `version === 2`; validates `event.origin` when origin is provided
- Module-level reference via `setChannel` / `getChannel` — components and action handlers import `getChannel()` to send messages

### adapter.ts

```ts
type AdapterCallbacks = {
  onPageState?: (descriptors: DescriptorMap) => void;
  onComponentLoadRequest?: (path: ComponentPath) => void;
};

function createAdapter(channel: Channel, callbacks?: AdapterCallbacks): () => void;
```

One-directional: incoming messages -> store mutations. Outgoing messages are sent explicitly by interaction handlers and actions.

Message queue: all non-`init` messages are queued until the first `init` has been processed. This prevents operating on an empty registry and undefined `$config`.

| Message | Store effect |
|---------|-------------|
| `init` | `setPageConfig(config)`, flush queue |
| `select` | `setSelectedPath(path)` |
| `deselect` | `setSelectedPath(undefined)` |
| `add/remove/move/duplicate/reset` | no-op (MutationObserver triggers reconcile) |
| `load` | `markLoading(path, true)`, call `callbacks.onComponentLoadRequest` |
| `set-component-state` | `markLoading(path, processing)` |
| `page-state` | call `callbacks.onPageState(descriptors)` |
| `set-lock` | `setLocked(locked)` |
| `set-modify-allowed` | `setModifyAllowed(allowed)`, if `false` also `setLocked(true)` |
| `create-draggable` | enable context window drag |
| `destroy-draggable` | disable context window drag |
| `set-draggable-visible` | toggle drag visibility |
| `page-controllers` | `setPageControllers(controllers)` |

**Cycle resolution:** The adapter does NOT import `reconcile` directly. Instead, the `onPageState` callback is injected by `init.ts` (step 11), which wires it to `reconcilePage()`. This breaks the `transport <-> reconcile` compile-time cycle while preserving the runtime behavior.

## What replaces what

| Legacy / new-ui | v2 transport | Change |
|----------------|--------------|--------|
| `IframeEventBus` from lib-admin-ui | `channel.ts` typed postMessage | Heavy serialization -> native structured clone |
| `bus-adapter.ts` (17 event class imports) | `adapter.ts` (switch on message type string) | Class registration -> discriminated union |
| Event classes from lib-contentstudio | Discriminated union variants | ~30 imports -> 0 |
| `Store` from lib-admin-ui (for key bindings) | Removed (keyboard events forwarded via postMessage) | |

## Adapting from existing code

The existing `adapter/bus-adapter.ts` is the closest reference — same concept of "listen to incoming events, mutate stores." The v2 version:
- Replaces `IframeEventBus.on(EventClass, handler)` with `channel.subscribe(handler)` + switch
- Removes all lib-contentstudio event class imports
- Adds init-gating message queue
- Replaces direct reconcile import with injected callback

## Dependencies

- `protocol/` — message types, `ComponentPath`
- `state/` — store setters (`setSelectedPath`, `setLocked`, `setPageConfig`, etc.)

## Verification

- Unit tests for `channel.ts`: send wraps correctly, subscribe filters by version/source, origin validation
- Unit tests for `adapter.ts`: each message type maps to correct store mutation, init-gating queue works (messages before init are queued, messages after init are processed immediately), callback invocation
- Mock `Window` with `postMessage` / `addEventListener`
- Run `pnpm check`
