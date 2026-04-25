# Enonic Page Editor

A package that adds live editing capabilities to externally rendered sites in Enonic Content Studio.

### Install

```bash
npm i --save @enonic/page-editor
```

### Usage

Preview mode (read-only):

```ts
import {PageEditor} from '@enonic/page-editor';

PageEditor.initPreview();
```

Edit mode (with component loading wired up):

```ts
import {PageEditor} from '@enonic/page-editor';

PageEditor.initEditor({
    resolveUrl: ({view}) => `/components/${view.getPath()}`,
    // optional: trigger a full page reload instead of swapping the component
    checkPageReloadRequired: ({headers}) => headers.has('X-Has-Contributions'),
    // optional: sanitize HTML before insertion; `type` is the component short name
    sanitizeHtml: (html, type) => type === 'fragment' ? sanitize(html) : html,
});
```
