import { useEffect } from '@lynx-js/react';
import { type Screen, useNavigation } from './nav/index.js';
import { AboutScreen } from './screens/About.js';
import { BackupScreen } from './screens/Backup.js';
import { CategoryScreen } from './screens/Category.js';
import { ChaptersScreen } from './screens/Chapters.js';
import { DetailScreen } from './screens/Detail.js';
import { EventSettingsScreen } from './screens/EventSettings.js';
import { MainScreen } from './screens/Main.js';
import { ReaderScreen } from './screens/Reader.js';
import { ReaderConfigScreen } from './screens/ReaderConfig.js';
import { ResultScreen } from './screens/Result.js';
import { SearchScreen } from './screens/Search.js';
import { SettingsScreen } from './screens/Settings.js';
import { SourceDetailScreen } from './screens/SourceDetail.js';
import { SourcesScreen } from './screens/Sources.js';
import { TagEditorScreen } from './screens/TagEditor.js';
import { TaskScreen } from './screens/Task.js';
import { hydrateAppState, useAppStore } from './store.js';
import { nightOverlayColor } from './theme/index.js';

function ScreenView({
    screen,
    nav,
}: {
    screen: Screen;
    nav: ReturnType<typeof useNavigation>;
}) {
    switch (screen.name) {
        case 'main':
            return <MainScreen nav={nav} />;
        case 'sources':
            return <SourcesScreen nav={nav} />;
        case 'search':
            return <SearchScreen nav={nav} />;
        case 'result':
            return (
                <ResultScreen
                    nav={nav}
                    keyword={screen.keyword}
                    sources={screen.sources}
                    mode={screen.mode}
                />
            );
        case 'detail':
            return <DetailScreen nav={nav} comicId={screen.comicId} />;
        case 'reader':
            return (
                <ReaderScreen
                    nav={nav}
                    comicId={screen.comicId}
                    chapterIndex={screen.chapterIndex}
                    mode={screen.mode}
                />
            );
        case 'settings':
            return <SettingsScreen nav={nav} />;
        case 'about':
            return <AboutScreen nav={nav} />;
        case 'backup':
            return <BackupScreen nav={nav} />;
        case 'chapters':
            return <ChaptersScreen nav={nav} comicId={screen.comicId} />;
        case 'sourceDetail':
            return <SourceDetailScreen nav={nav} sourceId={screen.sourceId} />;
        case 'readerConfig':
            return <ReaderConfigScreen nav={nav} />;
        case 'category':
            return <CategoryScreen nav={nav} sourceId={screen.sourceId} />;
        case 'tagEditor':
            return <TagEditorScreen nav={nav} comicId={screen.comicId} />;
        case 'eventSettings':
            return <EventSettingsScreen nav={nav} mode={screen.mode} />;
        case 'task':
            return <TaskScreen nav={nav} comicId={screen.comicId} />;
        default:
            return null;
    }
}

export function App() {
    const nav = useNavigation();
    const store = useAppStore();
    const { theme } = store;
    const screen = nav.screen;

    useEffect(() => {
        // 启动时从原生存储恢复收藏/历史/设置/标签/下载
        void hydrateAppState();
    }, []);

    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
            }}
        >
            <ScreenView screen={screen} nav={nav} />
            {/* Night mode overlay: translucent black mask over the light theme */}
            {theme.night ? (
                <view
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: nightOverlayColor(theme.nightAlpha),
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
        </view>
    );
}
