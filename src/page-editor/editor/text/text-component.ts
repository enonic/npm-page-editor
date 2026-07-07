/**
 * Editor-side preparation for text components. Server markup carries raw
 * `image://` render URLs and no text direction; both must be applied client-side
 * so the live edit matches what the host's `update-text-component` path produces.
 * Runs after the initial page parse and whenever a text component's server HTML
 * is (re)loaded.
 */

import {getParams} from '../stores/params';
import {getRegistry} from '../stores/registry';
import {convertRenderSrcToPreviewSrc} from './preview-src';
import {isRtlLanguage} from './rtl';

function applyTextDirection(element: HTMLElement): void {
    if (isRtlLanguage(getParams()?.language)) {
        element.setAttribute('dir', 'rtl');
    } else {
        element.removeAttribute('dir');
    }
}

function rewriteRenderedImages(element: HTMLElement): void {
    const html = element.innerHTML;
    const preview = convertRenderSrcToPreviewSrc(html);
    if (preview !== html) {
        element.innerHTML = preview;
    }
}

/**
 * Applies the editing language's text direction and rewrites image render URLs
 * for preview on a single text component element.
 */
export function prepareTextComponent(element: HTMLElement): void {
    applyTextDirection(element);
    rewriteRenderedImages(element);
}

/** Prepares every tracked text component; used after the initial page parse. */
export function prepareTextComponents(): void {
    Object.values(getRegistry()).forEach(record => {
        if (record.type === 'text' && record.element) {
            prepareTextComponent(record.element);
        }
    });
}
