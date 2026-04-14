import jQuery from 'jquery';

declare const globalThis: typeof global & { $: typeof jQuery; jQuery: typeof jQuery };

globalThis.$ = jQuery;
globalThis.jQuery = jQuery;
