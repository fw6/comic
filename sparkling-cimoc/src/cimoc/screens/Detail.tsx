import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { EmptyState } from '../components/EmptyState.js';
import { Screen } from '../components/Screen.js';
import { Snackbar } from '../components/Snackbar.js';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import type { Chapter, Comic } from '../data/models.js';
import { loadChapters, loadComic } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF, RADIUS } from '../theme/index.js';

export function DetailScreen({
    nav,
    comicId,
}: {
    nav: NavApi;
    comicId: string;
}) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
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
            <Screen theme={theme}>
                <EmptyState theme={theme} text="加载中..." glyph="📖" />
            </Screen>
        );
    }

    if (!comic) {
        return (
            <Screen theme={theme}>
                <EmptyState theme={theme} text="未找到漫画" glyph="❓" />
            </Screen>
        );
    }

    const ordered = reverse ? [...chapters].reverse() : chapters;
    const fav = store.isFavorite(comicId);

    const startReading = () => {
        // 优先从持久化的阅读进度续读，其次回退到漫画缓存的最后章节
        const idx =
            store.getProgress(comicId)?.chapter ??
            comic.lastReadChapter ??
            0;
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
                nav.push({
                    name: 'result',
                    keyword: comic.title,
                    sources: [],
                    mode: 'search',
                }),
        },
        {
            label: '搜索作者',
            onTap: () =>
                nav.push({
                    name: 'result',
                    keyword: comic.author,
                    sources: [],
                    mode: 'search',
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
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title={comic.title}
                onBack={() => nav.pop()}
                actions={
                    <>
                        <ToolbarAction
                            theme={theme}
                            label="下载"
                            onTap={() =>
                                nav.push({
                                    name: 'chapters',
                                    comicId: comic.id,
                                })
                            }
                        />
                        <ToolbarAction
                            theme={theme}
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
                        backgroundColor: t.surfaceRaised,
                        borderRadius: RADIUS.sm,
                        zIndex: 10,
                        minWidth: '140px',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
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
                                borderBottomColor: t.hairline,
                            }}
                        >
                            <text
                                style={{ fontSize: '14px', color: t.text }}
                            >
                                {item.label}
                            </text>
                        </view>
                    ))}
                </view>
            ) : null}

            {/* Header */}
            <view
                style={{
                    alignItems: 'stretch',
                    display: 'flex',
                    flexDirection: 'row',
                    padding: '16px',
                    backgroundColor: t.surface,
                    borderBottomWidth: '1px',
                    borderBottomColor: t.hairline,
                }}
                bindlongpress={() => setShowIntro(true)}
            >
                <view
                    style={{
                        width: '90px',
                        height: '120px',
                        boxShadow:
                            theme.mode === 'ink'
                                ? '0 4px 12px rgba(0,0,0,0.45)'
                                : '0 2px 8px rgba(60,40,20,0.16)',
                    }}
                >
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
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        marginLeft: '14px',
                        justifyContent: 'space-between',
                    }}
                >
                    <text
                        style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: t.text,
                            ...FONT_SERIF,
                            letterSpacing: '0.5px',
                        }}
                    >
                        {comic.title}
                    </text>
                    <text style={{ fontSize: '13px', color: t.textSub }}>
                        作者：{comic.author}
                    </text>
                    <text style={{ fontSize: '13px', color: t.textSub }}>
                        图源：{comic.sourceTitle}
                    </text>
                    <view
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <view
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '3px',
                                backgroundColor:
                                    comic.status === 'finish'
                                        ? t.textMut
                                        : t.accent,
                                marginRight: '5px',
                            }}
                        />
                        <text style={{ fontSize: '13px', color: t.textSub }}>
                            {comic.status === 'finish' ? '已完结' : '连载中'}
                        </text>
                    </view>
                    <text style={{ fontSize: '12px', color: t.textMut }}>
                        更新：{comic.updateTime}
                    </text>
                </view>
            </view>

            {/* Intro */}
            <view
                style={{
                    padding: '16px',
                    backgroundColor: t.surface,
                    marginTop: '1px',
                }}
            >
                <text
                    style={{
                        fontSize: '14px',
                        color: t.textSub,
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
                    color: t.text,
                    padding: '12px',
                    ...FONT_SERIF,
                    letterSpacing: '1px',
                }}
            >
                章节列表
                <text style={{ color: t.accent }}>（{chapters.length}）</text>
            </text>
            <List
                listId={`detail-${comicId}-${reverse ? 'r' : 'n'}`}
                listType="flow"
                spanCount={3}
                mainAxisGap={10}
                crossAxisGap={10}
                scrollOrientation="vertical"
                style={{
                    flexGrow: 1,
                    paddingLeft: '12px',
                    paddingRight: '12px',
                }}
            >
                {ordered.map((ch) => {
                    const isDownloaded = store.isDownloaded(comic.id, ch.index);
                    return (
                        <list-item item-key={`${ch.index}`} key={ch.index}>
                            {/* 卷标式章节卡：已读 = 强调色书脊 + 淡印面 */}
                            <view
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    backgroundColor: ch.read
                                        ? t.accentSoft
                                        : t.surface,
                                    borderRadius: RADIUS.sm,
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    alignItems: 'center',
                                    borderWidth: '1px',
                                    borderColor: ch.read
                                        ? t.accent
                                        : t.hairline,
                                    overflow: 'hidden',
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
                                <view
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '3px',
                                        backgroundColor: ch.read
                                            ? t.accent
                                            : 'transparent',
                                    }}
                                />
                                <text
                                    style={{
                                        flexGrow: 1,
                                        fontSize: '13px',
                                        color: ch.read ? t.accent : t.text,
                                        textAlign: 'center',
                                        paddingLeft: '3px',
                                    }}
                                >
                                    {ch.title}
                                </text>
                                {isDownloaded ? (
                                    <text
                                        style={{
                                            position: 'absolute',
                                            right: '5px',
                                            bottom: '3px',
                                            fontSize: '10px',
                                            color: t.success,
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
            <view
                style={{ position: 'absolute', right: '16px', bottom: '96px' }}
            >
                <view
                    bindtap={startReading}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '48px',
                        height: '48px',
                        borderRadius: '24px',
                        backgroundColor: t.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow:
                            theme.mode === 'ink'
                                ? '0 6px 16px rgba(0,0,0,0.5)'
                                : '0 6px 16px rgba(60,40,20,0.28)',
                    }}
                >
                    <text style={{ color: t.onAccent, fontSize: '20px' }}>
                        ▶
                    </text>
                </view>
            </view>
            <view
                bindtap={() => store.toggleFavorite(comicId)}
                style={{
                    position: 'absolute',
                    right: '16px',
                    bottom: '24px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '28px',
                    backgroundColor: fav ? t.accent : t.surfaceRaised,
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow:
                        theme.mode === 'ink'
                            ? '0 6px 16px rgba(0,0,0,0.5)'
                            : '0 6px 16px rgba(60,40,20,0.28)',
                }}
            >
                <text
                    style={{
                        color: fav ? t.onAccent : t.accent,
                        fontSize: '24px',
                    }}
                >
                    {fav ? '❤' : '♡'}
                </text>
            </view>

            {/* Snackbar */}
            {snack ? <Snackbar theme={theme} message={snack} /> : null}

            {/* Intro dialog */}
            {showIntro ? (
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: t.overlay,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                    }}
                    bindtap={() => setShowIntro(false)}
                >
                    <view
                        style={{
                            backgroundColor: t.surfaceRaised,
                            borderRadius: RADIUS.lg,
                            padding: '20px',
                            maxWidth: '320px',
                            width: '100%',
                        }}
                        bindtap={() => {}}
                    >
                        <text
                            style={{
                                fontSize: '17px',
                                fontWeight: '600',
                                color: t.text,
                                ...FONT_SERIF,
                                letterSpacing: '0.5px',
                                marginBottom: '10px',
                            }}
                        >
                            {comic.title}
                        </text>
                        <text
                            style={{
                                fontSize: '14px',
                                color: t.textSub,
                                lineHeight: '22px',
                            }}
                        >
                            {comic.intro}
                        </text>
                    </view>
                </view>
            ) : null}
        </Screen>
    );
}
