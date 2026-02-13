import {ItemTypeConfig, type ItemTypeConfigJson} from '@enonic/lib-contentstudio/page-editor/ItemTypeConfig';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';

export class ComponentItemType
    extends ItemType {

    protected getItemTypeConfig(itemType: string): ItemTypeConfig {
        return new ItemTypeConfig({
            cssSelector: '[data-portal-component-type=' + itemType + ']',
            draggable: true,
            cursor: 'move',
            iconCls: 'icon-' + itemType,
            highlighterStyle: {
                stroke: 'rgba(68, 68, 68, 1)', // not used
                strokeDasharray: '',
                fill: 'rgba(255, 255, 255, 0)' // not used
            },
            contextMenuConfig: ['parent', 'remove', 'clear', 'duplicate']
        } as ItemTypeConfigJson);
    }
}
