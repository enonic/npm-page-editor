/**
 * Generic URL/path helpers. These are domain-free — nothing here reads a
 * configured domain or admin prefix; callers pass fully-formed paths. Shared by
 * the inline preview click listener and the text-component image URL builder.
 */

import {isBlank} from './string';

type LocationWindow = {location: Pick<Location, 'protocol' | 'host' | 'href'>};

export function relativePath(path: string): string {
    if (isBlank(path)) {
        return '';
    }

    return path.startsWith('/') ? path.substring(1) : path;
}

// Join non-empty segments with `/`, collapsing runs of slashes except after a
// scheme (`://`).
export function joinPath(...paths: string[]): string {
    return paths
        .filter(part => part.length > 0)
        .join('/')
        .replace(/(^|[^:])\/{2,}/g, '$1/');
}

export function appendParam(name: string, value: string, url: string): string {
    const separator = url.indexOf('?') > -1 ? '&' : '?';
    return `${url}${separator}${name}=${value}`;
}

export function decodeUrlParams(url: string): Record<string, string | undefined> {
    if (isBlank(url)) {
        return {};
    }

    const queryStart = url.indexOf('?');
    const query = queryStart >= 0 ? url.substring(queryStart + 1) : url;

    const params: Record<string, string | undefined> = {};
    for (const pair of query.split('&')) {
        if (pair.length === 0) {
            continue;
        }

        const eq = pair.indexOf('=');
        if (eq < 0) {
            params[pair] = undefined;
        } else {
            params[pair.substring(0, eq)] = decodeURIComponent(pair.substring(eq + 1));
        }
    }

    return params;
}

export function isNavigatingOutsideOfXP(href: string, contentWindow: LocationWindow): boolean {
    // href should start with '/' or, after stripping the window's protocol
    // and host, still equal the original href (i.e. it was already absolute
    // to a different host).
    return href.startsWith('/') ? false : trimWindowProtocolAndPortFromHref(href, contentWindow) === href;
}

export function trimWindowProtocolAndPortFromHref(href: string, contentWindow: LocationWindow): string {
    const location = contentWindow.location;
    return relativePath(href.replace(`${location.protocol}//${location.host}`, ''));
}

export function trimAnchor(trimMe: string): string {
    const index = trimMe.lastIndexOf('#');
    return index >= 0 ? relativePath(trimMe.substring(0, index)) : relativePath(trimMe);
}

export function trimUrlParams(trimMe: string): string {
    const index = trimMe.lastIndexOf('?');
    return index >= 0 ? trimMe.substring(0, index) : trimMe;
}

export function isNavigatingWithinSamePage(url: string, contentWindow: LocationWindow): boolean {
    const href = contentWindow.location.href;
    const currentPath = trimUrlParams(trimAnchor(trimWindowProtocolAndPortFromHref(href, contentWindow)));
    // Normalize the caller's path too — call sites pass a '/'-prefixed path
    // while the stripped href never carries a leading slash.
    return relativePath(trimUrlParams(url)) === currentPath;
}

export function isDownloadLink(url: string): boolean {
    return url.indexOf('attachment/download') > 0;
}
