import {Element, NewElementBuilder} from '@enonic/lib-admin-ui/dom/Element';
import {type ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import type {ComponentItemType} from './ComponentItemType';
import {ComponentView} from './ComponentView';
import {CreateItemViewConfig} from './CreateItemViewConfig';
import {FragmentItemType} from './fragment/FragmentItemType';
import type {RegionView} from './RegionView';
import {markError, markLoading, reconcileSubtree} from './editor/adapter/reconcile';
import {getCurrentPageView} from './editor/bridge';

export function renderComponentHtml(path: ComponentPath, html: string): boolean {
    const pageView = getCurrentPageView();
    const view = pageView?.getComponentViewByPath(path);

    if (!(view instanceof ComponentView)) {
        console.warn(`PageEditor: cannot render component at [${path.toString()}] — no component view found`);
        return false;
    }

    const key = path.toString();
    markLoading(key, false);
    markError(key, false);

    const componentType = view.getType();
    const element = wrapHtml(html, componentType);
    const parent = view.getParentItemView();

    const config = new CreateItemViewConfig<RegionView>()
        .setLiveEditParams(parent.getLiveEditParams())
        .setParentView(parent)
        .setPositionIndex(view.getPath().getPath() as number)
        .setElement(element);

    const replacement = view.createView(componentType, config) as ComponentView;
    view.replaceWith(replacement);

    reconcileSubtree(pageView, key);
    return true;
}

export function markComponentLoading(path: ComponentPath): void {
    const key = path.toString();
    markError(key, false);
    markLoading(key, true);
}

export function markComponentError(path: ComponentPath): void {
    const key = path.toString();
    markLoading(key, false);
    markError(key, true);
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
