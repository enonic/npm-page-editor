import type {EditorToHostType, PageEditorParams, PageJson} from '../../protocol';
import type {ComponentRecord, ComponentRecordType} from '../types';

import {ComponentPath} from '../../protocol';
import {addPhrases} from '../i18n';
import {$page} from '../stores/page';
import {$params} from '../stores/params';
import {$registry, $selectedPath} from '../stores/registry';
import {destroyTransport, getBus, initTransport} from '../transport/bus';
import {buildLockedPageMenuItems, buildMenuItems, type MenuItem} from './menu-items';

//
// * Fixtures
//

// Register the phrase keys the menu uses so labels render real text, not #key#.
const PHRASES: Record<string, string> = {
    'live.view.inspect': 'Inspect',
    'live.view.reset': 'Reset',
    'live.view.remove': 'Delete',
    'live.view.duplicate': 'Duplicate',
    'live.view.selectparent': 'Select parent',
    'widget.components.insert': 'Insert',
    'field.part': 'Part',
    'field.layout': 'Layout',
    'field.text': 'Text',
    'field.fragment': 'Fragment',
    'action.edit': 'Edit',
    'action.saveAsTemplate': 'Save as Template',
    'action.page.settings': 'Page settings',
    'action.component.create.fragment': 'Create Fragment',
    'action.component.detach.fragment': 'Detach from Fragment',
};

type PostCall = {type: EditorToHostType; payload: unknown};

let posted: PostCall[];

type RecordOptions = {
    path: string;
    type: ComponentRecordType;
    parentPath?: string;
    children?: string[];
    empty?: boolean;
    error?: boolean;
};

function record(options: RecordOptions): ComponentRecord {
    return {
        path: ComponentPath.fromString(options.path),
        type: options.type,
        element: undefined,
        parentPath: options.parentPath,
        children: options.children ?? [],
        empty: options.empty ?? false,
        error: options.error ?? false,
        descriptor: undefined,
        loading: false,
    };
}

function seed(records: ComponentRecord[]): void {
    const map: Record<string, ComponentRecord> = {};
    records.forEach(rec => {
        map[rec.path.toString()] = rec;
    });
    $registry.set(map);
}

function setParams(params: Partial<PageEditorParams>): void {
    $params.set({contentId: 'content-1', ...params});
}

const ids = (items: MenuItem[]): string[] => items.map(item => item.id);

const byId = (items: MenuItem[], id: string): MenuItem | undefined => items.find(item => item.id === id);

function runAndCapture(run: (() => void) | undefined): PostCall {
    run?.();
    expect(posted).toHaveLength(1);
    return posted[0];
}

beforeAll(() => {
    addPhrases(PHRASES);
});

beforeEach(() => {
    posted = [];
    initTransport();
    vi.spyOn(getBus()!, 'post').mockImplementation((type, payload) => {
        posted.push({type, payload});
    });
});

afterEach(() => {
    $registry.set({});
    $page.set(undefined);
    $params.set(undefined);
    $selectedPath.set(undefined);
    destroyTransport();
    vi.restoreAllMocks();
});

//
// * Component records
//

