import {afterEach, describe, expect, it, vi} from '@voidzero-dev/vite-plus-test';

import {ComponentPath} from '../protocol';
import {emit, reset, subscribe} from './editorEvents';

afterEach(() => {
    reset();
});

describe('editorEvents', () => {
    it('delivers the payload to a subscriber', () => {
        const handler = vi.fn();
        subscribe('component-load-request', handler);

        const path = ComponentPath.fromString('/main/0');
        emit('component-load-request', {path, isExisting: true});

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({path, isExisting: true});
    });

    it('fans out to every subscriber', () => {
        const first = vi.fn();
        const second = vi.fn();
        subscribe('component-load-request', first);
        subscribe('component-load-request', second);

        emit('component-load-request', {path: ComponentPath.fromString('/main/0'), isExisting: false});

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('stops delivering after unsubscribe', () => {
        const handler = vi.fn();
        const unsubscribe = subscribe('component-load-request', handler);

        unsubscribe();
        emit('component-load-request', {path: ComponentPath.fromString('/main/0'), isExisting: false});

        expect(handler).not.toHaveBeenCalled();
    });

    it('does nothing when emitting with no subscribers', () => {
        expect(() => {
            emit('component-load-request', {path: ComponentPath.fromString('/main/0'), isExisting: false});
        }).not.toThrow();
    });
});
