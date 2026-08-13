import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { SourceDetailScreen } from '../../cimoc/screens/SourceDetail.js';
import { PageRoot } from '../_PageRoot.js';

const { sourceId } = decodeScreen('sourceDetail', readParams());

root.render(
    <PageRoot>
        <SourceDetailScreen nav={nav} sourceId={sourceId} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
