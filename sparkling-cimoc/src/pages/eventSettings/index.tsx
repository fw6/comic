import { root } from '@lynx-js/react';
import { decodeScreen, nav, readParams } from '../../cimoc/nav/index.js';
import { EventSettingsScreen } from '../../cimoc/screens/EventSettings.js';
import { PageRoot } from '../_PageRoot.js';

const { mode } = decodeScreen('eventSettings', readParams());

root.render(
    <PageRoot>
        <EventSettingsScreen nav={nav} mode={mode} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
