import { root } from '@lynx-js/react';
import { nav } from '../../cimoc/nav/index.js';
import { AboutScreen } from '../../cimoc/screens/About.js';
import { PageRoot } from '../_PageRoot.js';

root.render(
    <PageRoot>
        <AboutScreen nav={nav} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
