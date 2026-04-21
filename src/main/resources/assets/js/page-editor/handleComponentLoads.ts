import DOMPurify from 'dompurify';
import {Element, NewElementBuilder} from '@enonic/lib-admin-ui/dom/Element';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import {ComponentView} from './ComponentView';
import {FragmentItemType} from './fragment/FragmentItemType';
import {CreateItemViewConfig} from './CreateItemViewConfig';
import {type RegionView} from './RegionView';
import {type ComponentItemType} from './ComponentItemType';
import {EditorEvents, type EditorEvent} from './event/EditorEvent';
import {type ItemView} from './ItemView';
import {PageEditor} from './PageEditor';

export type ComponentLoadContext = {
    view: ComponentView;
    isExisting: boolean;
};

export type EditorConfig = {
    /** Build the URL to fetch the component HTML from. */
    resolveUrl: (ctx: ComponentLoadContext) => string;

    /**
     * Decide whether to trigger a full page reload instead of swapping this component.
     * Only consulted for fresh loads (isExisting === false), after the response headers arrive.
     * The body has not yet been consumed. Default: never reload.
     */
    checkPageReloadRequired?: (ctx: ComponentLoadContext & {headers: Headers}) => boolean;

    /**
     * Transform (typically sanitize) the fetched HTML before it's inserted into the page.
     * `type` is the component's short name (e.g. `'fragment'`, `'part'`, `'layout'`, `'text'`).
     * Default: DOMPurify-sanitize fragments; pass other types through untouched.
     */
    sanitizeHtml?: (html: string, type: string) => string;
};

let registered = false;

export function handleComponentLoads(handlers: EditorConfig): void {
    if (registered) {
        throw new Error('PageEditor: component load handlers are already registered');
    }
    registered = true;

    const sanitizeHtml = handlers.sanitizeHtml ?? defaultSanitizeHtml;
    const checkPageReloadRequired = handlers.checkPageReloadRequired ?? ((): boolean => false);

    PageEditor.on(EditorEvents.ComponentLoadRequest, (event: EditorEvent<{view: ItemView; isExisting: boolean}>) => {
        const {view, isExisting} = event.getData();
        if (!(view instanceof ComponentView)) return;

        const ctx: ComponentLoadContext = {view, isExisting};
        const url = handlers.resolveUrl(ctx);

        view.showLoadingSpinner();

        fetch(url)
            .then(async (response) => {
                if (!isExisting && checkPageReloadRequired({...ctx, headers: response.headers})) {
                    PageEditor.notify(EditorEvents.PageReloadRequest);
                    return;
                }

                const html = await response.text();
                replaceComponentView(view, html, sanitizeHtml);

                PageEditor.notify(EditorEvents.ComponentLoaded, {path: view.getPath()});
            })
            .catch((reason: Error) => {
                console.warn(`PageEditor: component load at [${view.getPath()}] failed:`, reason);
                PageEditor.notify(EditorEvents.ComponentLoadFailed, {path: view.getPath(), reason});
            });
    });
}

function replaceComponentView(view: ComponentView, html: string, sanitizeHtml: (html: string, type: string) => string): void {
    const componentType = view.getType();
    const sanitized = sanitizeHtml(html, componentType.getShortName());
    const element = wrapHtml(sanitized, componentType);
    const parent = view.getParentItemView();

    const config = new CreateItemViewConfig<RegionView>()
        .setLiveEditParams(parent.getLiveEditParams())
        .setParentView(parent)
        .setPositionIndex(view.getPath().getPath() as number)
        .setElement(element);

    const replacement = view.createView(componentType, config) as ComponentView;

    view.replaceWith(replacement);
}

function wrapHtml(html: string, componentType: ComponentItemType): Element {
    if (!FragmentItemType.get().equals(componentType)) {
        return Element.fromString(html);
    }

    const inner = Element.fromHtml(html);
    const wrapper = new Element(new NewElementBuilder().setTagName('div'));
    wrapper.getEl().setAttribute(`data-${ItemType.ATTRIBUTE_TYPE}`, 'fragment');
    wrapper.appendChild(inner);

    return wrapper;
}

function defaultSanitizeHtml(html: string, type: string): string {
    if (type === FragmentItemType.get().getShortName()) {
        return DOMPurify.sanitize(html);
    }
    return html;
}
