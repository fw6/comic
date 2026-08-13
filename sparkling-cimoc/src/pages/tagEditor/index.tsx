import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { TagEditorScreen } from '../../cimoc/screens/TagEditor.js';
import { PageRoot } from '../_PageRoot.js';

const { comicId } = decodeScreen('tagEditor', readParams());

root.render(
    <PageRoot>
        <TagEditorScreen nav={nav} comicId={comicId} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
