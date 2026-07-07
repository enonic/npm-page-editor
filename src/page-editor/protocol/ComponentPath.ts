/**
 * Standalone component path implementation.
 *
 * Identifies a region or component inside the page by alternating
 * region-name and component-index segments. The canonical string format is
 * identical to the one used by Content Studio:
 *
 * - `/` — the page itself (or the root component in fragment mode)
 * - `/main` — region "main"
 * - `/main/0` — first component of region "main"
 * - `/main/0/left/1` — second component of region "left" inside a layout
 */

const DIVIDER = '/';

export type ComponentPathSegment = string | number;

function parseSegment(raw: string, index: number): ComponentPathSegment {
    const isComponentIndex = index % 2 === 1;
    if (!isComponentIndex) return raw;

    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : raw;
}

export class ComponentPath {
    static DIVIDER: string = DIVIDER;

    private readonly segments: readonly ComponentPathSegment[];

    private constructor(segments: readonly ComponentPathSegment[]) {
        this.segments = segments;
    }

    static root(): ComponentPath {
        return new ComponentPath([]);
    }

    static fromString(path: string | undefined): ComponentPath {
        if (path == null || path.trim().length === 0 || path === DIVIDER) {
            return ComponentPath.root();
        }

        const segments = path
            .split(DIVIDER)
            .filter(part => part.length > 0)
            .map(parseSegment);

        return new ComponentPath(segments);
    }

    /** Leaf segment: region name or component index. The root path returns `/`. */
    getPath(): ComponentPathSegment {
        if (this.isRoot()) return DIVIDER;

        return this.segments[this.segments.length - 1];
    }

    getParentPath(): ComponentPath | undefined {
        if (this.isRoot()) return undefined;

        return new ComponentPath(this.segments.slice(0, -1));
    }

    getSegments(): readonly ComponentPathSegment[] {
        return this.segments;
    }

    isRoot(): boolean {
        return this.segments.length === 0;
    }

    /** Component paths have an even number of segments ending in an index. */
    isComponentPath(): boolean {
        return this.isRoot() || this.segments.length % 2 === 0;
    }

    isRegionPath(): boolean {
        return !this.isRoot() && this.segments.length % 2 === 1;
    }

    /** Index of the component within its region, when the leaf is an index. */
    getComponentIndex(): number | undefined {
        const leaf = this.segments[this.segments.length - 1];
        return typeof leaf === 'number' ? leaf : undefined;
    }

    isDescendantOf(other: ComponentPath): boolean {
        if (other.segments.length >= this.segments.length) return false;

        return other.segments.every((segment, index) => String(this.segments[index]) === String(segment));
    }

    equals(other: unknown): boolean {
        return other instanceof ComponentPath && other.toString() === this.toString();
    }

    toString(): string {
        if (this.isRoot()) return DIVIDER;

        return DIVIDER + this.segments.join(DIVIDER);
    }
}
