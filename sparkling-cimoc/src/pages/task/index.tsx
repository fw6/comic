import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { TaskScreen } from '../../cimoc/screens/Task.js';
import { PageRoot } from '../_PageRoot.js';

const { comicId } = decodeScreen('task', readParams());

root.render(
    <PageRoot>
        <TaskScreen nav={nav} comicId={comicId} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
