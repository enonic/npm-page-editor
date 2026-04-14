import {ok, err, type Result} from '../result';

export type ComponentPath = string & {readonly __brand: 'ComponentPath'};

export function root(): ComponentPath {
  return '/' as ComponentPath;
}

export function fromString(raw: string): Result<ComponentPath> {
  if (raw === '') return err('Path must not be empty');
  if (!raw.startsWith('/')) return err("Path must start with '/'");
  if (raw === '/') return ok(root());
  if (raw.endsWith('/')) return err('Path must not have trailing slash');

  const segments = raw.slice(1).split('/');

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '') return err('Path must not contain empty segments');
    if (/^-\d+$/.test(seg)) return err('Path segment must not be a negative index');

    const isNumeric = /^\d+$/.test(seg);
    const expectNumeric = i % 2 === 1;

    if (isNumeric !== expectNumeric) return err('Path segments must alternate between region name and component index');
  }

  return ok(raw as ComponentPath);
}

export function parent(path: ComponentPath): ComponentPath | undefined {
  if (path === '/') return undefined;
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === 0) return root();
  return path.slice(0, lastSlash) as ComponentPath;
}

export function regionName(path: ComponentPath): string | undefined {
  if (path === '/') return undefined;
  const segments = path.slice(1).split('/');

  for (let i = segments.length - 1; i >= 0; i--) {
    if (!/^\d+$/.test(segments[i])) return segments[i];
  }
  return undefined;
}

export function componentIndex(path: ComponentPath): number | undefined {
  if (path === '/') return undefined;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  if (/^\d+$/.test(lastSegment)) return Number(lastSegment);
  return undefined;
}

export function append(path: ComponentPath, region?: string, index?: number): ComponentPath {
  let result = path as string;

  if (region != null) {
    result = result === '/' ? `/${region}` : `${result}/${region}`;
  }
  if (index != null) {
    result = result === '/' ? `/${index}` : `${result}/${index}`;
  }

  return result as ComponentPath;
}

export function insertAt(regionPath: ComponentPath, index: number): ComponentPath {
  return append(regionPath, undefined, index);
}

export function isRegion(path: ComponentPath): boolean {
  if (path === '/') return true;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  return !/^\d+$/.test(lastSegment);
}

export function isComponent(path: ComponentPath): boolean {
  if (path === '/') return false;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  return /^\d+$/.test(lastSegment);
}

export function equals(a: ComponentPath, b: ComponentPath): boolean {
  return a === b;
}

export function isDescendantOf(child: ComponentPath, ancestor: ComponentPath): boolean {
  if (child === ancestor) return false;
  if (ancestor === '/') return true;
  return child.startsWith(ancestor + '/');
}

export function depth(path: ComponentPath): number {
  if (path === '/') return 0;
  return path.slice(1).split('/').length;
}
