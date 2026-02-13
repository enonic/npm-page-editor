import {ItemViewContextMenuTitle} from '@enonic/lib-contentstudio/page-editor/ItemViewContextMenuTitle';
import {RegionItemType} from '@enonic/lib-contentstudio/page-editor/RegionItemType';

export class RegionViewContextMenuTitle
    extends ItemViewContextMenuTitle {

    constructor(name: string) {
        super(name, RegionItemType.get().getConfig().getIconCls());
    }

}
