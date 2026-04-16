import jQuery from 'jquery';
import {withThemeByClassName} from '@storybook/addon-themes';
import type {Preview} from '@storybook/preact-vite';
import {themes} from 'storybook/theming';

import {setTheme} from '../src/main/resources/assets/js/v2/state';

import './ui.css';
import './storybook.css';

globalThis.$ = jQuery;
globalThis.jQuery = jQuery;

const isDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;

//
// * Theme bridge: sync Storybook's theme class to the v2 $theme store
//

const themeSource = document.documentElement;
const themeObserver = new MutationObserver(() => {
  setTheme(themeSource.classList.contains('dark') ? 'dark' : 'light');
});
themeObserver.observe(themeSource, {attributes: true, attributeFilter: ['class']});
setTheme(isDark ? 'dark' : 'light');

const preview: Preview = {
    parameters: {
        layout: 'centered',
        controls: {matchers: {color: /(background|color)$/i, date: /Date$/i}},
        docs: {theme: isDark ? themes.dark : themes.light},
    },
    decorators: [
        withThemeByClassName({
            themes: {
                light: 'light',
                dark: 'dark',
            },
            defaultTheme: isDark ? 'dark' : 'light',
        }),
    ],
};

export default preview;
