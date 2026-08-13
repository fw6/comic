import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { ReaderScreen } from '../../cimoc/screens/Reader.js';
import { PageRoot } from '../_PageRoot.js';

const { comicId, chapterIndex, mode } = decodeScreen('reader', readParams());

root.render(
    <PageRoot>
        <ReaderScreen
            nav={nav}
            comicId={comicId}
            chapterIndex={chapterIndex}
            mode={mode}
        />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
