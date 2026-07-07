/**
 * Plain JSON model of a page, mirroring the wire format produced by the
 * Enonic XP / Content Studio backend. This is the only page representation
 * the editor keeps: a serializable tree, no class instances.
 */

import {ComponentPath} from './ComponentPath';

//
// * Wire Types
//

export type ComponentKind = 'page' | 'region' | 'part' | 'layout' | 'text' | 'fragment' | 'image';

/** Kinds that can be inserted into a region. */
export type InsertableComponentKind = Exclude<ComponentKind, 'page' | 'region'>;

/** Kinds offered in the insert panel — everything insertable except images. */
export type InsertMenuKind = Exclude<InsertableComponentKind, 'image'>;

export type ComponentJson = {
    name?: string;
};

export type TextComponentJson = ComponentJson & {
    text?: string;
};

export type DescriptorBasedComponentJson = ComponentJson & {
    descriptor?: string;
    config?: unknown[];
};

export type LayoutComponentJson = DescriptorBasedComponentJson & {
    regions?: RegionJson[];
};

export type FragmentComponentJson = ComponentJson & {
    fragment?: string;
    config?: unknown[];
};

export type ImageComponentJson = ComponentJson & {
    image?: string;
    config?: unknown[];
};

export type ComponentWrapperJson = {
    PartComponent?: DescriptorBasedComponentJson;
    LayoutComponent?: LayoutComponentJson;
    TextComponent?: TextComponentJson;
    FragmentComponent?: FragmentComponentJson;
    ImageComponent?: ImageComponentJson;
};

export type RegionJson = {
    name: string;
    components?: ComponentWrapperJson[];
};

export type PageJson = {
    controller?: string;
    template?: string;
    regions?: RegionJson[];
    fragment?: ComponentWrapperJson;
    config?: unknown[];
};

//
// * Lookups
//

export type PageComponentInfo = {
    kind: InsertableComponentKind;
    name?: string;
    descriptor?: string;
    text?: string;
    fragmentId?: string;
    regions?: RegionJson[];
};

function unwrapComponent(wrapper: ComponentWrapperJson): PageComponentInfo | undefined {
    if (wrapper.PartComponent) {
        const {name, descriptor} = wrapper.PartComponent;
        return {kind: 'part', name, descriptor};
    }
    if (wrapper.LayoutComponent) {
        const {name, descriptor, regions} = wrapper.LayoutComponent;
        return {kind: 'layout', name, descriptor, regions};
    }
    if (wrapper.TextComponent) {
        const {name, text} = wrapper.TextComponent;
        return {kind: 'text', name, text};
    }
    if (wrapper.FragmentComponent) {
        const {name, fragment} = wrapper.FragmentComponent;
        return {kind: 'fragment', name, fragmentId: fragment};
    }
    if (wrapper.ImageComponent) {
        const {name} = wrapper.ImageComponent;
        return {kind: 'image', name};
    }
    return undefined;
}

function findInRegions(
    regions: RegionJson[] | undefined,
    segments: readonly (string | number)[],
): PageComponentInfo | undefined {
    if (segments.length < 2) return undefined;

    const [regionName, componentIndex, ...rest] = segments;
    const region = regions?.find(candidate => candidate.name === String(regionName));
    const wrapper = region?.components?.[Number(componentIndex)];
    if (wrapper == null) return undefined;

    const info = unwrapComponent(wrapper);
    if (info == null || rest.length === 0) return info;

    return findInRegions(info.regions, rest);
}

/**
 * Resolves the component at the given path. In fragment mode the root path
 * resolves to the fragment root component and nested paths descend from its
 * regions; in page mode the root path is `undefined` and nested paths descend
 * from the top-level page regions.
 */
export function getComponentInfoAt(
    page: PageJson | undefined,
    path: string | ComponentPath,
): PageComponentInfo | undefined {
    if (page == null) return undefined;

    const componentPath = typeof path === 'string' ? ComponentPath.fromString(path) : path;

    if (componentPath.isRoot()) {
        return page.fragment ? unwrapComponent(page.fragment) : undefined;
    }

    const regions = page.fragment ? unwrapComponent(page.fragment)?.regions : page.regions;
    return findInRegions(regions, componentPath.getSegments());
}

export function getTextAt(page: PageJson | undefined, path: string | ComponentPath): string | undefined {
    return getComponentInfoAt(page, path)?.text;
}

export function getFragmentIdAt(page: PageJson | undefined, path: string | ComponentPath): string | undefined {
    return getComponentInfoAt(page, path)?.fragmentId;
}

export function getDescriptorAt(page: PageJson | undefined, path: string | ComponentPath): string | undefined {
    return getComponentInfoAt(page, path)?.descriptor;
}

export function hasController(page: PageJson | undefined): boolean {
    return Boolean(page?.controller || page?.template || page?.fragment);
}
