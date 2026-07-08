# Page Editor Protocol

`@enonic/page-editor` owns the live-edit protocol; Content Studio and external
site adapters are its consumers. The editor runs inside the page iframe and
talks to its host over `postMessage`. The contract is exported as
`@enonic/page-editor/protocol` — zero-dependency and SSR-safe (nothing touches
`window` until the bus is initialized).

The message payloads in this document are the source of truth's prose mirror;
the authoritative types live in `protocol/messages.ts`
(`HostToEditorPayloads` / `EditorToHostPayloads`).

## Envelope & transport

- **Envelope:** `{channel: 'enonic:page-editor', version: 1, type, payload}`.
- **Endpoints:** `createEditorBus({remote, remoteOrigin})` (iframe side) and
  `createHostBus({remote, remoteOrigin})` (host side).
- **Origin filtering:** incoming messages are dropped unless both the origin and
  the `source` window match the pinned remote; a message with a null `source` is
  rejected. `'*'` skips the origin match (so any origin is accepted) but still
  requires `source` to be the remote — it must be opted into explicitly, and the
  auto-fallback to `'*'` (no `hostOrigin` and no referrer) logs an error.
- **Versioning:** any version other than the local one — including a missing or
  non-numeric version — triggers a one-time callback/warning; messages still
  deliver. Additive evolution is the norm; breaking changes bump the major.
- **Origin-pinning bootstrap:** `initialize` itself arrives over the bus, so the
  editor accepts `initialize` from the `document.referrer` origin (or an
  explicit `hostOrigin` config), then pins all further traffic to it.

## Host → editor messages

| Message                       | Payload                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `initialize`                  | `{params, page?, phrases?, locale?, content?, project?, hostDomain?}` |
| `page-state`                  | `{page?}`                                                             |
| `select-component`            | `{path}`                                                              |
| `deselect-component`          | `{path?}`                                                             |
| `add-component`               | `{path, kind}`                                                        |
| `remove-component`            | `{path}`                                                              |
| `move-component`              | `{from, to}`                                                          |
| `duplicate-component`         | `{path}`                                                              |
| `reset-component`             | `{path}`                                                              |
| `load-component`              | `{path, existing?}`                                                   |
| `update-text-component`       | `{path, text, origin?}`                                               |
| `set-component-state`         | `{path, processing}`                                                  |
| `set-page-lock-state`         | `{locked}`                                                            |
| `set-modify-allowed`          | `{allowed}`                                                           |
| `skip-reload-confirmation`    | `{skip}`                                                              |
| `create-or-destroy-draggable` | `{kind, create}`                                                      |
| `set-draggable-visible`       | `{kind, visible}`                                                     |

## Editor → host messages

| Message                                           | Payload                            |
| ------------------------------------------------- | ---------------------------------- |
| `editor-loaded`                                   | `{}`                               |
| `ready`                                           | `{errorPaths}`                     |
| `init-error`                                      | `{message}`                        |
| `component-selected`                              | `{path, position?, rightClicked?}` |
| `component-deselected`                            | `{path?}`                          |
| `component-inspect-requested`                     | `{path}`                           |
| `add-component-requested`                         | `{path, kind}`                     |
| `remove-component-requested`                      | `{path}`                           |
| `move-component-requested`                        | `{from, to}`                       |
| `duplicate-component-requested`                   | `{path}`                           |
| `reset-component-requested`                       | `{path}`                           |
| `save-as-template-requested`                      | `{}`                               |
| `page-reset-requested`                            | `{}`                               |
| `page-reload-requested`                           | `{}`                               |
| `page-locked` / `page-unlocked`                   | `{}`                               |
| `create-fragment-requested`                       | `{path}`                           |
| `detach-fragment-requested`                       | `{path}`                           |
| `edit-content-requested`                          | `{contentId}`                      |
| `text-edit-requested`                             | `{path}`                           |
| `component-loaded`                                | `{path}`                           |
| `component-load-failed`                           | `{path, message}`                  |
| `drag-started` / `drag-stopped` / `drag-canceled` | `{path}`                           |
| `drag-dropped`                                    | `{from, to}`                       |
| `preview-path-changed`                            | `{path}`                           |
| `keyboard-relay`                                  | `{type, init}`                     |

## Architecture

```
@enonic/page-editor
├── /protocol  (subpath export; zero-dependency, SSR-safe)
│   ├── messages.ts       message catalog (JSON payloads, versioned envelope)
│   ├── bus.ts            origin-pinned postMessage endpoint (editor + host)
│   ├── ComponentPath.ts  component path (canonical string format)
│   └── page.ts           PageJson wire types + tree lookups
└── editor runtime (Preact, nanostores)
    ├── stores: $registry (ComponentRecord), $page (PageJson), $params,
    │           $phrases, selection/hover/drag/lock — the only model
    ├── actions/: menu items as data, computed from records + $page + params
    └── transport/bus-adapter: protocol bus ⟷ stores
```

- **JSON only across the boundary.** Class instances never cross frames; the
  page model travels as `PageJson` (the XP wire shape).
- **The init payload replaces ambient state.** Phrases, locale, params, content
  info, project name, and host origin all arrive in `initialize`.
- **The stores are the only model.** The `ComponentRecord` registry (parsed from
  `data-portal-*` attributes) plus `$page` answer everything about the page.

## Contracts

Behavioral guarantees consumers and contributors must preserve:

- **Text editing is host-side.** The editor fires `text-edit-requested`; the
  host edits in its own panel and syncs back `update-text-component`. The
  iframe never loads a rich-text editor.
- **`update-text-component.origin`** breaks echo loops — the host stamps the
  origin (`live` / `inspector` / `unknown`) so the editor can ignore its own
  round-trips.
- **`component-selected.position` is nullable by design.** Programmatic
  selections fire without a position; the host uses it only for context-menu
  placement.
- **`deselect-component.path` targets a specific selection.** When set, the
  editor ignores the message unless that component is still selected, so a
  stale host-side deselect cannot wipe a newer selection.
- **Lock transitions are announced.** Every lock-state change posts
  `page-locked` / `page-unlocked`, whether triggered by `set-page-lock-state`,
  `set-modify-allowed`, or the initial `params.locked`.
- **`component-load-failed` carries `{message}`, not an `Error`.** No error
  instance crosses the frame boundary.
- **`ready.errorPaths` is a full snapshot.** Every `ready` lists all components
  whose markup rendered as an error placeholder
  (`data-portal-placeholder-error`), possibly empty — the host replaces its
  render-error state rather than merging. Failures of host-triggered loads
  arrive incrementally via `component-load-failed` instead.
- **Same-origin sessionStorage contract.** Selection/cursor state uses
  `contentstudio:liveedit:*` keys, shared with the host in same-origin
  embedding — keep the keys stable. Cross-origin embedding gets isolated (and
  harmless) copies.
- **Param gating.** `enableTextComponent`, `isFragmentAllowed`,
  `modifyPermissions`, `isResetEnabled`, and `isPageTemplate` in
  `initialize.params` gate menu items and drag sources.
