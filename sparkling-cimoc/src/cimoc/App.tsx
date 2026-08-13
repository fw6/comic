import { useEffect } from '@lynx-js/react';
import { useEdgeBackGesture } from './components/edgeBackGesture.js';
import { type Screen, useNavigation } from './nav/index.js';
import { onNativeBack, setBackState } from './native/bridge.js';
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

    // 左缘右滑返回：main（根页）与 reader（阅读器自己处理，避免与翻页冲突）除外
    const edgeBack = useEdgeBackGesture(
        () => nav.pop(),
        screen.name !== 'main' && screen.name !== 'reader',
    );

    useEffect(() => {
        // 宿主系统返回（Android 手势/实体键）→ JS 弹栈；根页由宿主连按退出
        const off = onNativeBack(() => nav.pop());
        return off;
    }, []);

    useEffect(() => {
        // 上报 JS 导航栈是否可返回，宿主据此决定弹栈还是退出
        void setBackState(screen.name !== 'main');
    }, [screen]);

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
                backgroundColor: theme.tokens.bg,
            }}
            bindtouchstart={edgeBack.bindtouchstart}
            bindtouchmove={edgeBack.bindtouchmove}
            bindtouchend={edgeBack.bindtouchend}
            bindtouchcancel={edgeBack.bindtouchcancel}
        >
            <ScreenView screen={screen} nav={nav} />
        </view>
    );
}
