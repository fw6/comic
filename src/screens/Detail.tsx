import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import type { Chapter, Comic } from '../data/models.js';
import { loadChapters, loadComic } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function DetailScreen({
    nav,
    comicId,
}: {
    nav: NavApi;
    comicId: string;
}) {
    const store = useAppStore();
    const { theme } = store;
    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [reverse, setReverse] = useState(false);
    const [showIntro, setShowIntro] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [snack, setSnack] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            const c = await loadComic(comicId);
            const chs = await loadChapters(comicId);
            if (!cancelled) {
                setComic(c);
                setChapters(chs);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comicId]);

    if (loading) {
        return (
            <view
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fafafa',
                }}
            >
                <text style={{ fontSize: 15, color: '#999' }}>加载中...</text>
            </view>
        );
    }

    if (!comic) {
        return (
            <view
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <text>未找到漫画</text>
            </view>
        );
    }

    const ordered = reverse ? [...chapters].reverse() : chapters;
    const fav = store.isFavorite(comicId);

    const startReading = () => {
        const idx = comic.lastReadChapter;
        nav.push({
            name: 'reader',
            comicId: comic.id,
            chapterIndex: idx,
            mode: store.settings.defaultMode,
        });
    };

    const showSnack = (msg: string) => {
        setSnack(msg);
        // auto-hide via timeout is not available on background; hide on next tap
    };

    const menuItems = [
        {
            label: '下载',
            onTap: () => nav.push({ name: 'chapters', comicId: comic.id }),
        },
        {
            label: '编辑标签',
            onTap: () => nav.push({ name: 'tagEditor', comicId: comic.id }),
        },
        {
            label: '搜索标题',
            onTap: () =>
                nav.push({ name: 'result', keyword: comic.title, sources: [] }),
        },
        {
            label: '搜索作者',
            onTap: () =>
                nav.push({
                    name: 'result',
                    keyword: comic.author,
                    sources: [],
                }),
        },
        {
            label: '分享漫画',
            onTap: () => {
                showSnack('已复制分享链接');
                setShowMenu(false);
            },
        },
        {
            label: '反转列表',
            onTap: () => {
                setReverse(!reverse);
                setShowMenu(false);
            },
        },
    ];

    return (
        <view style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <TopBar
                theme={theme}
                title={comic.title}
                onBack={() => nav.pop()}
                actions={
                    <>
                        <ToolbarAction
                            label="下载"
                            onTap={() =>
                                nav.push({
                                    name: 'chapters',
                                    comicId: comic.id,
                                })
                            }
                        />
                        <ToolbarAction
                            label="···"
                            onTap={() => setShowMenu(!showMenu)}
                        />
                    </>
                }
            />

            {/* Overflow menu (Cimoc toolbar menu) */}
            {showMenu ? (
                <view
                    style={{
                        position: 'absolute',
                        top: '88px',
                        right: '8px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        zIndex: 10,
                        minWidth: 140,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                >
                    {menuItems.map((item) => (
                        <view
                            key={item.label}
                            bindtap={() => item.onTap()}
                            style={{
                                paddingTop: '12px',
                                paddingBottom: '12px',
                                paddingLeft: '16px',
                                paddingRight: '16px',
                                borderBottomWidth: '1px',
                                borderBottomColor: '#f0f0f0',
                            }}
                        >
                            <text style={{ fontSize: '14px', color: '#333' }}>
                                {item.label}
                            </text>
                        </view>
                    ))}
                </view>
            ) : null}

            {/* Header */}
            <view
                style={{
                    flexDirection: 'row',
                    padding: 16,
                    backgroundColor: '#fff',
                }}
                bindlongpress={() => setShowIntro(true)}
            >
                <view style={{ width: 90, height: 120 }}>
                    <ComicCover
                        color={comic.cover}
                        title={comic.title}
                        image={
                            comic.cover.startsWith('http')
                                ? comic.cover
                                : undefined
                        }
                    />
                </view>
                <view
                    style={{
                        flex: 1,
                        marginLeft: '14px',
                        justifyContent: 'space-between',
                    }}
                >
                    <text
                        style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: '#212121',
                        }}
                    >
                        {comic.title}
                    </text>
                    <text style={{ fontSize: '13px', color: '#666' }}>
                        作者：{comic.author}
                    </text>
                    <text style={{ fontSize: '13px', color: '#666' }}>
                        图源：{comic.sourceTitle}
                    </text>
                    <text style={{ fontSize: '13px', color: '#666' }}>
                        状态：{comic.status === 'finish' ? '已完结' : '连载中'}
                    </text>
                    <text style={{ fontSize: '12px', color: '#999' }}>
                        更新：{comic.updateTime}
                    </text>
                </view>
            </view>

            {/* Intro */}
            <view
                style={{ padding: 16, backgroundColor: '#fff', marginTop: 1 }}
            >
                <text
                    style={{
                        fontSize: '14px',
                        color: '#444',
                        lineHeight: '20px',
                        textOverflow: 'ellipsis',
                    }}
                    text-maxline={'2'}
                >
                    {comic.intro}
                </text>
            </view>

            {/* Chapters */}
            <text
                style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#333',
                    padding: 12,
                }}
            >
                章节列表（{chapters.length}）
            </text>
            <List
                listId={`detail-${comicId}-${reverse ? 'r' : 'n'}`}
                listType="flow"
                spanCount={3}
                mainAxisGap={10}
                crossAxisGap={10}
                scrollOrientation="vertical"
                style={{ flex: 1, paddingLeft: '12px', paddingRight: 12 }}
            >
                {ordered.map((ch) => {
                    const isDownloaded = store.isDownloaded(comic.id, ch.index);
                    return (
                        <list-item item-key={`${ch.index}`} key={ch.index}>
                            <view
                                style={{
                                    backgroundColor: ch.read
                                        ? '#E3F2FD'
                                        : '#fff',
                                    borderRadius: '4px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    alignItems: 'center',
                                    borderWidth: '1px',
                                    borderColor: ch.read
                                        ? theme.theme.primary
                                        : '#eee',
                                }}
                                bindtap={() =>
                                    nav.push({
                                        name: 'reader',
                                        comicId: comic.id,
                                        chapterIndex: ch.index,
                                        mode: store.settings.defaultMode,
                                    })
                                }
                            >
                                <text
                                    style={{
                                        fontSize: '13px',
                                        color: ch.read
                                            ? theme.theme.primary
                                            : '#333',
                                    }}
                                >
                                    {ch.title}
                                </text>
                                {isDownloaded ? (
                                    <text
                                        style={{
                                            fontSize: '10px',
                                            color: '#43A047',
                                            marginTop: '2px',
                                        }}
                                    >
                                        ✓
                                    </text>
                                ) : null}
                            </view>
                        </list-item>
                    );
                })}
            </List>

            {/* Dual FABs: continue-reading above favorite */}
            <view style={{ position: 'absolute', right: '16px', bottom: 96 }}>
                <view
                    bindtap={startReading}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '24px',
                        backgroundColor: theme.theme.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.35)',
                    }}
                >
                    <text style={{ color: '#fff', fontSize: 20 }}>▶</text>
                </view>
            </view>
            <view
                bindtap={() => store.toggleFavorite(comicId)}
                style={{
                    position: 'absolute',
                    right: '16px',
                    bottom: '24px',
                    width: 56,
                    height: 56,
                    borderRadius: '28px',
                    backgroundColor: theme.theme.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.35)',
                }}
            >
                <text style={{ color: '#fff', fontSize: 24 }}>
                    {fav ? '❤' : '♡'}
                </text>
            </view>

            {/* Snackbar */}
            {snack ? (
                <view
                    style={{
                        position: 'absolute',
                        bottom: '100px',
                        alignSelf: 'center',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        paddingLeft: '20px',
                        paddingRight: '20px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        borderRadius: '4px',
                    }}
                >
                    <text style={{ color: '#fff', fontSize: 14 }}>{snack}</text>
                </view>
            ) : null}

            {/* Intro dialog */}
            {showIntro ? (
                <view
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 40,
                    }}
                    bindtap={() => setShowIntro(false)}
                >
                    <view
                        style={{
                            backgroundColor: '#fff',
                            borderRadius: '6px',
                            padding: 20,
                            maxWidth: 320,
                            width: '100%',
                        }}
                        bindtap={() => {}}
                    >
                        <text
                            style={{
                                fontSize: '17px',
                                fontWeight: '600',
                                marginBottom: '10px',
                            }}
                        >
                            {comic.title}
                        </text>
                        <text
                            style={{
                                fontSize: '14px',
                                color: '#444',
                                lineHeight: '22px',
                            }}
                        >
                            {comic.intro}
                        </text>
                    </view>
                </view>
            ) : null}
        </view>
    );
}
