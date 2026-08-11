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
    loadProgress,
    loadSettings,
    loadTags,
    persistDownloads,
    persistFavorites,
    persistHistory,
    persistProgress,
    persistSettings,
    persistTags,
    type ReadingProgress,
    updateComicProgress,
} from './data/service.js';
import { type AppTheme, THEMES, type ThemeName } from './theme/index.js';

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
    nightAlpha: number;
    downloadThreads: number;
    autocomplete: boolean;
}

export const DEFAULT_READER: ReaderSettings = {
    defaultMode: 'page',
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
    theme: 'blue',
    nightAlpha: 150,
    downloadThreads: 3,
    autocomplete: true,
};

// --- atoms ---
export const settingsAtom = atom<ReaderSettings>(DEFAULT_READER);
export const nightAtom = atom(false);
export const favoritesAtom = atom<string[]>([
    'comic-2',
    'comic-5',
    'comic-8',
    'comic-11',
    'comic-14',
    'comic-17',
    'comic-20',
    'comic-23',
    'comic-26',
]);
export const historyAtom = atom<string[]>([
    'comic-0',
    'comic-1',
    'comic-2',
    'comic-3',
    'comic-4',
    'comic-5',
    'comic-6',
    'comic-7',
]);
/** Custom user tags per comic id (Cimoc: 编辑标签). */
export const tagsAtom = atom<Record<string, string[]>>({});
/** 阅读进度：comicId -> 最后阅读章节与时间（用于“继续阅读”续读）。 */
export const progressAtom = atom<Record<string, ReadingProgress>>({});
/** Downloads queue: comicId -> list of chapter indexes. */
export const downloadsAtom = atom<Record<string, number[]>>({
    'comic-1': [0, 1, 2],
    'comic-4': [0, 1],
    'comic-9': [0],
});

/** Derived theme object combining the selected theme, night flag and alpha. */
export const themeAtom = atom<AppTheme>((get) => {
    const settings = get(settingsAtom);
    return {
        theme: THEMES[settings.theme],
        night: get(nightAtom),
        nightAlpha: settings.nightAlpha,
    };
});

// --- derived helpers ---
export function useIsFavorite(comicId: string): boolean {
    return useAtomValue(favoritesAtom).includes(comicId);
}

/** 从原生存储恢复状态（收藏/历史/设置/标签/下载/进度）。App 启动时调用一次。 */
export async function hydrateAppState(): Promise<void> {
    const store = getDefaultStore();
    const [favs, hist, st, tg, dl, prog] = await Promise.all([
        loadFavorites(),
        loadHistory(),
        loadSettings(),
        loadTags(),
        loadDownloads(),
        loadProgress(),
    ]);
    if (favs) store.set(favoritesAtom, favs);
    if (hist) store.set(historyAtom, hist);
    if (tg) store.set(tagsAtom, tg);
    if (dl) store.set(downloadsAtom, dl);
    if (prog) store.set(progressAtom, prog);
    if (st) {
        store.set(settingsAtom, (prev) => ({
            ...prev,
            ...(st as Partial<ReaderSettings>),
        }));
    }
}

export interface AppStore {
    settings: ReaderSettings;
    updateSettings: (patch: Partial<ReaderSettings>) => void;
    theme: AppTheme;
    setThemeName: (name: ThemeName) => void;
    setNight: (night: boolean) => void;
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
}

/** Convenience hook exposing the same API used across screens. */
export function useAppStore(): AppStore {
    const [settings, setSettings] = useAtom(settingsAtom);
    const setNight = useSetAtom(nightAtom);
    const [favorites, setFavorites] = useAtom(favoritesAtom);
    const [history, setHistory] = useAtom(historyAtom);
    const [tags, setTags] = useAtom(tagsAtom);
    const [downloads, setDownloads] = useAtom(downloadsAtom);
    const [progress, setProgress] = useAtom(progressAtom);
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
        setNight,
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
            const next = [comicId, ...history.filter((id) => id !== comicId)];
            setHistory(next);
            void persistHistory(next);
            if (chapterIndex !== undefined) {
                const now = Date.now();
                setProgress((prev) => ({
                    ...prev,
                    [comicId]: { chapter: chapterIndex, time: now },
                }));
                void persistProgress({
                    ...progress,
                    [comicId]: { chapter: chapterIndex, time: now },
                });
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
    };
}
