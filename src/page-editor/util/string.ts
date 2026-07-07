export function isBlank(value: string | null | undefined): boolean {
    return value == null || value.trim().length === 0;
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function substringBetween(str: string, left: string, right: string): string {
    if (!str || !left || !right) {
        return '';
    }

    const start = str.indexOf(left);
    if (start === -1) {
        return '';
    }

    const end = str.indexOf(right, start + left.length);
    return end !== -1 ? str.substring(start + left.length, end) : str.slice(start + left.length);
}

// Decodes HTML entities and strips tags by writing innerHTML on a detached div
// and reading back its textContent.
export function htmlToString(html: string): string {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.textContent ?? '';
}
