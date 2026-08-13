import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { ChaptersScreen } from '../../cimoc/screens/Chapters.js';
import { PageRoot } from '../_PageRoot.js';

const { comicId } = decodeScreen('chapters', readParams());

root.render(
    <PageRoot>
        <ChaptersScreen nav={nav} comicId={comicId} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
