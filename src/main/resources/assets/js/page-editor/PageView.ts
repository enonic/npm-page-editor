import {ObjectHelper} from '@enonic/lib-admin-ui/ObjectHelper';
import {type Body} from '@enonic/lib-admin-ui/dom/Body';
import {DivEl} from '@enonic/lib-admin-ui/dom/DivEl';
import {type Element} from '@enonic/lib-admin-ui/dom/Element';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import type {LiveEditParams} from '@enonic/lib-contentstudio/page-editor/LiveEditParams';
import {PageItemType} from '@enonic/lib-contentstudio/page-editor/PageItemType';
import {PageViewContextMenuTitle} from '@enonic/lib-contentstudio/page-editor/PageViewContextMenuTitle';
import {PageViewController} from '@enonic/lib-contentstudio/page-editor/PageViewController';
import {RegionItemType} from '@enonic/lib-contentstudio/page-editor/RegionItemType';
import {SaveAsTemplateEvent} from '@enonic/lib-contentstudio/page-editor/SaveAsTemplateEvent';
import {ComponentInspectedEvent} from '@enonic/lib-contentstudio/page-editor/event/ComponentInspectedEvent';
import {type ItemViewAddedEvent} from '@enonic/lib-contentstudio/page-editor/event/ItemViewAddedEvent';
import {type ItemViewRemovedEvent} from '@enonic/lib-contentstudio/page-editor/event/ItemViewRemovedEvent';
import {PageLockedEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/PageLockedEvent';
import {PageResetEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/PageResetEvent';
import {PageUnlockedEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/PageUnlockedEvent';
import {
    type ItemViewSelectedEventConfig,
    SelectComponentEvent
} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {type ComponentView} from './ComponentView';
import {CreateItemViewConfig} from './CreateItemViewConfig';
import {ItemView, ItemViewBuilder} from './ItemView';
import type {ItemViewFactory} from './ItemViewFactory';
import {type ItemViewIdProducer} from './ItemViewIdProducer';
import {RegionView, RegionViewBuilder} from './RegionView';
import {LayoutComponentView} from './layout/LayoutComponentView';
import {TextItemType} from './text/TextItemType';

export class PageViewBuilder {

    itemViewIdProducer: ItemViewIdProducer;

    itemViewFactory: ItemViewFactory;

    liveEditParams: LiveEditParams;

    element: Body;

    setItemViewIdProducer(value: ItemViewIdProducer): PageViewBuilder {
        this.itemViewIdProducer = value;
        return this;
    }

    setItemViewFactory(value: ItemViewFactory): PageViewBuilder {
        this.itemViewFactory = value;
        return this;
    }

    setElement(value: Body): PageViewBuilder {
        this.element = value;
        return this;
    }

    setLiveEditParams(value: LiveEditParams): PageViewBuilder {
        this.liveEditParams = value;
        return this;
    }

    build(): PageView {
        return new PageView(this);
    }
}

export class PageView
    extends ItemView {

    private regionViews: RegionView[];

    private fragmentView: ComponentView;

    private viewsById: Record<number, ItemView>;

    private resetAction: Action;

    private itemViewAddedListener: (event: ItemViewAddedEvent) => void;

    private itemViewRemovedListener: (event: ItemViewRemovedEvent) => void;

    constructor(builder: PageViewBuilder) {
        super(new ItemViewBuilder()
            .setLiveEditParams(builder.liveEditParams)
            .setItemViewIdProducer(builder.itemViewIdProducer)
            .setItemViewFactory(builder.itemViewFactory)
            .setType(PageItemType.get())
            .setElement(builder.element)
            .setContextMenuTitle(new PageViewContextMenuTitle(builder.liveEditParams.displayName)));

        this.addPageContextMenuActions();

        this.regionViews = [];
        this.viewsById = {};

        this.addClassEx('page-view');

        this.initListeners();

        this.parseItemViews();

        if (builder.liveEditParams.locked ||
            (ObjectHelper.isDefined(builder.liveEditParams.modifyPermissions) && !builder.liveEditParams.modifyPermissions)) {
            this.setLocked(true);
        }
    }

    public setModifyPermissions(modifyPermissions: boolean): void {
        if (!modifyPermissions) {
            this.setLocked(true);
        }
    }

    private addPageContextMenuActions() {
        const actions: Action[] = [];

        actions.push(new Action(i18n('live.view.inspect')).onExecuted(() => {
            new ComponentInspectedEvent(this.getPath()).fire();
        }));

        this.resetAction = new Action(i18n('live.view.reset')).onExecuted(() => {
            new PageResetEvent().fire();
        });

        actions.push(this.resetAction);

        if (!this.getLiveEditParams().isResetEnabled) {
            this.resetAction.setEnabled(false);
        }

        if (!this.liveEditParams.isPageTemplate) {
            actions.push(new Action(i18n('action.saveAsTemplate')).onExecuted(() => {
                new SaveAsTemplateEvent().fire();
            }));
        }

        this.addContextMenuActions(actions);
    }

    private initListeners() {

        this.itemViewAddedListener = (event: ItemViewAddedEvent) => {
            // register the view and all its child views (i.e layout with regions)
            const itemView = event.getView();
            itemView.toItemViewArray().forEach((value: ItemView) => {
                this.registerItemView(value);
            });

            // adding anything except text should exit the text edit mode
            if (itemView.getType().equals(TextItemType.get())) {
                if (event.isNewlyCreated()) {
                    new SelectComponentEvent({path: itemView.getPath(), position: null, rightClicked: true}).fire();

                    itemView.giveFocus();
                } else {
                    //
                }
            } else {
                if (event.isNewlyCreated()) {
                    const config = {path: itemView.getPath(), position: null, newlyCreated: true} as ItemViewSelectedEventConfig;
                    itemView.select(config);
                }
            }
        };
        this.itemViewRemovedListener = (event: ItemViewRemovedEvent) => {
            // register the view and all its child views (i.e layout with regions)
            event.getView().toItemViewArray().forEach((itemView: ItemView) => {
                this.unregisterItemView(itemView);
            });
        };
    }

    getPath(): ComponentPath {
        return ComponentPath.root();
    }

    select(config?: ItemViewSelectedEventConfig) {
        if (config) {
            config.rightClicked = false;
        }

        super.select(config);
    }

    getLockedMenuActions(): Action[] {
        const unlockAction = new Action(i18n('action.page.settings'));

        unlockAction.onExecuted(() => {
            new ComponentInspectedEvent(ComponentPath.root()).fire()
        });

        return [unlockAction];
    }

    isLocked() {
        return this.hasClass('locked');
    }

    setLocked(locked: boolean): void {
        if (locked === this.isLocked()) {
            return;
        }

        this.toggleClass('locked', locked);

        if (locked) {
            new PageLockedEvent().fire();
        } else {
            new PageUnlockedEvent().fire();
            new ComponentInspectedEvent(this.getPath()).fire();
        }

        PageViewController.get().setLocked(locked);
    }

    getPageView(): PageView {
        return this;
    }

    isEmpty(): boolean {
        return this.getLiveEditParams().isPageEmpty;
    }

    getName(): string {
        return this.getLiveEditParams().pageName;
    }

    getIconClass(): string {
        return this.getLiveEditParams().pageIconClass;
    }

    getParentItemView(): ItemView {
        return null;
    }

    setParentItemView(_itemView: ItemView) {
        throw new Error(i18n('live.view.page.error.noparent'));
    }

    private registerRegionView(regionView: RegionView) {
        this.regionViews.push(regionView);

        regionView.onItemViewAdded(this.itemViewAddedListener);
        regionView.onItemViewRemoved(this.itemViewRemovedListener);
    }

    unregisterRegionView(regionView: RegionView) {
        const index = this.regionViews.indexOf(regionView);
        if (index > -1) {
            this.regionViews.splice(index, 1);

            regionView.unItemViewAdded(this.itemViewAddedListener);
            regionView.unItemViewRemoved(this.itemViewRemovedListener);
        }
    }

    getRegions(): RegionView[] {
        return this.regionViews;
    }

    toItemViewArray(): ItemView[] {

        let array: ItemView[] = [];
        array.push(this);
        this.regionViews.forEach((regionView: RegionView) => {
            const itemViews = regionView.toItemViewArray();
            array = array.concat(itemViews);
        });
        return array;
    }

    getSelectedView(): ItemView {
        for (const id in this.viewsById) {
            if (this.viewsById.hasOwnProperty(id) && this.viewsById[id].isSelected()) {
                return this.viewsById[id];
            }
        }
        return null;
    }

    getComponentViewByPath(path: ComponentPath): ItemView {
        if (this.fragmentView) {
            return this.getFragmentComponentViewByPath(path);
        }

        return this.getPageComponentViewByPath(path);
    }

    private getFragmentComponentViewByPath(path: ComponentPath): ItemView {
        if (path.isRoot()) {
            return this.fragmentView;
        }

        if (this.fragmentView instanceof LayoutComponentView) {
            return this.fragmentView.getComponentViewByPath(path);
        }

        return null;
    }

    private getPageComponentViewByPath(path: ComponentPath): ItemView {
        if (path.isRoot()) {
            return this;
        }

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

    private registerItemView(view: ItemView) {
        this.viewsById[view.getItemId().toNumber()] = view;
    }

    private unregisterItemView(view: ItemView) {
        delete this.viewsById[view.getItemId().toNumber()];
    }

    private parseItemViews() {
        // unregister existing views
        for (const itemView in this.viewsById) {
            if (this.viewsById.hasOwnProperty(itemView)) {
                this.unregisterItemView(this.viewsById[itemView]);
            }
        }

        // unregister existing regions
        this.regionViews.forEach((regionView: RegionView) => {
            this.unregisterRegionView(regionView);
        });

        this.regionViews = [];
        this.viewsById = {};

        if (this.getLiveEditParams().isFragment) {
            this.insertChild(new DivEl(), 0);
            this.doParseFragmentItemViews();
        } else {
            this.doParseItemViews();
            // register everything that was parsed
            this.toItemViewArray().forEach((value: ItemView) => {
                this.registerItemView(value);
            });
        }

    }

    private doParseItemViews(parentElement?: Element) {
        const children = parentElement ? parentElement.getChildren() : this.getChildren();

        children.forEach((childElement: Element) => {
            const itemType = ItemType.fromElement(childElement);
            let regionView;

            if (itemType && RegionItemType.get().equals(itemType)) {
                regionView =
                    new RegionView(new RegionViewBuilder()
                        .setParentView(this)
                        .setName(RegionItemType.getRegionName(childElement))
                        .setElement(childElement));

                this.registerRegionView(regionView);
            } else {
                this.doParseItemViews(childElement);
            }
        });
    }

    private doParseFragmentItemViews(parentElement?: Element) {
        const children = parentElement ? parentElement.getChildren() : this.getChildren();

        children.forEach((childElement: Element) => {
            const itemType = ItemType.fromElement(childElement);

            if (itemType?.isComponentType()) {
                const itemViewConfig = new CreateItemViewConfig<PageView>()
                    .setParentView(this)
                    .setElement(childElement)
                    .setLiveEditParams(this.liveEditParams)
                    .setParentElement(parentElement ? parentElement : this);

                const componentView: ComponentView = this.createView(itemType, itemViewConfig) as ComponentView;
                this.registerFragmentComponentView(componentView);
            } else {
                this.doParseFragmentItemViews(childElement);
            }
        });
    }

    unregisterFragmentComponentView(componentView: ComponentView) {
        componentView.unItemViewAdded(this.itemViewAddedListener);
        componentView.unItemViewRemoved(this.itemViewRemovedListener);

        componentView.toItemViewArray().forEach((itemView: ItemView) => {
            this.unregisterItemView(itemView);
        });
    }

    registerFragmentComponentView(componentView: ComponentView) {
        componentView.onItemViewAdded(this.itemViewAddedListener);
        componentView.onItemViewRemoved(this.itemViewRemovedListener);

        componentView.toItemViewArray().forEach((value: ItemView) => {
            this.registerItemView(value);
        });

        if (componentView instanceof LayoutComponentView) {
            componentView.getRegions().forEach((regionView) => {
                this.registerRegionView(regionView);
            });
        }

        this.fragmentView = componentView;
    }

    isRendered(): boolean {
        return true;
    }
}
