import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { TopBar } from '../components/TopBar.js';
import type { Chapter, Comic } from '../data/models.js';
import {
    listDownloadedComics,
    loadChapters,
    loadComic,
} from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

// Cimoc TaskActivity：已下载漫画的章节列表，用于离线阅读入口。
export function TaskScreen({ nav, comicId }: { nav: NavApi; comicId: string }) {
    const store = useAppStore();
    const { theme } = store;
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
            <view
                style={{
                    flex: 1,
                    backgroundColor: '#fafafa',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <text style={{ fontSize: '15px', color: '#999' }}>
                    加载中...
                </text>
            </view>
        );
    }

    return (
        <view style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <TopBar
                theme={theme}
                title={`${comic.title} · 已下载`}
                onBack={() => nav.pop()}
            />
            <view
                style={{
                    flexDirection: 'row',
                    padding: 16,
                    backgroundColor: '#fff',
                }}
            >
                <view style={{ width: 56, height: 74 }}>
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
                        marginLeft: '12px',
                        justifyContent: 'center',
                    }}
                >
                    <text
                        style={{
                            fontSize: '17px',
                            fontWeight: '600',
                            color: '#212121',
                        }}
                    >
                        {comic.title}
                    </text>
                    <text
                        style={{
                            fontSize: '13px',
                            color: '#999',
                            marginTop: 4,
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
                style={{ flex: 1 }}
            >
                {downloaded.map((idx) => (
                    <list-item item-key={`${idx}`} key={idx}>
                        <view
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 14,
                                backgroundColor: '#fff',
                                borderBottomWidth: '1px',
                                borderBottomColor: '#f0f0f0',
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
                            <text
                                style={{ fontSize: '12px', color: '#43A047' }}
                            >
                                ✓
                            </text>
                            <text
                                style={{
                                    flex: 1,
                                    marginLeft: '10px',
                                    fontSize: '15px',
                                    color: '#212121',
                                }}
                            >
                                {chapters.find((c) => c.index === idx)?.title ??
                                    `第${idx}话`}
                            </text>
                        </view>
                    </list-item>
                ))}
            </List>
        </view>
    );
}
