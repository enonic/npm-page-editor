import {withThemeByClassName} from '@storybook/addon-themes';
import {themes} from 'storybook/theming';

import type {Preview} from '@storybook/preact-vite';

import {addPhrases} from '../src/page-editor/editor/i18n/store';
import './storybook.css';

addPhrases({
    'text.selectcontroller': 'Select a component to create a page',
    'text.nocontrollers': 'No page controllers found',
    'text.addapplications': 'Please add an application to your site to enable preview',
    'text.notemplates': 'No page templates supporting content type "{0}" found',
});

const isDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;

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
