# Module Index

Each row links to the per-module file. Modules marked **[deep]** have a merged medium + deep-dive spec.

| Module | Role | Per-module file |
|--------|------|-----------------|
| bootstrap-and-surface | Static entry point: jQuery/jQuery-UI install, ~30-class iframe-bus registration, npm `on/un/notify` API, global keyboard/link listeners. | [modules/bootstrap-and-surface.md](modules/bootstrap-and-surface.md) |
| inbound-router | **[deep]** LiveEditPage: rehydrates the iframe on `InitializeLiveEditEvent`, routes all 18 inbound wizard events to view-tree mutations, manages selection persistence, handles palette-drag proxy trick. | [modules/inbound-router.md](modules/inbound-router.md) |
| view-base | **[deep]** ItemView: abstract base for every selectable element; hover bubble-through, click decision tree, touch long-press, context menu, insert submenu, overlay singleton wiring. | [modules/view-base.md](modules/view-base.md) |
| ids-and-factory | ItemViewId (numeric DOM-stamped identity), ItemViewIdProducer (monotonic per-page counter), DefaultItemViewFactory (short-name → view-class switch). | [modules/ids-and-factory.md](modules/ids-and-factory.md) |
| drag-and-drop | **[deep]** DragAndDrop singleton: jQuery-UI sortable/draggable wiring, drop rules (no nested layouts, no fragment-containing-layouts in layouts), palette proxy, Firefox workarounds. DragPlaceholder companion. | [modules/drag-and-drop.md](modules/drag-and-drop.md) |
| page-view | PageView: parses iframe body into view tree, owns `viewsById` registry, lock/unlock state machine, page-level context menu, page vs fragment dual mode, PagePlaceholder for uncontrolled pages. | [modules/page-view.md](modules/page-view.md) |
| region-view | RegionView: `data-portal-region` container; ordered list of ComponentViews; add/remove/empty operations; drag-over class; add/remove event bubble-up to PageView. | [modules/region-view.md](modules/region-view.md) |
| component-view-base | ComponentView + DescriptorBasedComponentView + ContentBasedComponentView: context menu action set (Inspect/Reset/Remove/Duplicate/CreateFragment), Del/Backspace shortcuts, replaceWith (hot-swap), moveToRegion, clone/duplicate. | [modules/component-view-base.md](modules/component-view-base.md) |
| overlay-chrome | Highlighter (hover SVG outline), SelectedHighlighter (selection crosshair), Shader (4-panel dimmer + click forwarding), Cursor (body cursor swap). Absolute-positioned singletons over the page. | [modules/overlay-chrome.md](modules/overlay-chrome.md) |
| specialized-component-views | Part, Layout, Text, Fragment component view specializations. Layout hosts nested RegionViews; Text has click/dblclick demux and RTL; Fragment strips inner component-type attrs for atomic DnD. | [modules/specialized-component-views.md](modules/specialized-component-views.md) |
