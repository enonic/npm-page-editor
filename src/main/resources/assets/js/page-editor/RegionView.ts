import {type Element} from '@enonic/lib-admin-ui/dom/Element';
import {ObjectHelper} from '@enonic/lib-admin-ui/ObjectHelper';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {assert} from '@enonic/lib-admin-ui/util/Assert';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {ItemViewAddedEvent} from '@enonic/lib-contentstudio/page-editor/event/ItemViewAddedEvent';
import {ItemViewRemovedEvent} from '@enonic/lib-contentstudio/page-editor/event/ItemViewRemovedEvent';
import type {ItemViewSelectedEventConfig} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import type {LiveEditParams} from '@enonic/lib-contentstudio/page-editor/LiveEditParams';
import {RegionItemType} from '@enonic/lib-contentstudio/page-editor/RegionItemType';
import {ComponentView} from './ComponentView';
import {CreateItemViewConfig} from './CreateItemViewConfig';
import {ItemView, ItemViewBuilder} from './ItemView';
import type {LayoutComponentView} from './layout/LayoutComponentView';
import {type PageView} from './PageView';
import {RegionViewContextMenuTitle} from './RegionViewContextMenuTitle';

export class RegionViewBuilder {

    parentElement: Element;

    parentView: ItemView;

    element: Element;

    name: string;

    liveEditParams: LiveEditParams;

    setParentElement(value: Element): RegionViewBuilder {
        this.parentElement = value;
        return this;
    }

    setParentView(value: ItemView): RegionViewBuilder {
        this.parentView = value;
        return this;
    }

    setElement(value: Element): RegionViewBuilder {
        this.element = value;
        return this;
    }

    setName(value: string): RegionViewBuilder {
        this.name = value;
        return this;
    }

    setLiveEditParams(value: LiveEditParams): RegionViewBuilder {
        this.liveEditParams = value;
        return this;
    }
}

