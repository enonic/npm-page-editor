import {
    decodeUrlParams,
    isDownloadLink,
    isNavigatingOutsideOfXP,
    isNavigatingWithinSamePage,
    relativePath,
    trimAnchor,
    trimUrlParams,
    trimWindowProtocolAndPortFromHref,
} from './uri';

function fakeWindow(
    href: string,
    protocol = 'https:',
    host = 'example.com',
): {location: {protocol: string; host: string; href: string}} {
    return {location: {protocol, host, href}};
}

describe('relativePath', () => {
    it('returns an empty string for blank input', () => {
        expect(relativePath('')).toBe('');
        expect(relativePath('   ')).toBe('');
    });

    it('strips a single leading slash', () => {
        expect(relativePath('/foo/bar')).toBe('foo/bar');
        expect(relativePath('foo/bar')).toBe('foo/bar');
    });
});

describe('isNavigatingOutsideOfXP', () => {
    const win = fakeWindow('https://example.com/page');

    it('returns false for root-relative links', () => {
        expect(isNavigatingOutsideOfXP('/foo', win)).toBe(false);
    });

    it('returns false for absolute links to the same host', () => {
        expect(isNavigatingOutsideOfXP('https://example.com/foo', win)).toBe(false);
    });

    it('returns true for absolute links to a different host', () => {
        expect(isNavigatingOutsideOfXP('https://other.com/foo', win)).toBe(true);
    });
});

describe('trimWindowProtocolAndPortFromHref', () => {
    it('strips the protocol, host and leading slash', () => {
        const win = fakeWindow('https://example.com/page');
        expect(trimWindowProtocolAndPortFromHref('https://example.com/some/path', win)).toBe('some/path');
    });

    it('leaves a foreign host untouched apart from the relative-path rule', () => {
        const win = fakeWindow('https://example.com/page');
        expect(trimWindowProtocolAndPortFromHref('https://other.com/x', win)).toBe('https://other.com/x');
    });
});

describe('trimAnchor', () => {
    it('removes the anchor and returns a relative path', () => {
        expect(trimAnchor('/foo/bar#section')).toBe('foo/bar');
        expect(trimAnchor('foo/bar#section')).toBe('foo/bar');
    });

    it('returns the relative path when there is no anchor', () => {
        expect(trimAnchor('/foo/bar')).toBe('foo/bar');
    });
});

describe('trimUrlParams', () => {
    it('removes the query string', () => {
        expect(trimUrlParams('foo/bar?x=1&y=2')).toBe('foo/bar');
    });

    it('returns the input unchanged when there is no query string', () => {
        expect(trimUrlParams('foo/bar')).toBe('foo/bar');
    });
});

describe('isNavigatingWithinSamePage', () => {
    const win = fakeWindow('https://example.com/foo/bar#section');

    it('returns true when the url matches the current page path', () => {
        expect(isNavigatingWithinSamePage('foo/bar', win)).toBe(true);
    });

    it('returns true for the slash-prefixed path shape the click listener produces', () => {
        expect(isNavigatingWithinSamePage('/foo/bar', win)).toBe(true);
    });

    it('ignores query strings on either side', () => {
        expect(isNavigatingWithinSamePage('/foo/bar?tab=2', win)).toBe(true);
        expect(isNavigatingWithinSamePage('/foo/bar', fakeWindow('https://example.com/foo/bar?mode=preview'))).toBe(
            true,
        );
    });

    it('returns false when the url points elsewhere', () => {
        expect(isNavigatingWithinSamePage('foo/other', win)).toBe(false);
        expect(isNavigatingWithinSamePage('/foo/other', win)).toBe(false);
    });
});

describe('isDownloadLink', () => {
    it('detects attachment download urls', () => {
        expect(isDownloadLink('/admin/attachment/download/123')).toBe(true);
    });

    it('returns false for non-download urls', () => {
        expect(isDownloadLink('/foo/bar')).toBe(false);
    });
});

describe('decodeUrlParams', () => {
    it('returns an empty object for blank input', () => {
        expect(decodeUrlParams('')).toEqual({});
        expect(decodeUrlParams('   ')).toEqual({});
    });

    it('keeps the first param of a bare query string', () => {
        expect(decodeUrlParams('a=1&b=2')).toEqual({a: '1', b: '2'});
    });

    it('preserves "=" inside a value', () => {
        expect(decodeUrlParams('x?token=a=b')).toEqual({token: 'a=b'});
    });

    it('parses the existing image:// caller input shape', () => {
        expect(decodeUrlParams('image://abc123?scale=1.5x2.0&filter=sepia')).toEqual({
            scale: '1.5x2.0',
            filter: 'sepia',
        });
    });

    it('keeps scale when it is the first query param', () => {
        expect(decodeUrlParams('image://abc123?scale=2.0')).toEqual({scale: '2.0'});
    });

    it('represents a flag with no "=" as undefined', () => {
        expect(decodeUrlParams('path?foo')).toEqual({foo: undefined});
    });

    it('decodes percent-encoded values', () => {
        expect(decodeUrlParams('p?q=a%20b')).toEqual({q: 'a b'});
    });

    it('returns an empty object for an empty query', () => {
        expect(decodeUrlParams('path?')).toEqual({});
    });

    it('ignores a trailing ampersand', () => {
        expect(decodeUrlParams('p?a=1&')).toEqual({a: '1'});
    });
});
