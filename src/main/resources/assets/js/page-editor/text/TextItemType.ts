import {type ItemTypeConfig} from '@enonic/lib-contentstudio/page-editor/ItemTypeConfig';
import {ComponentItemType} from '../ComponentItemType';

export class TextItemType
    extends ComponentItemType {

    private static INSTANCE: TextItemType = new TextItemType();

    static get(): TextItemType {
        return TextItemType.INSTANCE;
    }

    constructor() {
        super('text');
    }

    isComponentType(): boolean {
        return true;
    }

    protected getItemTypeConfig(itemType: string): ItemTypeConfig {
        const config = super.getItemTypeConfig(itemType);

        config.getContextMenuConfig().push('edit');

        return config;

    }
}

TextItemType.get();
