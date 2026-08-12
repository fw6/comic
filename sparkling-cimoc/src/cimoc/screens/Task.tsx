import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { EmptyState } from '../components/EmptyState.js';
import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import type { Chapter, Comic } from '../data/models.js';
import {
    listDownloadedComics,
    loadChapters,
    loadComic,
} from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF } from '../theme/index.js';

// Cimoc TaskActivity：已下载漫画的章节列表，用于离线阅读入口。
export function TaskScreen({ nav, comicId }: { nav: NavApi; comicId: string }) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [downloaded, setDownloaded] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const c = await loadComic(comicId);
            const chs = await loadChapters(comicId);
            const dl = await listDownloadedComics();
            if (!cancelled) {
                setComic(c);
                setChapters(chs);
                setDownloaded(dl[comicId] ?? []);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comicId]);

    if (loading || !comic) {
        return (
            <Screen theme={theme}>
                <EmptyState theme={theme} text="加载中..." glyph="📖" />
            </Screen>
        );
    }

    return (
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title={`${comic.title} · 已下载`}
                onBack={() => nav.pop()}
            />
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
            >
                <view
                    style={{
                        width: '56px',
                        height: '74px',
                        boxShadow:
                            theme.mode === 'ink'
                                ? '0 4px 12px rgba(0,0,0,0.4)'
                                : '0 2px 8px rgba(60,40,20,0.14)',
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
                        marginLeft: '12px',
                        justifyContent: 'center',
                    }}
                >
                    <text
                        style={{
                            fontSize: '17px',
                            fontWeight: '600',
                            color: t.text,
                            ...FONT_SERIF,
                            letterSpacing: '0.5px',
                        }}
                    >
                        {comic.title}
                    </text>
                    <text
                        style={{
                            fontSize: '13px',
                            color: t.textSub,
                            marginTop: '4px',
                        }}
                    >
                        已下载 {downloaded.length} 话
                    </text>
                </view>
            </view>
            <List
                listId={`task-${comicId}`}
                listType="single"
                spanCount={1}
                scrollOrientation="vertical"
                style={{ flexGrow: 1 }}
            >
                {downloaded.map((idx) => (
                    <list-item item-key={`${idx}`} key={idx}>
                        <view
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: '14px',
                                backgroundColor: t.surface,
                                borderBottomWidth: '1px',
                                borderBottomColor: t.hairline,
                            }}
                            bindtap={() =>
                                nav.push({
                                    name: 'reader',
                                    comicId: comic.id,
                                    chapterIndex: idx,
                                    mode: store.settings.defaultMode,
                                })
                            }
                        >
                            <text style={{ fontSize: '12px', color: t.success }}>
                                ✓
                            </text>
                            <text
                                style={{
                                    flexGrow: 1,
                                    marginLeft: '10px',
                                    fontSize: '15px',
                                    color: t.text,
                                }}
                            >
                                {chapters.find((c) => c.index === idx)?.title ??
                                    `第${idx}话`}
                            </text>
                        </view>
                    </list-item>
                ))}
            </List>
        </Screen>
    );
}
