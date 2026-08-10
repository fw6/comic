import { List } from '@lynx-js/lynx-ui';
import { useEffect, useMemo, useState } from '@lynx-js/react';
import { ComicCard } from '../components/ComicCard.js';
import { ComicInfoDialog } from '../components/ComicInfoDialog.js';
import { Fab } from '../components/Fab.js';
import type { Comic, LibraryTab } from '../data/models.js';
import {
    listDownloadedComics,
    loadComic,
    scanLocalComics,
} from '../data/service.js';
import { pickFolder } from '../native/bridge.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

const TABS: { key: LibraryTab; label: string }[] = [
    { key: 'history', label: '历史' },
    { key: 'favorite', label: '收藏' },
    { key: 'download', label: '下载' },
    { key: 'local', label: '本地' },
];

async function loadComicsByIds(ids: string[]): Promise<Comic[]> {
    const comics: Comic[] = [];
    for (const id of ids) {
        const c = await loadComic(id);
        if (c) comics.push(c);
    }
    return comics;
}

function TabContent({
    tab,
    nav,
    favFilter,
}: {
    tab: LibraryTab;
    nav: NavApi;
    favFilter: string; // '' = all, '完结'/'连载' or a user tag
}) {
    const store = useAppStore();
    const { theme } = store;
    const [infoComic, setInfoComic] = useState<Comic | null>(null);
    const [fabState, setFabState] = useState(false);
    const [comics, setComics] = useState<Comic[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            let ids: string[] = [];
            if (tab === 'history') {
                ids = store.history;
            } else if (tab === 'favorite') {
                ids = store.favorites;
            } else if (tab === 'download') {
                const dl = await listDownloadedComics();
                ids = Object.keys(dl);
            } else {
                const local = await scanLocalComics();
                ids = local.map((l) => l.comicId);
            }
            const list = await loadComicsByIds(ids);
            if (!cancelled) {
                setComics(list);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [tab, store.history, store.favorites, store.downloads]);

    let fab = '';
    let fabAction: () => void = () => {};

    if (tab === 'history') {
        fab = '🗑';
        fabAction = () => {
            for (const id of store.history) store.removeHistory(id);
        };
    } else if (tab === 'favorite') {
        fab = '↻';
        fabAction = () => {};
    } else if (tab === 'download') {
        fab = fabState ? '▶' : '⏸';
        fabAction = () => setFabState(!fabState);
    } else {
        fab = '＋';
        fabAction = () => {
            void pickFolder().catch(() => {});
        };
    }

    let display = comics;
    if (tab === 'favorite') {
        if (favFilter === '完结' || favFilter === '连载') {
            display = display.filter(
                (c) =>
                    c.status === (favFilter === '完结' ? 'finish' : 'serial'),
            );
        } else if (favFilter) {
            display = display.filter((c) =>
                store.getTags(c.id).includes(favFilter),
            );
        }
    }

    // Per-tab action for the info dialog.
    let dialogAction = '';
    let onDialogAction = () => {};
    if (infoComic) {
        if (tab === 'history') {
            dialogAction = '删除';
            onDialogAction = () => {
                store.removeHistory(infoComic.id);
                setInfoComic(null);
            };
        } else if (tab === 'favorite') {
            dialogAction = '取消收藏';
            onDialogAction = () => {
                store.toggleFavorite(infoComic.id);
                setInfoComic(null);
            };
        } else if (tab === 'download') {
            dialogAction = '删除';
            onDialogAction = () => {
                store.removeDownload(infoComic.id);
                setInfoComic(null);
            };
        } else {
            dialogAction = '删除';
            onDialogAction = () => setInfoComic(null);
        }
    }

    return (
        <view
            style={{
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                alignItems: 'stretch',
            }}
        >
            {loading ? (
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <text style={{ fontSize: '15px', color: '#999' }}>
                        加载中...
                    </text>
                </view>
            ) : (
                <List
                    listId={`library-${tab}`}
                    listType="flow"
                    spanCount={3}
                    mainAxisGap={12}
                    crossAxisGap={12}
                    scrollOrientation="vertical"
                    style={{ flexGrow: 1, padding: '12px' }}
                >
                    {display.map((comic) => (
                        <list-item item-key={comic.id} key={comic.id}>
                            <ComicCard
                                comic={comic}
                                onTap={() =>
                                    tab === 'download'
                                        ? nav.push({
                                              name: 'task',
                                              comicId: comic.id,
                                          })
                                        : nav.push({
                                              name: 'detail',
                                              comicId: comic.id,
                                          })
                                }
                                onLongPress={() => setInfoComic(comic)}
                                badge={
                                    tab === 'favorite'
                                        ? comic.status === 'serial'
                                            ? '连载'
                                            : '完结'
                                        : undefined
                                }
                            />
                        </list-item>
                    ))}
                </List>
            )}
            <Fab theme={theme} onTap={fabAction} label={fab} />
            {infoComic ? (
                <ComicInfoDialog
                    comic={infoComic}
                    actionLabel={dialogAction}
                    onAction={onDialogAction}
                    onClose={() => setInfoComic(null)}
                />
            ) : null}
        </view>
    );
}

export function LibraryScreen({
    nav,
    onOpenDrawer,
}: {
    nav: NavApi;
    onOpenDrawer: () => void;
}) {
    const store = useAppStore();
    const { theme } = store;
    // Cimoc: 启动画面 = the tab opened on app launch.
    const [tab, setTab] = useState<LibraryTab>(store.settings.startupScreen);
    const [favFilter, setFavFilter] = useState('');
    const activeIdx = TABS.findIndex((t) => t.key === tab);

    // Cimoc PartFavorite: filter chips = 全部 / 完结 / 连载 + user tags.
    const favoriteTags = useMemo(() => {
        const set = new Set<string>();
        for (const comicId of store.favorites) {
            for (const t of store.getTags(comicId)) set.add(t);
        }
        return [...set];
    }, [store.favorites, store.tags]);

    const chips = ['全部', '完结', '连载', ...favoriteTags];

    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#fafafa',
            }}
        >
            <view
                style={{
                    alignItems: 'stretch',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.theme.primary,
                    paddingLeft: '12px',
                    paddingRight: '12px',
                }}
            >
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: '64px',
                    }}
                >
                    <view
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '44px',
                            height: '44px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        bindtap={onOpenDrawer}
                    >
                        <text style={{ color: '#fff', fontSize: '22px' }}>
                            ☰
                        </text>
                    </view>
                    <text
                        style={{
                            flexGrow: 1,
                            color: '#fff',
                            fontSize: '20px',
                            fontWeight: '600',
                        }}
                    >
                        漫画
                    </text>
                </view>
                {/* TabLayout */}
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        height: '44px',
                    }}
                >
                    {TABS.map((t, i) => (
                        <view
                            key={t.key}
                            bindtap={() => setTab(t.key)}
                            style={{
                                flexGrow: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderBottomWidth: '2px',
                                borderBottomColor:
                                    i === activeIdx ? '#fff' : 'transparent',
                            }}
                        >
                            <text
                                style={{
                                    color:
                                        i === activeIdx
                                            ? '#fff'
                                            : 'rgba(255,255,255,0.75)',
                                    fontSize: '15px',
                                    fontWeight: i === activeIdx ? '600' : '400',
                                }}
                            >
                                {t.label}
                            </text>
                        </view>
                    ))}
                </view>
            </view>
            {/* Favorites tag/status filter (Cimoc PartFavorite) */}
            {tab === 'favorite' && chips.length > 1 ? (
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        padding: '8px',
                        backgroundColor: '#fff',
                        borderBottomWidth: '1px',
                        borderBottomColor: '#eee',
                    }}
                >
                    {chips.map((c) => {
                        const active = c === favFilter;
                        return (
                            <view
                                key={c}
                                bindtap={() => setFavFilter(active ? '' : c)}
                                style={{
                                    backgroundColor: active
                                        ? theme.theme.primary
                                        : '#f0f0f0',
                                    borderRadius: '12px',
                                    paddingLeft: '10px',
                                    paddingRight: '10px',
                                    paddingTop: '3px',
                                    paddingBottom: '3px',
                                    marginRight: '8px',
                                }}
                            >
                                <text
                                    style={{
                                        color: active ? '#fff' : '#555',
                                        fontSize: '12px',
                                    }}
                                >
                                    {c}
                                </text>
                            </view>
                        );
                    })}
                </view>
            ) : null}
            <TabContent tab={tab} nav={nav} favFilter={favFilter} />
        </view>
    );
}
