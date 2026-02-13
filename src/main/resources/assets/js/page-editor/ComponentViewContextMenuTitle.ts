import {ItemViewContextMenuTitle} from '@enonic/lib-contentstudio/page-editor/ItemViewContextMenuTitle';
import {type ComponentItemType} from './ComponentItemType';
import {type Component} from '@enonic/lib-contentstudio/app/page/region/Component';

export class ComponentViewContextMenuTitle<_COMPONENT extends Component>
    extends ItemViewContextMenuTitle {

    constructor(name: string, type: ComponentItemType) {
        super(name || '', type.getConfig().getIconCls());
    }

}
