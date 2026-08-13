import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { DetailScreen } from '../../cimoc/screens/Detail.js';
import { PageRoot } from '../_PageRoot.js';

const { comicId } = decodeScreen('detail', readParams());

root.render(
    <PageRoot>
        <DetailScreen nav={nav} comicId={comicId} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
