# Enonic Page Editor

A package that adds live editing capabilities to externally rendered sites in Enonic Content Studio.

### Install

```bash
pnpm add @enonic/page-editor
```

### Usage

Inline (preview) mode — link clicks inside the page are reported to the host:

```ts
import {init} from '@enonic/page-editor';

init();
```

Edit mode — the editor boots after the host's `initialize` message and asks the
consumer to load component markup:

```ts
import {
    getContent,
    init,
    reloadPage,
    renderComponent,
    renderErrorComponent,
    renderLoadingComponent,
    subscribe,
    type ComponentPath,
} from '@enonic/page-editor';

init({editMode: true});

subscribe('component-load-request', ({path, isExisting}) => {
    void loadComponent(path, isExisting);
});

async function loadComponent(path: ComponentPath, isExisting: boolean): Promise<void> {
    renderLoadingComponent(path);

    try {
        const content = getContent();
        if (content == null) throw new Error('Content is not available');

        const component = path.toString().replace(/^\//, '');
        const response = await fetch(`/edit/${content.id}/_/component/${component}`);

        // A newly inserted component may pull in server-side contributions the
        // page can't patch in place — reload instead of swapping markup.
        if (!isExisting && response.headers.has('X-Has-Contributions')) {
            reloadPage();
            return;
        }

        renderComponent(path, await response.text());
    } catch (reason) {
        renderErrorComponent(path, reason instanceof Error ? reason : new Error(String(reason)));
    }
}
```

`init` accepts an optional `hostOrigin` (the Content Studio origin, e.g.
`https://admin.example.com`) to pin the postMessage transport; without it the
origin is derived from `document.referrer`.

### API

| Function                             | Purpose                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `init(config?)`                      | Boots the editor: `{editMode?, hostOrigin?}`                                |
| `isInitialized()`                    | Whether `init` has already run                                              |
| `subscribe(type, handler)`           | Listens for editor events (`component-load-request` → `{path, isExisting}`) |
| `renderLoadingComponent(path)`       | Shows the loading state for a component                                     |
| `renderComponent(path, html)`        | Replaces a component's markup with host-rendered HTML                       |
| `renderErrorComponent(path, reason)` | Marks a component as failed to load                                         |
| `reloadPage()`                       | Asks the host to reload the page                                            |
| `getComponentAt(path)`               | The parsed component record at a path                                       |
| `getAllComponents()`                 | All parsed component records                                                |
| `getContent()`                       | The edited content info provided by the host                                |

The host ⟷ editor postMessage contract is exported separately as
`@enonic/page-editor/protocol` (zero-dependency, SSR-safe) and documented in
[`docs/protocol.md`](docs/protocol.md).
