import jQuery from 'jquery';

const globals = globalThis as typeof globalThis & {$: typeof jQuery; jQuery: typeof jQuery};
globals.$ = jQuery;
globals.jQuery = jQuery;
