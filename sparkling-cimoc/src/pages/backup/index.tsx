import { root } from '@lynx-js/react';
import { nav } from '../../cimoc/nav/index.js';
import { BackupScreen } from '../../cimoc/screens/Backup.js';
import { PageRoot } from '../_PageRoot.js';

root.render(
    <PageRoot>
        <BackupScreen nav={nav} />
    </PageRoot>,
);

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept();
}