describe('buildMenuItems — component records', () => {
    it('builds the full menu for a part in a top-level region (incl. create-fragment, no edit)', () => {
        setParams({isFragmentAllowed: true, enableTextComponent: true});
        seed([
            record({type: 'page', path: '/', children: ['/main']}),
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
        ]);

        const items = buildMenuItems('/main/0');

        expect(ids(items)).toEqual([
            'select-parent',
            'insert',
            'inspect',
            'reset',
            'remove',
            'duplicate',
            'create-fragment',
        ]);
        // select-parent is always first.
        expect(items[0].id).toBe('select-parent');
        expect(byId(items, 'edit')).toBeUndefined();

        expect(byId(items, 'inspect')?.label).toBe('Inspect');
        expect(byId(items, 'reset')?.label).toBe('Reset');
        expect(byId(items, 'remove')?.label).toBe('Delete');
        expect(byId(items, 'duplicate')?.label).toBe('Duplicate');
        expect(byId(items, 'create-fragment')?.label).toBe('Create Fragment');
    });

    it('omits reset for an empty component', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0', '/main/1']}),
            record({type: 'part', path: '/main/0', parentPath: '/main', empty: true}),
            record({type: 'part', path: '/main/1', parentPath: '/main', empty: false}),
        ]);

        expect(byId(buildMenuItems('/main/0'), 'reset')).toBeUndefined();
        expect(byId(buildMenuItems('/main/1'), 'reset')?.label).toBe('Reset');
    });

    it('omits create-fragment when isFragmentAllowed is false', () => {
        setParams({isFragmentAllowed: false});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
        ]);

        expect(byId(buildMenuItems('/main/0'), 'create-fragment')).toBeUndefined();
    });

    it('does not offer inspect for text components', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'text', path: '/main/0', parentPath: '/main', empty: false}),
        ]);

        expect(byId(buildMenuItems('/main/0'), 'inspect')).toBeUndefined();
    });

    it('adds edit for a non-empty text component but not an empty one', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0', '/main/1']}),
            record({type: 'text', path: '/main/0', parentPath: '/main', empty: false}),
            record({type: 'text', path: '/main/1', parentPath: '/main', empty: true}),
        ]);

        expect(byId(buildMenuItems('/main/0'), 'edit')?.label).toBe('Edit');
        expect(byId(buildMenuItems('/main/1'), 'edit')).toBeUndefined();
    });

    it('adds edit and detach (but no create-fragment) for a non-empty fragment, detach before edit', () => {
        setParams({isFragmentAllowed: true});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'fragment', path: '/main/0', parentPath: '/main', empty: false}),
        ]);

        const items = buildMenuItems('/main/0');

        expect(byId(items, 'create-fragment')).toBeUndefined();
        expect(byId(items, 'detach')?.label).toBe('Detach from Fragment');
        expect(byId(items, 'edit')?.label).toBe('Edit');

        // A healthy fragment leaves both actions enabled.
        expect(byId(items, 'detach')?.disabled).toBeFalsy();
        expect(byId(items, 'edit')?.disabled).toBeFalsy();

        // Subclass append order: detach then edit.
        expect(ids(items)).toEqual([
            'select-parent',
            'insert',
            'inspect',
            'reset',
            'remove',
            'duplicate',
            'detach',
            'edit',
        ]);
    });

    it('omits edit and detach for an empty fragment', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'fragment', path: '/main/0', parentPath: '/main', empty: true}),
        ]);

        const items = buildMenuItems('/main/0');
        expect(byId(items, 'edit')).toBeUndefined();
        expect(byId(items, 'detach')).toBeUndefined();
    });

    it('disables edit and detach for an errored fragment', () => {
        setParams({isFragmentAllowed: true});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'fragment', path: '/main/0', parentPath: '/main', empty: false, error: true}),
        ]);

        const items = buildMenuItems('/main/0');
        expect(byId(items, 'detach')?.disabled).toBe(true);
        expect(byId(items, 'edit')?.disabled).toBe(true);
    });
});

//
// * Insert submenu
//

describe('buildMenuItems — insert submenu', () => {
    it('omits the layout child when the component is inside a layout region', () => {
        setParams({enableTextComponent: true});
        seed([
            record({type: 'layout', path: '/main/0', parentPath: '/main', children: ['/main/0/left']}),
            record({type: 'region', path: '/main/0/left', parentPath: '/main/0', children: ['/main/0/left/0']}),
            record({type: 'part', path: '/main/0/left/0', parentPath: '/main/0/left'}),
        ]);

        const insert = byId(buildMenuItems('/main/0/left/0'), 'insert');
        expect(insert?.children?.map(child => child.id)).toEqual(['insert/part', 'insert/text', 'insert/fragment']);
    });

    it('includes the layout child when the region is top-level', () => {
        setParams({enableTextComponent: true});
        seed([
            record({type: 'page', path: '/', children: ['/main']}),
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
        ]);

        const insert = byId(buildMenuItems('/main/0'), 'insert');
        expect(insert?.children?.map(child => child.id)).toEqual([
            'insert/part',
            'insert/layout',
            'insert/text',
            'insert/fragment',
        ]);
    });

    it('omits the text child when enableTextComponent is false', () => {
        setParams({enableTextComponent: false});
        seed([
            record({type: 'page', path: '/', children: ['/main']}),
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
        ]);

        const insert = byId(buildMenuItems('/main/0'), 'insert');
        expect(insert?.children?.map(child => child.id)).toEqual(['insert/part', 'insert/layout', 'insert/fragment']);
    });

    it('posts add-component-requested at index 0 of the region for a region item', () => {
        setParams({});
        seed([
            record({type: 'page', path: '/', children: ['/main']}),
            record({type: 'region', path: '/main', parentPath: '/', children: []}),
        ]);

        const part = byId(byId(buildMenuItems('/main'), 'insert')?.children ?? [], 'insert/part');
        const call = runAndCapture(part?.run);

        expect(call.type).toBe('add-component-requested');
        expect(call.payload).toEqual({path: '/main/0', kind: 'part'});
    });

    it('posts add-component-requested at ownIndex+1 for a component item, matching the children array', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0', '/main/1', '/main/2']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
            record({type: 'part', path: '/main/1', parentPath: '/main'}),
            record({type: 'part', path: '/main/2', parentPath: '/main'}),
        ]);

        const part = byId(byId(buildMenuItems('/main/1'), 'insert')?.children ?? [], 'insert/part');
        const call = runAndCapture(part?.run);

        // ownIndex of /main/1 is 1 (both via children.indexOf and the path leaf); insert lands at 2.
        expect(call.payload).toEqual({path: '/main/2', kind: 'part'});

        const region = $registry.get()['/main'];
        const componentPath = '/main/1';
        expect(region.children.indexOf(componentPath)).toBe(Number(ComponentPath.fromString(componentPath).getPath()));
    });
});

