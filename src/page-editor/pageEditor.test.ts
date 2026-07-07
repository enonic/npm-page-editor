import type {EditorToHostType} from './protocol';

import {destroyTransport, getBus} from './editor/transport/bus';
import {init} from './pageEditor';

type PostCall = {type: EditorToHostType; path?: string};

let posted: PostCall[];

// `init` throws on re-init and registers the window click listener once, so the
// editor is bootstrapped a single time for the whole file.
init({editMode: false});
vi.spyOn(getBus()!, 'post').mockImplementation((type, payload) => {
    const path = payload != null && 'path' in payload ? payload.path : undefined;
    posted.push({type, path});
});

const previewPathCalls = (): PostCall[] => posted.filter(call => call.type === 'preview-path-changed');

function clickInsideAnchor(inner: string): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/news/article');
    anchor.innerHTML = inner;
    document.body.appendChild(anchor);
    return anchor;
}

describe('getClickedLink (window click listener)', () => {
    beforeEach(() => {
        posted = [];
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    afterAll(() => {
        destroyTransport();
    });

    it('posts preview-path-changed when an inline <svg> inside an <a> is clicked', () => {
        const anchor = clickInsideAnchor('<svg viewBox="0 0 1 1"><path d="M0 0h1v1H0z"></path></svg>');
        const svgPath = anchor.querySelector('path');

        svgPath?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

        expect(previewPathCalls()).toHaveLength(1);
        expect(previewPathCalls()[0]?.path).toBe('/news/article');
    });

    it('still posts when a plain HTML element inside an <a> is clicked', () => {
        const anchor = clickInsideAnchor('<span>Read more</span>');
        const span = anchor.querySelector('span');

        span?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

        expect(previewPathCalls()).toHaveLength(1);
        expect(previewPathCalls()[0]?.path).toBe('/news/article');
    });

    it('does not post when the click lands outside any anchor', () => {
        const div = document.createElement('div');
        document.body.appendChild(div);

        div.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

        expect(previewPathCalls()).toHaveLength(0);
    });
});
