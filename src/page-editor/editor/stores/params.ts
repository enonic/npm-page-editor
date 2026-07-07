import {atom} from 'nanostores';

import type {PageEditorParams} from '../../protocol';

export const $params = atom<PageEditorParams | undefined>(undefined);

export function setParams(params: PageEditorParams): void {
    $params.set(params);
}

export function getParams(): PageEditorParams | undefined {
    return $params.get();
}
