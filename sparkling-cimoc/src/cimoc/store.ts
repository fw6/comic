import {
    atom,
    getDefaultStore,
    useAtom,
    useAtomValue,
    useSetAtom,
} from 'jotai';
import type { LibraryTab } from './data/models.js';
import {
    loadDownloads,
    loadFavorites,
    loadHistory,
    loadMode,
    loadProgress,
    loadSettings,
    loadSources,
    loadTags,
    persistDownloads,
    persistFavorites,
    persistHistory,
    persistMode,
    persistProgress,
    persistSettings,
    persistSources,
    persistTags,
    type ReadingProgress,
    sourceList,
    updateComicProgress,
} from './data/service.js';
import {
    ACCENTS,
    appTheme,
    type AppTheme,
    type ThemeMode,
    type ThemeName,
} from './theme/index.js';

export interface ReaderSettings {
    defaultMode: 'page' | 'stream';
    keepScreenBright: boolean;
    showTopBar: boolean;
    hideInfo: boolean;
    hideNav: boolean;
    banDoubleClick: boolean;
    autoSplitLargeImage: boolean;
    reverseSplit: boolean;
    closeAutoResize: boolean;
    autoCropWhiteEdge: boolean;
    whiteBackground: boolean;
    volumeKeyTurn: boolean;
    doubleTapZoom: number; // percent 100-300
    direction: 'ltr' | 'rtl' | 'ttb';
    orientation: 'portrait' | 'landscape' | 'auto';
    wifiOnly: boolean;
    coverWifiOnly: boolean;
    autoCheckUpdate: boolean;
    startupScreen: LibraryTab;
    theme: ThemeName;
    downloadThreads: number;
    autocomplete: boolean;
}

export const DEFAULT_READER: ReaderSettings = {
    // 上下滑动阅读（卷纸模式）为默认阅读方式，支持无限滚动续话
    defaultMode: 'stream',
    keepScreenBright: false,
    showTopBar: true,
    hideInfo: false,
    hideNav: false,
    banDoubleClick: false,
    autoSplitLargeImage: false,
    reverseSplit: false,
    closeAutoResize: false,
    autoCropWhiteEdge: false,
    whiteBackground: false,
    volumeKeyTurn: false,
    doubleTapZoom: 150,
    direction: 'ltr',
    orientation: 'portrait',
    wifiOnly: false,
    coverWifiOnly: false,
    autoCheckUpdate: true,
    startupScreen: 'favorite',
    theme: 'vermilion',
    downloadThreads: 3,
    autocomplete: true,
};

// --- atoms ---
export const settingsAtom = atom<ReaderSettings>(DEFAULT_READER);
/** 墨色 / 纸面 模式（运行时切换，不持久化，等同旧版夜间开关） */
export const modeAtom = atom<ThemeMode>('ink');
export const favoritesAtom = atom<string[]>([]);
export const historyAtom = atom<string[]>([]);
/** 图源开关：sourceId -> enabled（默认取注册表静态配置，可被原生存储覆盖） */
export const sourcesAtom = atom<Record<string, boolean>>(
    Object.fromEntries(sourceList().map((s) => [s.id, s.enabled])),
);
/** Custom user tags per comic id (Cimoc: 编辑标签). */
export const tagsAtom = atom<Record<string, string[]>>({});
/** 阅读进度：comicId -> 最后阅读章节与时间（用于“继续阅读”续读）。 */
export const progressAtom = atom<Record<string, ReadingProgress>>({});
/** Downloads queue: comicId -> list of chapter indexes. */
export const downloadsAtom = atom<Record<string, number[]>>({});

/** Derived theme object: mode + accent + resolved semantic tokens. */
export const themeAtom = atom<AppTheme>((get) => {
    const settings = get(settingsAtom);
    return appTheme(get(modeAtom), ACCENTS[settings.theme]);
});

// --- derived helpers ---
export function useIsFavorite(comicId: string): boolean {
    return useAtomValue(favoritesAtom).includes(comicId);
}

/** 持久化切片注册表：新增一个持久化值 = 在此加一条（load + 恢复到 atom）。hydrateAppState 由它推导。 */
const PERSISTED_SLICES: Array<{
    restore: (store: ReturnType<typeof getDefaultStore>) => Promise<void>;
}> = [
    {
        restore: async (store) => {
            const v = await loadFavorites();
            if (v) store.set(favoritesAtom, v);
        },
    },
    {
        restore: async (store) => {
            const v = await loadHistory();
            if (v) store.set(historyAtom, v);
        },
    },
    {
        restore: async (store) => {
            const v = await loadTags();
            if (v) store.set(tagsAtom, v);
        },
    },
    {
        restore: async (store) => {
            const v = await loadDownloads();
            if (v) store.set(downloadsAtom, v);
        },
    },
    {
        restore: async (store) => {
            const v = await loadProgress();
            if (v) store.set(progressAtom, v);
        },
    },
    {
        restore: async (store) => {
            const v = await loadSources();
            if (v) store.set(sourcesAtom, v);
        },
    },
    {
        restore: async (store) => {
            const v = await loadSettings();
            if (v)
                store.set(settingsAtom, (prev) => ({
                    ...prev,
                    ...(v as Partial<ReaderSettings>),
                }));
        },
    },
    {
        restore: async (store) => {
            const v = await loadMode();
            if (v === 'ink' || v === 'paper') store.set(modeAtom, v);
        },
    },
];

