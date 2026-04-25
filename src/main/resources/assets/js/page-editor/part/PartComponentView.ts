import {ComponentViewBuilder} from '../ComponentView';
import {PartItemType} from './PartItemType';
import {DescriptorBasedComponentView} from '../DescriptorBasedComponentView';

export class PartComponentViewBuilder
    extends ComponentViewBuilder {

    constructor() {
        super();
        this.setType(PartItemType.get());
    }
}

export class PartComponentView
    extends DescriptorBasedComponentView {

    constructor(builder: PartComponentViewBuilder) {
        super(builder.setInspectActionRequired(true));

        this.resetHrefForRootLink(builder);
        this.disableLinks();
    }

    private resetHrefForRootLink(builder: PartComponentViewBuilder) {
        if (builder.element && builder.element.getEl().hasAttribute('href')) {
            builder.element.getEl().setAttribute('href', '#');
        }
    }
}
