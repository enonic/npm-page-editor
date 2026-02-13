import {ItemViewPlaceholder} from './ItemViewPlaceholder';
import {type ComponentType} from '@enonic/lib-contentstudio/app/page/region/ComponentType';

export abstract class DescriptorBasedComponentViewPlaceholder
    extends ItemViewPlaceholder {

    abstract getType(): ComponentType;
}
