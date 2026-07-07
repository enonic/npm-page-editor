import {atom} from 'nanostores';

import type {PageJson} from '../../protocol';

export const $page = atom<PageJson | undefined>(undefined);

export function setPage(page: PageJson | undefined): void {
    $page.set(page);
}

export function getPage(): PageJson | undefined {
    return $page.get();
}
