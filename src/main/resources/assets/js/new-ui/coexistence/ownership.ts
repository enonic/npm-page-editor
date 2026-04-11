export type Surface =
    | 'placeholder'
    | 'highlighter'
    | 'selection'
    | 'shader'
    | 'hover-detection'
    | 'click-selection'
    | 'keyboard'
    | 'drag-drop';

const ownedByNewUi = new Set<Surface>();

export function transferOwnership(surface: Surface): void {
    ownedByNewUi.add(surface);
}

export function isOwnedByNewUI(surface: Surface): boolean {
    return ownedByNewUi.has(surface);
}

export function resetOwnership(): void {
    ownedByNewUi.clear();
}