//
// * Fragment-mode root
//

describe('buildMenuItems — fragment-mode root component', () => {
    it('omits select-parent, insert, remove and duplicate', () => {
        setParams({isFragment: true, isFragmentAllowed: true});
        // In fragment mode the root component is the `/` record with no parent.
        seed([record({type: 'part', path: '/', parentPath: undefined})]);

        const items = buildMenuItems('/');

        expect(byId(items, 'select-parent')).toBeUndefined();
        expect(byId(items, 'insert')).toBeUndefined();
        expect(byId(items, 'remove')).toBeUndefined();
        expect(byId(items, 'duplicate')).toBeUndefined();

        // Inspect, reset and create-fragment remain.
        expect(ids(items)).toEqual(['inspect', 'reset', 'create-fragment']);
    });

    it('omits reset after the root component is reset (empty)', () => {
        setParams({isFragment: true, isFragmentAllowed: true});
        seed([record({type: 'part', path: '/', parentPath: undefined, empty: true})]);

        expect(ids(buildMenuItems('/'))).toEqual(['inspect', 'create-fragment']);
    });
});

//
// * Region records
//

describe('buildMenuItems — region records', () => {
    it('includes reset only when the region is not empty', () => {
        setParams({});
        seed([
            record({type: 'page', path: '/', children: ['/main', '/side']}),
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0'], empty: false}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
            record({type: 'region', path: '/side', parentPath: '/', children: [], empty: true}),
        ]);

        expect(ids(buildMenuItems('/main'))).toEqual(['select-parent', 'insert', 'reset']);
        expect(ids(buildMenuItems('/side'))).toEqual(['select-parent', 'insert']);
    });
});

//
// * Page record
//

describe('buildMenuItems — page record', () => {
    it('builds inspect, reset and save-as-template; reset disabled when isResetEnabled is false', () => {
        setParams({isResetEnabled: false, isPageTemplate: false});
        seed([record({type: 'page', path: '/', children: []})]);

        const items = buildMenuItems('/');

        expect(ids(items)).toEqual(['inspect', 'reset', 'save-as-template']);
        expect(byId(items, 'reset')?.disabled).toBe(true);
    });

    it('enables reset when isResetEnabled is true', () => {
        setParams({isResetEnabled: true});
        seed([record({type: 'page', path: '/', children: []})]);

        expect(byId(buildMenuItems('/'), 'reset')?.disabled).toBe(false);
    });

    it('omits save-as-template when isPageTemplate is true', () => {
        setParams({isResetEnabled: true, isPageTemplate: true});
        seed([record({type: 'page', path: '/', children: []})]);

        const items = buildMenuItems('/');
        expect(ids(items)).toEqual(['inspect', 'reset']);
        expect(byId(items, 'save-as-template')).toBeUndefined();
    });

    it('omits save-as-template in fragment mode', () => {
        setParams({isResetEnabled: true, isFragment: true});
        seed([record({type: 'page', path: '/', children: []})]);

        const items = buildMenuItems('/');
        expect(byId(items, 'save-as-template')).toBeUndefined();
        expect(byId(items, 'reset')?.label).toBe('Reset');
    });

    it('omits reset for an empty fragment page', () => {
        setParams({isResetEnabled: true, isFragment: true});
        seed([record({type: 'page', path: '/', children: [], empty: true})]);

        expect(ids(buildMenuItems('/'))).toEqual(['inspect']);
    });
});

//
// * Locked page
//

describe('buildLockedPageMenuItems', () => {
    it('builds a single page-settings item', () => {
        const items = buildLockedPageMenuItems();
        expect(ids(items)).toEqual(['page-settings']);
        expect(items[0].label).toBe('Page settings');
    });
});

//
// * run() handlers post the right protocol messages
//

