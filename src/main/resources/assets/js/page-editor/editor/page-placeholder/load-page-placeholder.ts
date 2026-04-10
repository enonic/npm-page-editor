import {ContentId} from '@enonic/lib-contentstudio/app/content/ContentId';
import {type Descriptor} from '@enonic/lib-contentstudio/app/page/Descriptor';
import {PageComponentType} from '@enonic/lib-contentstudio/app/page/region/PageComponentType';
import {GetContentTypeByNameRequest} from '@enonic/lib-contentstudio/app/resource/GetContentTypeByNameRequest';
import {GetComponentDescriptorsRequest} from '@enonic/lib-contentstudio/app/resource/GetComponentDescriptorsRequest';
import {ContentTypeName} from '@enonic/lib-admin-ui/schema/content/ContentTypeName';

export interface ControllerOption {
    key: string;
    displayName: string;
    description: string;
}

export interface PlaceholderState {
    loading: boolean;
    error: string | undefined;
    contentTypeDisplayName: string | undefined;
    options: ControllerOption[];
}

function toPromise<T>(value: PromiseLike<T>): Promise<T> {
    return Promise.resolve(value);
}

function sortOptions(options: ControllerOption[]): ControllerOption[] {
    return [...options].sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function loadPagePlaceholderState(
    contentId: string | undefined,
    contentType: string | undefined,
    isPageTemplate: boolean,
): Promise<PlaceholderState> {
    const request = new GetComponentDescriptorsRequest();
    request.setComponentType(PageComponentType.get());

    if (contentId) {
        request.setContentId(new ContentId(contentId));
    }

    const descriptors = await toPromise(request.sendAndParse() as PromiseLike<Descriptor[]>);
    const options = sortOptions(descriptors.map((descriptor) => ({
        key: descriptor.getKey().toString(),
        displayName: descriptor.getDisplayName()?.toString() || descriptor.getName()?.toString() || descriptor.getKey().toString(),
        description: descriptor.getDescription()?.toString() || 'No description available for this controller.',
    })));

    let contentTypeDisplayName: string | undefined;
    if (!isPageTemplate && contentType && options.length > 0) {
        const name = new ContentTypeName(contentType);

        try {
            const contentTypeDetails = await toPromise(
                new GetContentTypeByNameRequest(name).sendAndParse() as PromiseLike<{getTitle(): string}>,
            );
            contentTypeDisplayName = contentTypeDetails.getTitle();
        } catch {
            contentTypeDisplayName = name.toString();
        }
    }

    return {
        loading: false,
        error: undefined,
        contentTypeDisplayName,
        options,
    };
}
