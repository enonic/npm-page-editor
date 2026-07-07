import {setHostContext} from '../stores/host';
import {convertRenderSrcToPreviewSrc, resolvePreviewHtml} from './preview-src';

// Expected URLs use the iframe defaults (admin prefix `/admin`, rest path
// `rest-v2/cs`, no domain):
// `/admin/rest-v2/cs/cms/<project>/content/content/image/<id>?…`.
const FIXED_TIME = 1_700_000_000_000;
const PROJECT = 'myproject';

describe('convertRenderSrcToPreviewSrc', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
        setHostContext({project: {name: PROJECT}});
    });

    afterEach(() => {
        vi.useRealTimers();
        setHostContext({});
    });

    it('returns an empty string for empty input', () => {
        expect(convertRenderSrcToPreviewSrc('')).toBe('');
    });

    it('rewrites an `image://` src to its sized, scale-width preview URL', () => {
        const input = '<p><img src="image://img-123"></p>';

        const expectedSrc = `/admin/rest-v2/cs/cms/${PROJECT}/content/content/image/img-123?ts=${FIXED_TIME}&size=768&scaleWidth=true`;

        expect(convertRenderSrcToPreviewSrc(input, PROJECT)).toBe(
            `<p><img src="${expectedSrc}" data-src="image://img-123"></p>`,
        );
    });

    it('prefixes preview URLs with the host domain when the host provides one', () => {
        setHostContext({project: {name: PROJECT}, hostDomain: 'https://admin.example.com'});

        const input = '<img src="image://img-123">';
        const expectedSrc = `https://admin.example.com/admin/rest-v2/cs/cms/${PROJECT}/content/content/image/img-123?ts=${FIXED_TIME}&size=768&scaleWidth=true`;

        expect(convertRenderSrcToPreviewSrc(input, PROJECT)).toBe(
            `<img src="${expectedSrc}" data-src="image://img-123">`,
        );
    });

    it('rewrites a `media://` (original) src with `source=true` and no size/scaleWidth', () => {
        const input = '<img src="media://orig-9">';

        const expectedSrc = `/admin/rest-v2/cs/cms/${PROJECT}/content/content/image/orig-9?ts=${FIXED_TIME}&source=true`;

        expect(convertRenderSrcToPreviewSrc(input, PROJECT)).toBe(
            `<img src="${expectedSrc}" data-src="media://orig-9">`,
        );
    });

    it('strips the `?style=` query off the image id and carries over a `scale` param', () => {
        const input = '<img src="image://img-7?style=square&amp;scale=1:1">';

        const expectedSrc =
            `/admin/rest-v2/cs/cms/${PROJECT}/content/content/image/img-7` +
            `?ts=${FIXED_TIME}&size=768&scaleWidth=true&scale=1:1`;

        expect(convertRenderSrcToPreviewSrc(input, PROJECT)).toBe(
            `<img src="${expectedSrc}" data-src="image://img-7?style=square&amp;scale=1:1">`,
        );
    });

    it('leaves non-render image sources untouched', () => {
        const input = '<img src="https://cdn.example.com/a.png">';

        expect(convertRenderSrcToPreviewSrc(input, PROJECT)).toBe(input);
    });

    it('rewrites every render image in the value', () => {
        const input = '<img src="image://a"><img src="media://b">';

        const result = convertRenderSrcToPreviewSrc(input, PROJECT);

        expect(result).toContain(`/content/image/a?ts=${FIXED_TIME}&size=768&scaleWidth=true`);
        expect(result).toContain(`/content/image/b?ts=${FIXED_TIME}&source=true`);
        expect(result).toContain('data-src="image://a"');
        expect(result).toContain('data-src="media://b"');
    });

    it('falls back to the host-context project when none is passed', () => {
        const result = convertRenderSrcToPreviewSrc('<img src="image://x">');

        expect(result).toContain(`/cms/${PROJECT}/content/content/image/x?`);
    });
});

describe('resolvePreviewHtml', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
        setHostContext({project: {name: PROJECT}});
    });

    afterEach(() => {
        vi.useRealTimers();
        setHostContext({});
    });

    it('returns an empty string for blank text', () => {
        expect(resolvePreviewHtml(undefined)).toBe('');
        expect(resolvePreviewHtml('   ')).toBe('');
    });

    it('rewrites image render URLs in the resolved HTML', () => {
        const result = resolvePreviewHtml('<img src="image://x">');

        expect(result).toContain(`/cms/${PROJECT}/content/content/image/x?ts=${FIXED_TIME}&size=768&scaleWidth=true`);
    });
});
