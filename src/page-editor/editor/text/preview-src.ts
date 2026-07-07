/**
 * Rewrites `image://` / `media://` render URLs inside text-component HTML to the
 * admin REST preview URLs the iframe can actually load, parameterized by the
 * project name (`$hostContext.project`).
 *
 * URLs are prefixed with `$hostContext.hostDomain` when the host provides one,
 * so cross-origin embedding (site iframe on a different domain than the XP
 * admin) still loads images from the admin origin. Without it they stay
 * relative to the admin prefix, keeping the shape
 * `/admin/rest-v2/cs/cms/<project>/content/content/image/<id>?…`.
 */

import {isBlank, substringBetween} from '../../util/string';
import {appendParam, decodeUrlParams, joinPath, relativePath} from '../../util/uri';
import {getHostContext} from '../stores/host';

const URL_PREFIX_PREVIEW = 'content/image/';
const URL_PREFIX_RENDER = 'image://';
const URL_PREFIX_RENDER_ORIGINAL = 'media://';
const DEFAULT_IMAGE_SIZE = 768;
const ADMIN_URI = '/admin';
const REST_PREFIX = 'rest-v2/cs';
const CONTENT_ROOT_PATH = 'content';

function getCmsRestUri(path: string): string {
    const domain = getHostContext().hostDomain ?? '';
    return joinPath(domain, ADMIN_URI, REST_PREFIX, relativePath(path));
}

function getCmsPath(projectName: string): string {
    return `cms/${projectName}/${CONTENT_ROOT_PATH}`;
}

/**
 * Builds the preview URL for an image id: `media://` (original) sources get the
 * raw binary, `image://` sources a sized, width-scaled rendition.
 */
function resolveForPreview(imageId: string, projectName: string, isOriginal: boolean): string {
    let url = getCmsRestUri(`${getCmsPath(projectName)}/${URL_PREFIX_PREVIEW}${imageId}`);

    url = appendParam('ts', `${Date.now()}`, url);

    if (isOriginal) {
        url = appendParam('source', 'true', url);
    } else {
        url = appendParam('size', `${DEFAULT_IMAGE_SIZE}`, url);
        url = appendParam('scaleWidth', 'true', url);
    }

    return url;
}

function extractImageId(imgSrc: string): string {
    const prefix = imgSrc.includes(URL_PREFIX_RENDER) ? URL_PREFIX_RENDER : URL_PREFIX_RENDER_ORIGINAL;

    if (imgSrc.includes('?')) {
        return substringBetween(imgSrc, prefix, '?');
    }

    return imgSrc.replace(prefix, '');
}

function getConvertedImageSrc(imgSrc: string, projectName: string): string {
    const imageId = extractImageId(imgSrc);
    const isOriginal = imgSrc.includes(URL_PREFIX_RENDER_ORIGINAL);

    // Styles (filter/aspect-ratio) are not resolved here; the `?style=`
    // parameter is consumed only so it does not break the produced URL.
    let imgUrl = resolveForPreview(imageId, projectName, isOriginal);

    // Support a `scale` parameter carried over from older content.
    const src = imgSrc.replace(/&amp;/g, '&');
    const params = decodeUrlParams(src);
    if (params.scale) {
        imgUrl = appendParam('scale', params.scale, imgUrl);
    }

    return ` src="${imgUrl}" data-src="${imgSrc}"`;
}

/**
 * Converts every `image://`/`media://` `<img src>` in the given HTML to its
 * admin preview URL. `contentId`/`projectName` default to the editor stores.
 */
export function convertRenderSrcToPreviewSrc(value: string, projectName?: string): string {
    if (!value) {
        return '';
    }

    const resolvedProject = projectName ?? getHostContext().project?.name ?? '';

    let processedContent = value;
    const regex = /<img.*?src="(.*?)"/g;
    let imgSrcs = regex.exec(processedContent);

    while (imgSrcs) {
        imgSrcs.forEach((imgSrc: string) => {
            if (imgSrc.startsWith(URL_PREFIX_RENDER) || imgSrc.startsWith(URL_PREFIX_RENDER_ORIGINAL)) {
                processedContent = processedContent.replace(
                    ` src="${imgSrc}"`,
                    getConvertedImageSrc(imgSrc, resolvedProject),
                );
            }
        });

        imgSrcs = regex.exec(processedContent);
    }

    return processedContent;
}

/**
 * Resolves the preview HTML for a text component value: blank text yields an
 * empty string, otherwise the image render URLs are rewritten for the editing
 * content's project.
 */
export function resolvePreviewHtml(text: string | undefined): string {
    if (text == null || isBlank(text)) {
        return '';
    }

    return convertRenderSrcToPreviewSrc(text, getHostContext().project?.name);
}
