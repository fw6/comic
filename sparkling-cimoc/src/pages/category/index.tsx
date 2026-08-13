import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { CategoryScreen } from '../../cimoc/screens/Category.js';
import { PageRoot } from '../_PageRoot.js';

const { sourceId } = decodeScreen('category', readParams());

root.render(
    <PageRoot>
        <CategoryScreen nav={nav} sourceId={sourceId} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
