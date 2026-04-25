import {ComponentView, type ComponentViewBuilder} from './ComponentView';
import {DescriptorBasedComponent} from '@enonic/lib-contentstudio/app/page/region/DescriptorBasedComponent';
import {PageState} from '@enonic/lib-contentstudio/app/wizard/page/PageState';

export abstract class DescriptorBasedComponentView
    extends ComponentView {

    private static HAS_DESCRIPTOR_CLASS = 'has-descriptor';

    protected inspectActionRequired: boolean;

    protected constructor(builder: ComponentViewBuilder) {
        super(builder);

        this.inspectActionRequired = builder.inspectActionRequired;
    }

    refreshEmptyState(): this {
        super.refreshEmptyState();

        const component = this.getComponent();
        const hasDescriptor = !!component?.hasDescriptor();
        this.toggleClass(DescriptorBasedComponentView.HAS_DESCRIPTOR_CLASS, hasDescriptor);

        return this;
    }

    protected getComponent(): DescriptorBasedComponent {
        const component = PageState.getComponentByPath(this.getPath());

        if (!component || !(component instanceof DescriptorBasedComponent)) {
            return null;
        }

        return component;
    }

    hasDescriptor(): boolean {
        return this.hasClass(DescriptorBasedComponentView.HAS_DESCRIPTOR_CLASS);
    }
}
