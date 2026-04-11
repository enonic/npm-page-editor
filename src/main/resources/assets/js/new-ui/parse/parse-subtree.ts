import type {ComponentRecord} from '../types';
import {parsePage} from './parse-page';

export function parseSubtree(rootElement: HTMLElement): Record<string, ComponentRecord> {
    return parsePage(rootElement.ownerDocument.body);
}
