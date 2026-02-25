import {DivEl} from '@enonic/lib-admin-ui/dom/DivEl';

export class ItemViewPlaceholder
    extends DivEl {

    static PAGE_EDITOR_PREFIX: string = 'xp-page-editor-';

    constructor() {
        super('item-placeholder', ItemViewPlaceholder.PAGE_EDITOR_PREFIX);
    }

    select() {
        // must be implemented by children
    }

    deselect() {
        // must be implemented by children
    }

    focus(): void {
        //
    }
}
