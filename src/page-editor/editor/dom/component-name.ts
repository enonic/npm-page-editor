/**
 * Resolves a human-readable component name from the `$page` model. Used by the
 * context menu header.
 */

import {getComponentInfoAt} from '../../protocol';
import {htmlToString} from '../../util/string';
import {getPage} from '../stores/page';

const TEXT_SNIPPET_MAX_LENGTH = 100;

function getTextSnippet(text: string | undefined): string {
    const normalized = htmlToString(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    const codepoints = Array.from(normalized);
    return codepoints.length > TEXT_SNIPPET_MAX_LENGTH
        ? codepoints.slice(0, TEXT_SNIPPET_MAX_LENGTH).join('')
        : normalized;
}

export function getComponentName(path: string): string | undefined {
    const info = getComponentInfoAt(getPage(), path);
    if (info == null) {
        return undefined;
    }

    if (info.kind === 'text') {
        const snippet = getTextSnippet(info.text);
        if (snippet.length > 0) {
            return snippet;
        }
    }

    const name = info.name;
    return name != null && name.length > 0 ? name : undefined;
}
