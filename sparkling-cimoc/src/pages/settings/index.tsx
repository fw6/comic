import { root } from '@lynx-js/react';
import { nav } from '../../cimoc/nav/index.js';
import { SettingsScreen } from '../../cimoc/screens/Settings.js';
import { PageRoot } from '../_PageRoot.js';

root.render(
    <PageRoot>
        <SettingsScreen nav={nav} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