export class RegionView
    extends ItemView {

    private componentViews: ComponentView[];

    private readonly name: string;

    private itemViewAddedListeners: ((event: ItemViewAddedEvent) => void)[];

    private itemViewRemovedListeners: ((event: ItemViewRemovedEvent) => void)[];

    private itemViewAddedListener: (event: ItemViewAddedEvent) => void;

    private itemViewRemovedListener: (event: ItemViewRemovedEvent) => void;

    private readonly resetAction: Action;

    constructor(builder: RegionViewBuilder) {
        super(new ItemViewBuilder()
            .setItemViewIdProducer(builder.parentView.getItemViewIdProducer())
            .setItemViewFactory(builder.parentView.getItemViewFactory())
            .setLiveEditParams(builder.liveEditParams || builder.parentView?.getLiveEditParams())
            .setType(RegionItemType.get())
            .setElement(builder.element)
            .setParentElement(builder.parentElement)
            .setParentView(builder.parentView)
            .setContextMenuTitle(new RegionViewContextMenuTitle(builder.name)));

        this.name = builder.name;
        this.addClassEx('region-view');

        this.componentViews = [];
        this.itemViewAddedListeners = [];
        this.itemViewRemovedListeners = [];
        this.resetAction = new Action(i18n('live.view.reset')).onExecuted(() => {
            this.deselect();
            this.empty();
        });
        this.initListeners();

        this.addRegionContextMenuActions();

        this.parseComponentViews();
        this.refreshEmptyState();
    }

    private initListeners() {

        this.itemViewAddedListener = (event: ItemViewAddedEvent) => this.notifyItemViewAdded(event.getView(), event.isNewlyCreated());

        this.itemViewRemovedListener = (event: ItemViewRemovedEvent) => {

            // Check if removed ItemView is a child, and remove it if so
            if (ObjectHelper.iFrameSafeInstanceOf(event.getView(), ComponentView)) {

                const removedComponentView: ComponentView = event.getView() as ComponentView;
                const childIndex = this.getComponentViewIndex(removedComponentView);
                if (childIndex > -1) {
                    this.componentViews.splice(childIndex, 1);
                }
            }
            this.notifyItemViewRemoved(event.getView());
        };
    }

    private addRegionContextMenuActions() {
        const actions: Action[] = [];

        actions.push(this.createSelectParentAction());
        actions.push(this.createInsertAction());

        this.addContextMenuActions(actions);
        this.handleResetContextMenuAction();
    }

    private handleResetContextMenuAction() {
        if (this.isEmpty()) {
            this.removeContextMenuAction(this.resetAction);
        } else {
            if (this.getContextMenuActions().indexOf(this.resetAction) === -1) {
                this.addContextMenuActions([this.resetAction]);
            }
        }
    }

    getRegionName(): string {
        return this.getPath()?.getPath().toString();
    }

    getPath(): ComponentPath {
        return new ComponentPath(this.name, this.getParentItemView()?.getPath());
    }

    getName(): string {
        return this.getRegionName() ? this.getRegionName().toString() : i18n('live.view.itemview.noname');
    }

    select(config?: ItemViewSelectedEventConfig) {
        if (config) {
            config.rightClicked = false;
        }

        super.select(config);
    }

    toString() {
        let extra = '';
        if (this.getPath()) {
            extra = ' : ' + this.getPath().toString();
        }
        return super.toString() + extra;
    }

    registerComponentView(componentView: ComponentView, index?: number) {
        if (this.componentViews.indexOf(componentView) === -1) { // do not register twice
            this.registerComponentViewInParent(componentView, index);
            this.registerComponentViewListeners(componentView);
        }
    }

    registerComponentViewInParent(componentView: ComponentView, index?: number): void {
        if (index >= 0) {
            this.componentViews.splice(index, 0, componentView);
        } else {
            this.componentViews.push(componentView);
        }
    }

    registerComponentViewListeners(componentView: ComponentView): void {
        componentView.setParentItemView(this);
        componentView.onItemViewAdded(this.itemViewAddedListener);
        componentView.onItemViewRemoved(this.itemViewRemovedListener);
    }

    unregisterComponentView(componentView: ComponentView) {
        const indexToRemove = this.getComponentViewIndex(componentView);
        if (indexToRemove >= 0) {

            componentView.unItemViewAdded(this.itemViewAddedListener);
            componentView.unItemViewRemoved(this.itemViewRemovedListener);

            this.componentViews.splice(indexToRemove, 1);
            componentView.setParentItemView(null);

            this.notifyItemViewRemoved(componentView);

        } else {

            throw new Error('Did not find ComponentView to remove: ' + componentView.getItemId().toString());
        }
    }

    getNewItemIndex(): number {
        return 0;
    }

    addComponentView(componentView: ComponentView, index: number, newlyCreated: boolean = false, _dragged?: boolean) {
        this.insertChild(componentView, index);
        this.registerComponentView(componentView, index);
        this.notifyItemViewAdded(componentView, newlyCreated);
        this.refreshEmptyState();
    }

    removeComponentView(componentView: ComponentView, silent: boolean = false) {
        this.unregisterComponentView(componentView);
        if (!silent) {
            this.removeChild(componentView);
        }

        this.refreshEmptyState();
    }

    private getComponentViews(): ComponentView[] {
        return this.componentViews;
    }

    getComponentViewIndex(view: ComponentView): number {
        return this.componentViews.indexOf(view);
    }

    getComponentViewByPath(path: ComponentPath): ItemView {
        let result: ItemView = null;

        this.componentViews.some((componentView: ComponentView) => {
            if (path.equals(componentView.getPath())) {
                result = componentView;
            } else if (componentView.isLayout()) {
                result = (componentView as LayoutComponentView).getComponentViewByPath(path);
            }

            return !!result;
        });

        return result;
    }

    hasOnlyMovingComponentViews(): boolean {
        return this.componentViews.length > 0 && this.componentViews.every((view: ComponentView) => {
            return view.isMoving();
        });
    }

    isEmpty(): boolean {
        const onlyMoving = this.hasOnlyMovingComponentViews();
        const empty = !this.componentViews?.length;

        return empty || onlyMoving;
    }

    empty() {
        while (this.componentViews.length > 0) {

            // remove component modifies the components array so we can't rely on forEach
            this.removeComponentView(this.componentViews[0]);
        }
    }

    getPageView(): PageView {
        return super.getPageView();
    }

    remove(): RegionView {
        super.remove();
        return this;
    }

    toItemViewArray(): ItemView[] {

        let array: ItemView[] = [];
        array.push(this);
        this.componentViews.forEach((componentView: ComponentView) => {
            const itemViews = componentView.toItemViewArray();
            array = array.concat(itemViews);
        });
        return array;
    }

    onItemViewAdded(listener: (event: ItemViewAddedEvent) => void) {
        this.itemViewAddedListeners.push(listener);
    }

    unItemViewAdded(listener: (event: ItemViewAddedEvent) => void) {
        this.itemViewAddedListeners = this.itemViewAddedListeners.filter((curr) => {
            return curr !== listener;
        });
    }

    notifyItemViewAdded(itemView: ItemView, newlyCreated: boolean = false) {
        const event = new ItemViewAddedEvent(itemView, newlyCreated);
        this.itemViewAddedListeners.forEach((listener) => {
            listener(event);
        });
    }

    onItemViewRemoved(listener: (event: ItemViewRemovedEvent) => void) {
        this.itemViewRemovedListeners.push(listener);
    }

    unItemViewRemoved(listener: (event: ItemViewRemovedEvent) => void) {
        this.itemViewRemovedListeners = this.itemViewRemovedListeners.filter((curr) => {
            return curr !== listener;
        });
    }

    getRegionView(): RegionView {
        return this;
    }

    private notifyItemViewRemoved(itemView: ItemView) {
        const event = new ItemViewRemovedEvent(itemView);
        this.itemViewRemovedListeners.forEach((listener) => {
            listener(event);
        });
    }

    private parseComponentViews() {
        this.componentViews.forEach((componentView) => {
            this.unregisterComponentView(componentView);
        });

        this.componentViews = [];

        this.doParseComponentViews();
    }

    private doParseComponentViews(parentElement?: Element) {
        const children = parentElement ? parentElement.getChildren() : this.getChildren();

        children.forEach((childElement: Element) => {
            const itemType = ItemType.fromElement(childElement);
            const isComponentView = ObjectHelper.iFrameSafeInstanceOf(childElement, ComponentView);
            let componentView;

            if (isComponentView) {
                //
            } else if (itemType) {
                assert(itemType.isComponentType(),
                    'Expected ItemView beneath a Region to be a Component: ' + itemType.getShortName());
                // components may be nested on different levels so use region wide var for count

                componentView = this.createView(
                    itemType,
                    new CreateItemViewConfig<RegionView>()
                        .setParentView(this)
                        .setElement(childElement)
                        .setLiveEditParams(this.liveEditParams)
                        .setPositionIndex(this.getComponentViews().length)
                        .setParentElement(parentElement ? parentElement : this));

                this.registerComponentViewListeners(componentView);

            } else {
                this.doParseComponentViews(childElement);
            }
        });
    }

}
