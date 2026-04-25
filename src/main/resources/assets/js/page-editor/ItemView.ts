import {Element, type ElementBuilder, ElementFromElementBuilder, NewElementBuilder} from '@enonic/lib-admin-ui/dom/Element';
import type {IDentifiable} from '@enonic/lib-admin-ui/IDentifiable';
import {StyleHelper} from '@enonic/lib-admin-ui/StyleHelper';
import {Action} from '@enonic/lib-admin-ui/ui/Action';
import {LoadMask} from '@enonic/lib-admin-ui/ui/mask/LoadMask';
import {assertNotNull} from '@enonic/lib-admin-ui/util/Assert';
import {i18n} from '@enonic/lib-admin-ui/util/Messages';

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {AddComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/AddComponentEvent';
import {DeselectComponentEvent} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent';
import {
    type ItemViewSelectedEventConfig,
    SelectComponentEvent
} from '@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent';
import {ItemType} from '@enonic/lib-contentstudio/page-editor/ItemType';
import {type ItemViewContextMenuTitle} from '@enonic/lib-contentstudio/page-editor/ItemViewContextMenuTitle';
import {ItemViewIconClassResolver} from '@enonic/lib-contentstudio/page-editor/ItemViewIconClassResolver';
import type {LiveEditParams} from '@enonic/lib-contentstudio/page-editor/LiveEditParams';
import {PageItemType} from '@enonic/lib-contentstudio/page-editor/PageItemType';
import {RegionItemType} from '@enonic/lib-contentstudio/page-editor/RegionItemType';
import {CreateItemViewConfig} from './CreateItemViewConfig';
import {FragmentItemType} from './fragment/FragmentItemType';
import type {ItemViewFactory} from './ItemViewFactory';
import {ItemViewId} from './ItemViewId';
import {type ItemViewIdProducer} from './ItemViewIdProducer';
import {LayoutItemType} from './layout/LayoutItemType';
import type {PageView} from './PageView';
import {PartItemType} from './part/PartItemType';
import {TextItemType} from './text/TextItemType';

export class ItemViewBuilder {

    itemViewIdProducer: ItemViewIdProducer;

    liveEditParams: LiveEditParams;

    itemViewFactory: ItemViewFactory;

    type: ItemType;

    element: Element;

    parentElement: Element;

    parentView: ItemView;

    contextMenuActions: Action[];

    contextMenuTitle: ItemViewContextMenuTitle;

    setItemViewIdProducer(value: ItemViewIdProducer): this {
        this.itemViewIdProducer = value;
        return this;
    }

    setItemViewFactory(value: ItemViewFactory): this {
        this.itemViewFactory = value;
        return this;
    }

    setType(value: ItemType): this {
        this.type = value;
        return this;
    }

    setElement(value: Element): this {
        this.element = value;
        return this;
    }

    setParentView(value: ItemView): this {
        this.parentView = value;
        return this;
    }

    setParentElement(value: Element): this {
        this.parentElement = value;
        return this;
    }

    setContextMenuActions(actions: Action[]): this {
        this.contextMenuActions = actions;
        return this;
    }

    setContextMenuTitle(title: ItemViewContextMenuTitle): this {
        this.contextMenuTitle = title;
        return this;
    }

    setLiveEditParams(value: LiveEditParams): this {
        this.liveEditParams = value;
        return this;
    }
}

export abstract class ItemView
    extends Element
    implements IDentifiable {

    protected liveEditParams: LiveEditParams;

    private itemViewIdProducer: ItemViewIdProducer;

    private itemViewFactory: ItemViewFactory;

    private type: ItemType;

    private parentItemView: ItemView;

    private loadMask: LoadMask;

    private contextMenuTitle: ItemViewContextMenuTitle;

    private contextMenuActions: Action[];

    public static LIVE_EDIT_SELECTED = 'live-edit-selected';

    protected constructor(builder: ItemViewBuilder) {
        assertNotNull(builder.type, 'type cannot be null');

        let props: ElementBuilder = null;
        if (builder.element) {
            const elementFromElementBuilder = new ElementFromElementBuilder();
            elementFromElementBuilder.setElement(builder.element);
            elementFromElementBuilder.setParentElement(builder.parentElement);
            elementFromElementBuilder.setGenerateId(false);
            props = elementFromElementBuilder;
        } else {
            const newElementBuilder = new NewElementBuilder();
            newElementBuilder.setTagName('div');
            newElementBuilder.setParentElement(builder.parentElement);
            newElementBuilder.setGenerateId(false);
            props = newElementBuilder;
        }

        super(props);

        this.type = builder.type;
        this.liveEditParams = builder.liveEditParams;
        this.parentItemView = builder.parentView;
        this.itemViewIdProducer = builder.itemViewIdProducer;
        this.itemViewFactory = builder.itemViewFactory;
        this.contextMenuTitle = builder.contextMenuTitle;

        this.addClassEx('item-view');

        this.contextMenuActions = [];

        this.setDraggable(true);

        this.setItemId(builder.itemViewIdProducer.next());

        if (!builder.element) {
            this.getEl().setData(ItemType.ATTRIBUTE_TYPE, builder.type.getShortName());
        }
    }

    protected addContextMenuActions(actions: Action[]) {
        this.contextMenuActions = this.contextMenuActions.concat(actions);
    }

    protected removeContextMenuAction(action: Action) {
        if (this.contextMenuActions.indexOf(action) === -1) {
            return;
        }
        this.contextMenuActions.splice(this.contextMenuActions.indexOf(action), 1);
    }

    protected disableLinks() {
        $(this.getHTMLElement()).find('a').on('click', e => e.preventDefault());
    }

    remove(): ItemView {
        if (this.loadMask) {
            this.loadMask.remove();
        }

        super.remove();
        return this;
    }

    setDraggable(value: boolean) {
        // do not call super.setDraggable
        // tells jquery drag n drop to ignore this draggable
        this.toggleClass('not-draggable', !value);
    }

    scrollComponentIntoView(): void {
        this.getEl().getHTMLElement().scrollIntoView({behavior: 'smooth'});
    }

    isEmpty(): boolean {
        throw new Error('Must be implemented by inheritors');
    }

    refreshEmptyState(): ItemView {
        this.toggleClass('empty', this.isEmpty());

        return this;
    }

    abstract getPath(): ComponentPath;

    getItemViewIdProducer(): ItemViewIdProducer {
        return this.itemViewIdProducer;
    }

    getItemViewFactory(): ItemViewFactory {
        return this.itemViewFactory;
    }

    getLiveEditParams(): LiveEditParams {
        return this.liveEditParams;
    }

    hideContextMenu() {
        // No-op on the base; PageView overrides to hide its locked context menu.
    }

    private setItemId(value: ItemViewId) {
        this.getEl().setAttribute('data-' + ItemViewId.DATA_ATTRIBUTE, value.toString());
    }

    getItemId(): ItemViewId {
        const asString = this.getEl().getAttribute('data-' + ItemViewId.DATA_ATTRIBUTE);
        if (!asString) {
            return null;
        }
        return ItemViewId.fromString(asString);
    }

    getType(): ItemType {
        return this.type;
    }

    getParentItemView(): ItemView {
        return this.parentItemView;
    }

    setParentItemView(itemView: ItemView) {
        this.parentItemView = itemView;
    }

    isSelected(): boolean {
        return this.getEl().hasAttribute('data-live-edit-selected');
    }

    select(config?: ItemViewSelectedEventConfig, silent?: boolean) {
        this.selectItem();

        if (!silent && config) {
            new SelectComponentEvent(config).fire();
        }
    }

    selectWithoutMenu(silent?: boolean) {
        this.selectItem();

        if (!silent) {
            new SelectComponentEvent({path: this.getPath(), position: null}).fire();
        }
    }

    private selectItem() {
        const selectedView = this.getPageView()?.getSelectedView();

        if (selectedView === this) {
            // view is already selected
            return;
        } else if (selectedView) {
            // deselect selected item view if any
            selectedView.deselect(true);
        }

        this.getEl().setData(ItemView.LIVE_EDIT_SELECTED, 'true');
    }

    deselect(silent?: boolean) {
        this.getEl().removeAttribute('data-live-edit-selected');

        this.hideContextMenu();

        if (!silent) {
            new DeselectComponentEvent(this.getPath()).fire();
        }
    }

    getName(): string {
        return i18n('live.view.itemview.noname');
    }

    getIconClass() {
        return ItemViewIconClassResolver.resolveByView(this);
    }

    showLoadingSpinner() {
        if (!this.loadMask) {
            this.loadMask = new LoadMask(this);
            this.appendChild(this.loadMask);
        }
        this.loadMask.show();
    }

    hideLoadingSpinner() {
        if (this.loadMask) {
            this.loadMask.hide();
        }
    }

    getContextMenuActions(): Action[] {
        return this.contextMenuActions;
    }

    toItemViewArray(): ItemView[] {

        return [this];
    }

    toString(): string {
        return this.getItemId().toNumber() + ' : ' + this.getType().getShortName();
    }

    protected getContextMenuTitle(): ItemViewContextMenuTitle {
        return this.contextMenuTitle;
    }

    addComponentView(_componentView: ItemView, _index?: number, _newlyCreated: boolean = false) {
        throw new Error('Must be implemented by inheritors');
    }

    getNewItemIndex(): number {
        throw new Error('Must be implemented by inheritors');
    }

    public createView(type: ItemType, config?: CreateItemViewConfig<ItemView>): ItemView {
        if (!config) {
            const regionView = this.getRegionView();
            config = new CreateItemViewConfig<ItemView>()
                .setParentView(regionView)
                .setParentElement(regionView)
                .setLiveEditParams(regionView.getLiveEditParams());
        }
        return this.itemViewFactory.createView(type, config);
    }

    private getInsertActions(): Action[] {
        const isFragmentContent = this.liveEditParams.isFragment;

        const actions = [this.createInsertSubAction('part', PartItemType.get())];

        const isInRegion = this.getRegionView().getType().equals(RegionItemType.get());
        if (isInRegion && !this.getRegionView().hasParentLayoutComponentView() && !isFragmentContent) {
            actions.push(this.createInsertSubAction('layout', LayoutItemType.get()));
        }
        actions.push(this.createInsertSubAction('text', TextItemType.get()));
        actions.push(this.createInsertSubAction('fragment', FragmentItemType.get()));

        return actions;
    }

    hasParentLayoutComponentView(): boolean {
        const parentView = this.getParentItemView();
        return !!parentView && parentView.getType().equals(LayoutItemType.get());
    }

    protected getRegionView(): ItemView {
        return this.getParentItemView();
    }

    isLayout(): boolean {
        return LayoutItemType.get().equals(this.getType());
    }

    isText(): boolean {
        return TextItemType.get().equals(this.getType());
    }

    getPageView(): PageView {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let itemView: ItemView = this;
        while (!PageItemType.get().equals(itemView.getType())) {
            itemView = itemView.getParentItemView();
        }
        return itemView as PageView;
    }

    protected createInsertAction(): Action {
        return new Action(i18n('widget.components.insert')).setChildActions(this.getInsertActions()).setVisible(false);
    }

    protected createSelectParentAction(): Action {
        const action = new Action(i18n('live.view.selectparent'));

        action.setSortOrder(0);
        action.onExecuted(() => {
            const parentView: ItemView = this.getParentItemView();
            if (parentView) {
                this.selectItemView(parentView);
            }
        });

        return action;
    }

    private selectItemView(itemView: ItemView) {
        this.deselect();
        const config = {path: itemView.getPath(), position: null, newlyCreated: false, rightClicked: true} as ItemViewSelectedEventConfig;
        itemView.select(config);
        itemView.scrollComponentIntoView();
    }

    private createInsertSubAction(label: string, componentItemType: ItemType): Action {
        const action = new Action(i18n('field.' + label)).onExecuted(() => {
            new AddComponentEvent(this.makeInsertPathForNewItem(), componentItemType.toComponentType()).fire();
        });

        action.setVisible(false).setIconClass(StyleHelper.getCommonIconCls(label));

        return action;
    }

    private makeInsertPathForNewItem(): ComponentPath {
        if (this.getType() instanceof RegionItemType) {
            return new ComponentPath(this.getNewItemIndex(), this.getPath());
        }

        return new ComponentPath(this.getNewItemIndex(), this.getPath().getParentPath());
    }

}
