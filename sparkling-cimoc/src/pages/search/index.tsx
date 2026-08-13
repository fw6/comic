import { root } from '@lynx-js/react';
import { nav } from '../../cimoc/nav/index.js';
import { SearchScreen } from '../../cimoc/screens/Search.js';
import { PageRoot } from '../_PageRoot.js';

root.render(
    <PageRoot>
        <SearchScreen nav={nav} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
