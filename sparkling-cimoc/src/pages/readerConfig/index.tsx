import { root } from '@lynx-js/react';
import { nav } from '../../cimoc/nav/index.js';
import { ReaderConfigScreen } from '../../cimoc/screens/ReaderConfig.js';
import { PageRoot } from '../_PageRoot.js';

root.render(
    <PageRoot>
        <ReaderConfigScreen nav={nav} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
