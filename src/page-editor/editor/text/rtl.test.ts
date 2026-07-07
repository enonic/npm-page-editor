import {isRtlLanguage} from './rtl';

describe('isRtlLanguage', () => {
    it('returns true for right-to-left language codes', () => {
        expect(isRtlLanguage('ar')).toBe(true);
        expect(isRtlLanguage('he')).toBe(true);
        expect(isRtlLanguage('fa')).toBe(true);
        expect(isRtlLanguage('ur')).toBe(true);
    });

    it('returns true for the legacy Java codes XP emits (Hebrew `iw`, Yiddish `ji`)', () => {
        expect(isRtlLanguage('iw')).toBe(true);
        expect(isRtlLanguage('ji')).toBe(true);
    });

    it('returns true for the additional explicitly supported RTL languages', () => {
        expect(isRtlLanguage('ckb')).toBe(true);
        expect(isRtlLanguage('ckb-IR')).toBe(true);
        expect(isRtlLanguage('ug')).toBe(true);
    });

    it('returns false for left-to-right language codes', () => {
        expect(isRtlLanguage('en')).toBe(false);
        expect(isRtlLanguage('nb')).toBe(false);
        expect(isRtlLanguage('es')).toBe(false);
    });

    it('ignores region and script subtags', () => {
        expect(isRtlLanguage('ar-SA')).toBe(true);
        expect(isRtlLanguage('ar_EG')).toBe(true);
        expect(isRtlLanguage('en-US')).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(isRtlLanguage('AR')).toBe(true);
        expect(isRtlLanguage('He')).toBe(true);
    });

    it('returns false for blank or missing values', () => {
        expect(isRtlLanguage(undefined)).toBe(false);
        expect(isRtlLanguage('')).toBe(false);
        expect(isRtlLanguage('   ')).toBe(false);
    });
});
