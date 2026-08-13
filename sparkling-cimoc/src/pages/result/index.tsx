import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { ResultScreen } from '../../cimoc/screens/Result.js';
import { PageRoot } from '../_PageRoot.js';

const { keyword, sources, mode } = decodeScreen('result', readParams());

root.render(
    <PageRoot>
        <ResultScreen nav={nav} keyword={keyword} sources={sources} mode={mode} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
