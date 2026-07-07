import {capitalize, htmlToString, isBlank, substringBetween} from './string';

describe('isBlank', () => {
    it('returns true for null and undefined', () => {
        expect(isBlank(null)).toBe(true);
        expect(isBlank(undefined)).toBe(true);
    });

    it('returns true for empty and whitespace-only strings', () => {
        expect(isBlank('')).toBe(true);
        expect(isBlank('   ')).toBe(true);
        expect(isBlank('\t\n ')).toBe(true);
    });

    it('returns false for non-blank strings', () => {
        expect(isBlank('a')).toBe(false);
        expect(isBlank(' a ')).toBe(false);
        expect(isBlank('0')).toBe(false);
    });
});

describe('capitalize', () => {
    it('uppercases the first character and lowercases the rest', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('HELLO')).toBe('Hello');
        expect(capitalize('hELLO')).toBe('Hello');
    });

    it('leaves single-word component types unchanged in casing', () => {
        expect(capitalize('part')).toBe('Part');
        expect(capitalize('layout')).toBe('Layout');
        expect(capitalize('fragment')).toBe('Fragment');
    });

    it('handles single-character and empty strings', () => {
        expect(capitalize('a')).toBe('A');
        expect(capitalize('A')).toBe('A');
        expect(capitalize('')).toBe('');
    });

    it('only affects letter casing, preserving spaces', () => {
        expect(capitalize('hello world')).toBe('Hello world');
        expect(capitalize('HELLO WORLD')).toBe('Hello world');
        expect(capitalize(' hello')).toBe(' hello');
    });
});

describe('substringBetween', () => {
    it('returns the text between the two delimiters', () => {
        expect(substringBetween('a[b]c', '[', ']')).toBe('b');
        expect(substringBetween('/image/123?v=1', 'image/', '?')).toBe('123');
    });

    it('returns the remainder when the right delimiter is missing', () => {
        expect(substringBetween('image/123', 'image/', '?')).toBe('123');
    });

    it('returns an empty string when the left delimiter is absent', () => {
        expect(substringBetween('abc', 'x', 'c')).toBe('');
    });

    it('returns an empty string when any argument is empty', () => {
        expect(substringBetween('', '[', ']')).toBe('');
        expect(substringBetween('a[b]c', '', ']')).toBe('');
        expect(substringBetween('a[b]c', '[', '')).toBe('');
    });
});

describe('htmlToString', () => {
    it('strips tags and returns text content', () => {
        expect(htmlToString('<b>bold</b> text')).toBe('bold text');
        expect(htmlToString('<p>one</p><p>two</p>')).toBe('onetwo');
    });

    it('decodes HTML entities', () => {
        expect(htmlToString('a &amp; b')).toBe('a & b');
        expect(htmlToString('&lt;tag&gt;')).toBe('<tag>');
    });

    it('passes through plain text and handles empty input', () => {
        expect(htmlToString('plain')).toBe('plain');
        expect(htmlToString('')).toBe('');
    });
});