describe('buildMenuItems — run handlers post the right protocol messages', () => {
    it('page inspect posts component-inspect-requested at the root path', () => {
        setParams({isResetEnabled: true});
        seed([record({type: 'page', path: '/', children: []})]);

        const call = runAndCapture(byId(buildMenuItems('/'), 'inspect')?.run);
        expect(call).toEqual({type: 'component-inspect-requested', payload: {path: '/'}});
    });

    it('page reset posts page-reset-requested', () => {
        setParams({isResetEnabled: true});
        seed([record({type: 'page', path: '/', children: []})]);

        expect(runAndCapture(byId(buildMenuItems('/'), 'reset')?.run).type).toBe('page-reset-requested');
    });

    it('save-as-template posts save-as-template-requested', () => {
        setParams({isResetEnabled: true, isPageTemplate: false});
        seed([record({type: 'page', path: '/', children: []})]);

        expect(runAndCapture(byId(buildMenuItems('/'), 'save-as-template')?.run).type).toBe(
            'save-as-template-requested',
        );
    });

    it('locked-page settings posts component-inspect-requested at the root path', () => {
        const call = runAndCapture(byId(buildLockedPageMenuItems(), 'page-settings')?.run);
        expect(call).toEqual({type: 'component-inspect-requested', payload: {path: '/'}});
    });

    it('component inspect/reset/remove/duplicate post the matching messages with the path', () => {
        setParams({isFragmentAllowed: false});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
        ]);

        const items = buildMenuItems('/main/0');

        expect(runAndCapture(byId(items, 'inspect')?.run)).toEqual({
            type: 'component-inspect-requested',
            payload: {path: '/main/0'},
        });
        posted = [];
        expect(runAndCapture(byId(items, 'reset')?.run)).toEqual({
            type: 'reset-component-requested',
            payload: {path: '/main/0'},
        });
        posted = [];
        expect(runAndCapture(byId(items, 'remove')?.run)).toEqual({
            type: 'remove-component-requested',
            payload: {path: '/main/0'},
        });
        posted = [];
        expect(runAndCapture(byId(items, 'duplicate')?.run)).toEqual({
            type: 'duplicate-component-requested',
            payload: {path: '/main/0'},
        });
    });

    it('region reset posts remove-component-requested for each child in reverse order', () => {
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0', '/main/1']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
            record({type: 'part', path: '/main/1', parentPath: '/main'}),
        ]);

        byId(buildMenuItems('/main'), 'reset')?.run?.();

        expect(posted).toEqual([
            {type: 'remove-component-requested', payload: {path: '/main/1'}},
            {type: 'remove-component-requested', payload: {path: '/main/0'}},
        ]);
    });

    it('create-fragment posts create-fragment-requested with the path', () => {
        setParams({isFragmentAllowed: true});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'part', path: '/main/0', parentPath: '/main'}),
        ]);

        const call = runAndCapture(byId(buildMenuItems('/main/0'), 'create-fragment')?.run);
        expect(call).toEqual({type: 'create-fragment-requested', payload: {path: '/main/0'}});
    });

    it('text edit posts text-edit-requested with the path', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'text', path: '/main/0', parentPath: '/main', empty: false}),
        ]);

        const call = runAndCapture(byId(buildMenuItems('/main/0'), 'edit')?.run);
        expect(call).toEqual({type: 'text-edit-requested', payload: {path: '/main/0'}});
    });

    it('fragment edit posts edit-content-requested with the fragment content id', () => {
        setParams({});
        const page: PageJson = {
            regions: [
                {
                    name: 'main',
                    components: [{FragmentComponent: {fragment: 'fragment-content-id'}}],
                },
            ],
        };
        $page.set(page);
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'fragment', path: '/main/0', parentPath: '/main', empty: false}),
        ]);

        const call = runAndCapture(byId(buildMenuItems('/main/0'), 'edit')?.run);
        expect(call).toEqual({type: 'edit-content-requested', payload: {contentId: 'fragment-content-id'}});
    });

    it('fragment detach posts detach-fragment-requested with the path', () => {
        setParams({});
        seed([
            record({type: 'region', path: '/main', parentPath: '/', children: ['/main/0']}),
            record({type: 'fragment', path: '/main/0', parentPath: '/main', empty: false}),
        ]);

        const call = runAndCapture(byId(buildMenuItems('/main/0'), 'detach')?.run);
        expect(call).toEqual({type: 'detach-fragment-requested', payload: {path: '/main/0'}});
    });

    it('insert children carry the kind and post add-component-requested', () => {
        setParams({enableTextComponent: true});
        seed([
            record({type: 'page', path: '/', children: ['/main']}),
            record({type: 'region', path: '/main', parentPath: '/', children: []}),
        ]);

        const children = byId(buildMenuItems('/main'), 'insert')?.children ?? [];
        expect(children.map(child => child.id)).toEqual([
            'insert/part',
            'insert/layout',
            'insert/text',
            'insert/fragment',
        ]);

        const call = runAndCapture(byId(children, 'insert/fragment')?.run);
        expect(call).toEqual({type: 'add-component-requested', payload: {path: '/main/0', kind: 'fragment'}});
    });
});
