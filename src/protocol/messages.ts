import {type ComponentPath} from './path';

export type ComponentType = 'page' | 'region' | 'text' | 'part' | 'layout' | 'fragment';

export type Modifiers = {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
};

export type PageConfig = {
  contentId: string;
  pageName: string;
  pageIconClass: string;
  locked: boolean;
  modifyPermissions: boolean;
  pageEmpty: boolean;
  pageTemplate: boolean;
  fragment: boolean;
  fragmentAllowed: boolean;
  resetEnabled: boolean;
  phrases: Record<string, string>;
  theme?: 'light' | 'dark';
  langDirection?: 'ltr' | 'rtl';
};

export type PageDescriptor = {
  components: Record<string, {descriptor?: string; fragment?: string; name?: string}>;
};

export type PageController = {
  descriptorKey: string;
  displayName: string;
  iconClass: string;
};

export const INCOMING_MESSAGE_TYPES: ReadonlySet<IncomingMessage['type']> = new Set<IncomingMessage['type']>([
  'init',
  'select',
  'deselect',
  'load',
  'set-component-state',
  'page-state',
  'set-lock',
  'set-modify-allowed',
  'set-theme',
  'create-draggable',
  'destroy-draggable',
  'set-draggable-visible',
  'page-controllers',
  'update-text-component',
]);

export type IncomingMessage =
  | {type: 'init'; config: PageConfig}
  | {type: 'select'; path: ComponentPath; silent?: boolean}
  | {type: 'deselect'; path?: ComponentPath}
  | {type: 'load'; path: ComponentPath; existing: boolean}
  | {type: 'set-component-state'; path: ComponentPath; processing: boolean}
  | {type: 'page-state'; page: PageDescriptor}
  | {type: 'set-lock'; locked: boolean}
  | {type: 'set-modify-allowed'; allowed: boolean}
  | {type: 'set-theme'; theme: 'light' | 'dark'}
  | {type: 'create-draggable'; componentType: string}
  | {type: 'destroy-draggable'}
  | {type: 'set-draggable-visible'; visible: boolean}
  | {type: 'page-controllers'; controllers: PageController[]}
  | {type: 'update-text-component'; path: ComponentPath; html: string};

export type OutgoingMessage =
  | {type: 'ready'}
  | {type: 'page-ready'}
  | {type: 'error'; phase: 'init' | 'reconcile' | 'handle'; message: string}
  | {type: 'select'; path: ComponentPath; position?: {x: number; y: number}; rightClicked?: boolean}
  | {type: 'deselect'; path: ComponentPath}
  | {type: 'move'; from: ComponentPath; to: ComponentPath}
  | {type: 'add'; path: ComponentPath; componentType: ComponentType}
  | {type: 'remove'; path: ComponentPath}
  | {type: 'duplicate'; path: ComponentPath}
  | {type: 'reset'; path: ComponentPath}
  | {type: 'inspect'; path: ComponentPath}
  | {type: 'create-fragment'; path: ComponentPath}
  | {type: 'detach-fragment'; path: ComponentPath}
  | {type: 'edit-text'; path: ComponentPath}
  | {type: 'edit-content'; contentId: string}
  | {type: 'save-as-template'}
  | {type: 'select-page-descriptor'; descriptorKey: string}
  | {type: 'page-reload-request'}
  | {type: 'component-loaded'; path: ComponentPath}
  | {type: 'component-load-failed'; path: ComponentPath; reason: string}
  | {type: 'drag-started'; path?: ComponentPath}
  | {type: 'drag-stopped'; path?: ComponentPath}
  | {type: 'drag-dropped'; from?: ComponentPath; to: ComponentPath}
  | {type: 'keyboard-event'; eventType: string; key: string; keyCode: number; modifiers: Modifiers}
  | {type: 'iframe-loaded'}
  | {type: 'navigate'; path: string};