/** 从原生存储恢复状态（收藏/历史/设置/标签/下载/进度/图源开关/主题模式）。每页挂载时调用。 */
export async function hydrateAppState(): Promise<void> {
    const store = getDefaultStore();
    await Promise.all(PERSISTED_SLICES.map((s) => s.restore(store)));
}

export interface AppStore {
    settings: ReaderSettings;
    updateSettings: (patch: Partial<ReaderSettings>) => void;
    theme: AppTheme;
    setThemeName: (name: ThemeName) => void;
    setMode: (mode: ThemeMode) => void;
    favorites: string[];
    toggleFavorite: (comicId: string) => void;
    isFavorite: (comicId: string) => boolean;
    history: string[];
    recordHistory: (comicId: string, chapterIndex?: number) => void;
    removeHistory: (comicId: string) => void;
    progress: Record<string, ReadingProgress>;
    getProgress: (comicId: string) => ReadingProgress | undefined;
    tags: Record<string, string[]>;
    getTags: (comicId: string) => string[];
    setTags: (comicId: string, tags: string[]) => void;
    downloads: Record<string, number[]>;
    addDownload: (comicId: string, chapterIndexes: number[]) => void;
    removeDownload: (comicId: string) => void;
    isDownloaded: (comicId: string, chapterIndex: number) => boolean;
    sources: Record<string, boolean>;
    toggleSource: (sourceId: string) => void;
    updateSources: (next: Record<string, boolean>) => void;
}

/** Convenience hook exposing the same API used across screens. */
export function useAppStore(): AppStore {
    const [settings, setSettings] = useAtom(settingsAtom);
    const setModeAtom = useSetAtom(modeAtom);
    const [favorites, setFavorites] = useAtom(favoritesAtom);
    const [history, setHistory] = useAtom(historyAtom);
    const [tags, setTags] = useAtom(tagsAtom);
    const [downloads, setDownloads] = useAtom(downloadsAtom);
    const [progress, setProgress] = useAtom(progressAtom);
    const [sources, setSources] = useAtom(sourcesAtom);
    const theme = useAtomValue(themeAtom);

    return {
        settings,
        updateSettings: (patch) => {
            const next = { ...settings, ...patch };
            setSettings(next);
            void persistSettings(next as unknown as Record<string, unknown>);
        },
        theme,
        setThemeName: (name) => {
            const next = { ...settings, theme: name };
            setSettings(next);
            void persistSettings(next as unknown as Record<string, unknown>);
        },
        setMode: (mode: ThemeMode) => {
            setModeAtom(mode);
            void persistMode(mode);
        },
        favorites,
        toggleFavorite: (comicId) => {
            const next = favorites.includes(comicId)
                ? favorites.filter((id) => id !== comicId)
                : [comicId, ...favorites];
            setFavorites(next);
            void persistFavorites(next);
        },
        isFavorite: (comicId) => favorites.includes(comicId),
        history,
        recordHistory: (comicId, chapterIndex) => {
            // 从实时 atom 读取（而非渲染闭包），连续记录不丢失更新
            const current = getDefaultStore().get(historyAtom);
            const next = [comicId, ...current.filter((id) => id !== comicId)];
            setHistory(next);
            void persistHistory(next);
            if (chapterIndex !== undefined) {
                const now = Date.now();
                const prog = getDefaultStore().get(progressAtom);
                const nextProg = {
                    ...prog,
                    [comicId]: { chapter: chapterIndex, time: now },
                };
                setProgress(nextProg);
                void persistProgress(nextProg);
                // 同步内存中的漫画缓存，让详情页/信息弹窗展示最新续读位置
                updateComicProgress(comicId, chapterIndex, now);
            }
        },
        removeHistory: (comicId) => {
            const next = history.filter((id) => id !== comicId);
            setHistory(next);
            void persistHistory(next);
        },
        progress,
        getProgress: (comicId) => progress[comicId],
        tags,
        getTags: (comicId) => tags[comicId] ?? [],
        setTags: (comicId, newTags) => {
            const next = { ...tags, [comicId]: newTags };
            setTags(next);
            void persistTags(next);
        },
        downloads,
        addDownload: (comicId, chapterIndexes) => {
            const next = {
                ...downloads,
                [comicId]: [...(downloads[comicId] ?? []), ...chapterIndexes],
            };
            setDownloads(next);
            void persistDownloads(next);
        },
        removeDownload: (comicId) => {
            const next = { ...downloads };
            delete next[comicId];
            setDownloads(next);
            void persistDownloads(next);
        },
        isDownloaded: (comicId, chapterIndex) =>
            (downloads[comicId] ?? []).includes(chapterIndex),
        sources,
        toggleSource: (sourceId) => {
            const next = { ...sources, [sourceId]: !sources[sourceId] };
            setSources(next);
            void persistSources(next);
        },
        updateSources: (next) => {
            setSources(next);
            void persistSources(next);
        },
    };
}
