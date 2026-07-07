import {Blocks, Box, Columns2, Globe, Image, PenLine, Puzzle} from 'lucide-preact';

import type {ComponentRecordType} from '../types';
import type {LucideIcon} from 'lucide-preact';

/**
 * One icon per component kind, shared by placeholders and context-menu chrome.
 * Exhaustive over `ComponentRecordType` so a new protocol kind fails the build
 * here instead of silently rendering without an icon.
 */
export const KIND_ICONS: Record<ComponentRecordType, LucideIcon> = {
    page: Globe,
    region: Blocks,
    text: PenLine,
    part: Box,
    layout: Columns2,
    fragment: Puzzle,
    image: Image,
};
