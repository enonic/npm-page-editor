# Legacy Page Editor — Behavioral Specification

**Bundle:** `@enonic/page-editor` (legacy in-iframe edition, pre-v2 rewrite)
**Tier:** Large
**Files analyzed:** 43 TypeScript files
**LOC (approx):** 6048
**Detected languages:** TypeScript
**Root:** `.worktrees/master/src/main/resources/assets/js/`

---

## What this spec covers

This is the behavioral and use-case level specification for the **legacy in-iframe page editor** that ships as part of Enonic Content Studio. It documents what the editor does, why, how the parts communicate, and what a reimplementation in any stack must preserve.

The legacy editor was built on plain TypeScript class inheritance (`lib-admin-ui`'s `Element` base), jQuery-UI drag-and-drop, and a custom cross-iframe event bus. It is **not** built on Preact or any modern framework. The v2 rewrite uses a completely different stack; this document captures the v1 contract so no functionality is lost.

---

## How to read this spec

| File | What it answers |
|------|-----------------|
| `architecture.md` | How the editor is structured: runtime topology, iframe/wizard boundary, parse + registry flow, initialization lifecycle. Start here. |
| `modules.md` | One-line index of all 10 logical modules with roles and links to the per-module files. |
| `contracts.md` | All incoming and outgoing events with exact payload shapes; npm-level API; shared singletons; DOM attributes; invariants; known asymmetries and bugs. The authoritative cross-module contract reference. |
| `modules/bootstrap-and-surface.md` | PageEditor entry point: jQuery install, iframe-bus registration, npm API (`on/un/notify`). |
| `modules/inbound-router.md` | **Deep spec** — LiveEditPage: rehydration from `InitializeLiveEditEvent`, all 18 inbound event handlers, selection persistence, palette-drag proxy trick. |
| `modules/view-base.md` | **Deep spec** — ItemView: hover bubble-through, click decision tree, touch long-press, context menu, insert submenu, overlay singletons. |
| `modules/ids-and-factory.md` | ItemViewId, ItemViewIdProducer, DefaultItemViewFactory. |
| `modules/drag-and-drop.md` | **Deep spec** — DragAndDrop singleton: jQuery-UI sortable/draggable wiring, drop rules, palette proxy integration, Firefox workarounds. |
| `modules/page-view.md` | PageView: parse body → view tree, `viewsById` registry, lock/unlock state machine, page/fragment dual mode. |
| `modules/region-view.md` | RegionView: `data-portal-region` container, component add/remove, drag-over, placeholder. |
| `modules/component-view-base.md` | ComponentView, ContentBasedComponentView, DescriptorBasedComponentView: context menu actions, Del/Backspace, replaceWith, moveToRegion. |
| `modules/overlay-chrome.md` | Highlighter, SelectedHighlighter, Shader, Cursor: absolute-positioned overlays, coordinate math. |
| `modules/specialized-component-views.md` | Part, Layout, Text, Fragment component view specializations. |
| `audit.md` | Consolidated suspicious conditions and known bugs grouped by severity. No formal audit was run; these are issues surfaced during analysis. |

---

## Use-case summary (what an editor session looks like)

1. **Iframe is injected.** The host (Content Studio wizard) loads the page URL inside an iframe. The editor library is bundled into the page via the host's integration.

2. **Bootstrap.** `PageEditor.init(true)` runs: jQuery + jQuery-UI are installed globally; ~30 event classes are registered on the cross-iframe bus; global keyboard and link-click listeners are installed; a `LiveEditPage` instance is constructed (but not yet active).

3. **Handshake.** The wizard fires `InitializeLiveEditEvent` carrying the host domain, config, i18n phrases, auth context, project, page model JSON, and content. `LiveEditPage.init()` rehydrates everything, parses the iframe body into a `PageView → RegionView → ComponentView` tree, initializes drag-and-drop, and fires `LiveEditPageViewReadyEvent` back to the wizard.

4. **Ready.** The wizard must wait for `LiveEditPageViewReadyEvent` before sending any further events. If `LiveEditPageInitializationErrorEvent` fires instead, the iframe must be recreated.

5. **Selection.** The user hovers (hover highlight appears), clicks (selection overlay + context menu), or right-clicks (context menu at cursor). The editor fires `SelectComponentEvent` back to the wizard, which opens the inspector panel. Exactly one view is selected at a time.

6. **Component operations.** The wizard (not the iframe directly) performs mutations: add, remove, duplicate, move, reset, update text, lock/unlock. These arrive as inbound events; `LiveEditPage` routes them to the correct view in the tree.

7. **Drag and drop.** Existing components: user drags from region to region via jQuery-UI sortable; editor fires `MoveComponentEvent`. New components from palette: wizard must send `CreateOrDestroyDraggableEvent(type, true)` first to create a hidden proxy element; jQuery-UI draggable picks it up; on drop the editor fires `AddComponentEvent`. The wizard responds with `LoadComponentViewEvent`; the npm host fetches fresh HTML, re-mounts it, then calls `PageEditor.notify(ComponentLoaded, {path})`.

8. **Before save.** The wizard fires `IframeBeforeContentSavedEvent`; the editor persists the current selection path to `sessionStorage`. On next reload, `restoreSelection` re-selects the saved component.

---

## Setup and runtime context

- The editor runs inside a **preview iframe** inside Content Studio.
- The iframe's page is **server-rendered HTML** annotated with `data-portal-*` attributes.
- Communication between iframe and wizard uses an **`IframeEventBus`** (from `@enonic/lib-admin-ui`) that serializes class instances across the `window.parent` boundary.
- The editor has no backend communication of its own; all server round-trips go through the wizard or the npm consumer.
- jQuery and jQuery-UI are **global side-effects** of importing the package. Any reimplementation must decide how to handle this dependency.

## Flagged modules with deep specs

The following three modules received full 11-section deep-dive analysis. Their module files in `modules/` merge the medium-depth summary with the deep-dive content:

- [`modules/inbound-router.md`](modules/inbound-router.md) — LiveEditPage (the routing hub)
- [`modules/view-base.md`](modules/view-base.md) — ItemView (the behavioral core)
- [`modules/drag-and-drop.md`](modules/drag-and-drop.md) — DragAndDrop (the drag subsystem)

## Known gaps

- No formal audit pass was executed. The `audit.md` file consolidates suspicious conditions extracted during module and contract analysis.
- External event class shapes (defined in `@enonic/lib-contentstudio` and `@enonic/lib-admin-ui`) are inferred from call-site getters, not from the source of those libraries.
- The npm consumer (`app-contentstudio`'s `EditorEventHandler.ts`) is referenced for behavioral context but was not part of this bundle's analysis scope.
