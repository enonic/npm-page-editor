# Enonic Page Editor

A package that adds live editing capabilities to externally rendered sites in Enonic Content Studio.

### Install

```bash
npm i --save @enonic/page-editor
```

### Usage

Mount the editor from inside the Content Studio render iframe:

```ts
import {initPageEditor, type ComponentRecord} from '@enonic/page-editor';

const editor = initPageEditor(document.body, window.parent, {
  hostDomain: 'https://content-studio.example',
  onComponentLoadRequest: async (path, existing) => {
    const config = editor.getConfig();
    const record = editor.getRecord(path);
    const element = editor.getElement(path);
    if (config == null || record == null || element == null) return;

    try {
      const response = await fetch(buildComponentUrl(config.contentId, path));

      // Newly-added components with portal contributions need a full page reload
      // so the portal can inject their contributions into <head>.
      const sameDescriptorElsewhere =
        record.descriptor != null &&
        editor.findRecordsByDescriptor(record.descriptor).some((r: ComponentRecord) => r.path !== path);

      if (!existing && response.headers.has('X-Has-Contributions') && !sameDescriptorElsewhere) {
        editor.requestPageReload();
        return;
      }

      element.replaceWith(parseHtml(await response.text()));
      editor.notifyComponentLoaded(path);
    } catch (reason) {
      editor.notifyComponentLoadFailed(path, String(reason));
    }
  },
});
```

The returned `PageEditorInstance` exposes read-only accessors alongside the lifecycle methods:

| Accessor                              | Returns                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `getConfig()`                         | Latest `PageConfig` received via `init`, or `undefined` before init.    |
| `getRecord(path)`                     | Registered `ComponentRecord` for `path`, or `undefined`.                |
| `getElement(path)`                    | Mounted `HTMLElement` for `path`, or `undefined`.                       |
| `findRecordsByDescriptor(descriptor)` | All records whose descriptor key matches — useful to detect duplicates. |
