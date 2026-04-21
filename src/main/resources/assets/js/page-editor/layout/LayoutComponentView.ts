import {type Element} from '@enonic/lib-admin-ui/dom/Element';
import {ObjectHelper} from '@enonic/lib-admin-ui/ObjectHelper';
import {ComponentViewBuilder} from '../ComponentView';
import {LayoutItemType} from './LayoutItemType';
import {type ItemViewAddedEvent} from '@enonic/lib-contentstudio/page-editor/event/ItemViewAddedEvent';
import {type ItemViewRemovedEvent} from '@enonic/lib-contentstudio/page-editor/event/ItemViewRemovedEvent';
import {type ItemView} from '../ItemView';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import {RegionItemType} from '@enonic/lib-contentstudio/page-editor/RegionItemType';
import {RegionView, RegionViewBuilder} from '../RegionView';
import {type ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {DescriptorBasedComponentView} from '../DescriptorBasedComponentView';

export class LayoutComponentViewBuilder
    extends ComponentViewBuilder {

    constructor() {
        super();
        this.setType(LayoutItemType.get());
    }
}

export class LayoutComponentView
    extends DescriptorBasedComponentView {

    private regionViews: RegionView[];

    private readonly itemViewAddedListener: (event: ItemViewAddedEvent) => void;

    private readonly itemViewRemovedListener: (event: ItemViewRemovedEvent) => void;

    constructor(builder: LayoutComponentViewBuilder) {
        super(builder.setInspectActionRequired(true));

        this.regionViews = [];
        this.itemViewAddedListener = (event: ItemViewAddedEvent) => this.notifyItemViewAdded(event.getView(), event.isNewlyCreated());
        this.itemViewRemovedListener = (event: ItemViewRemovedEvent) => this.notifyItemViewRemoved(event.getView());

        this.parseRegions();
    }

    getComponentViewByPath(path: ComponentPath): ItemView {
        let result: ItemView = null;

        this.regionViews.some((regionView: RegionView) => {
            if (regionView.getPath().equals(path)) {
                result = regionView;
            } else {
                result = regionView.getComponentViewByPath(path);
            }

            return !!result;
        });

        return result;
    }

    getRegions(): RegionView[] {
        return this.regionViews;
    }

    toItemViewArray(): ItemView[] {

        let array: ItemView[] = [];
        array.push(this);
        this.regionViews.forEach((regionView: RegionView) => {
            const itemsInRegion = regionView.toItemViewArray();
            array = array.concat(itemsInRegion);
        });
        return array;
    }

    private parseRegions() {
        this.regionViews.forEach((regionView) => {
            this.unregisterRegionView(regionView);
        });

        this.regionViews = [];

        return this.doParseRegions();
    }

    private doParseRegions(parentElement?: Element) {
        const children = parentElement ? parentElement.getChildren() : this.getChildren();

        children.forEach((childElement: Element) => {
            const itemType = ItemType.fromElement(childElement);
            const isRegionView = ObjectHelper.iFrameSafeInstanceOf(childElement, RegionView);

            if (isRegionView) {
                //
            } else if (itemType && RegionItemType.get().equals(itemType)) {
                const regionName = RegionItemType.getRegionName(childElement);
                const builder = new RegionViewBuilder()
                    .setParentView(this)
                    .setParentElement(parentElement ? parentElement : this)
                    .setName(regionName)
                    .setLiveEditParams(this.liveEditParams)
                    .setElement(childElement);

                this.registerRegionView(new RegionView(builder));
            } else {
                this.doParseRegions(childElement);
            }
        });
    }

    private registerRegionView(regionView: RegionView) {
        this.regionViews.push(regionView);
        this.notifyItemViewAdded(regionView);

        regionView.onItemViewAdded(this.itemViewAddedListener);
        regionView.onItemViewRemoved(this.itemViewRemovedListener);
    }

    private unregisterRegionView(regionView: RegionView) {
        const index = this.regionViews.indexOf(regionView);
        if (index > -1) {
            this.regionViews.splice(index, 1);

            this.notifyItemViewRemoved(regionView);

            regionView.unItemViewAdded(this.itemViewAddedListener);
            regionView.unItemViewRemoved(this.itemViewRemovedListener);
        }
    }
}
