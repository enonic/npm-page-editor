const bootMocks = vi.hoisted(() => ({
    initNewUi: vi.fn(() => vi.fn()),
}));

vi.mock('./init', () => ({
    initNewUi: bootMocks.initNewUi,
}));

import type {ComponentRecord} from './types';

import {createFakeBusPair, type FakeBusPair} from '../../test/fake-bus';
import {ComponentPath, type InitializePayload} from '../protocol';
import {EditorBoot} from './EditorBoot';
import {setRegistry} from './stores/registry';

function createRecord(path: string, error: boolean): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type: 'part',
        element: undefined,
        parentPath: '/main',
        children: [],
        empty: false,
        error,
        descriptor: 'app:part',
        loading: false,
    };
}

const INIT_PAYLOAD: InitializePayload = {params: {contentId: 'content-id'}};

describe('EditorBoot', () => {
    let pair: FakeBusPair;
    let boot: EditorBoot;

    beforeEach(() => {
        pair = createFakeBusPair();
        boot = new EditorBoot(pair.editor);
    });

    afterEach(() => {
        boot.destroy();
        setRegistry({});
        bootMocks.initNewUi.mockReset();
        bootMocks.initNewUi.mockImplementation(() => vi.fn());
    });

    it('posts ready with the error paths parsed during boot', () => {
        bootMocks.initNewUi.mockImplementation(() => {
            setRegistry({
                '/main/0': createRecord('/main/0', false),
                '/main/1': createRecord('/main/1', true),
                '/main/2': createRecord('/main/2', true),
            });
            return vi.fn();
        });

        const onReady = vi.fn();
        pair.host.on('ready', onReady);

        pair.host.post('initialize', INIT_PAYLOAD);

        expect(onReady).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledWith({errorPaths: ['/main/1', '/main/2']});
    });

    it('posts ready with an empty snapshot when nothing failed to render', () => {
        bootMocks.initNewUi.mockImplementation(() => {
            setRegistry({'/main/0': createRecord('/main/0', false)});
            return vi.fn();
        });

        const onReady = vi.fn();
        pair.host.on('ready', onReady);

        pair.host.post('initialize', INIT_PAYLOAD);

        expect(onReady).toHaveBeenCalledWith({errorPaths: []});
    });

    it('posts init-error instead of ready when boot fails', () => {
        bootMocks.initNewUi.mockImplementation(() => {
            throw new Error('boom');
        });

        const onReady = vi.fn();
        const onInitError = vi.fn();
        pair.host.on('ready', onReady);
        pair.host.on('init-error', onInitError);

        pair.host.post('initialize', INIT_PAYLOAD);

        expect(onReady).not.toHaveBeenCalled();
        expect(onInitError).toHaveBeenCalledWith({message: expect.stringContaining('boom')});
    });
});
