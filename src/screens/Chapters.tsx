import { Button, Checkbox, List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { TopBar } from '../components/TopBar.js';
import type { Chapter, Comic } from '../data/models.js';
import {
    downloadChapter,
    loadChapterImages,
    loadChapters,
    loadComic,
} from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function ChaptersScreen({
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
    const [selected, setSelected] = useState<Record<number, boolean>>({});
    const [downloading, setDownloading] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const c = await loadComic(comicId);
            const chs = await loadChapters(comicId);
            if (!cancelled) {
                setComic(c);
                setChapters(chs);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comicId]);

    const selectedCount = Object.values(selected).filter(Boolean).length;

    const toggle = (index: number) =>
        setSelected((prev) => ({ ...prev, [index]: !prev[index] }));

    const startDownload = async () => {
        const indexes = Object.keys(selected)
            .filter((k) => selected[Number(k)])
            .map((k) => Number(k));
        if (indexes.length === 0) return;
        setDownloading(true);
        let ok = true;
        for (const idx of indexes) {
            const imgs = await loadChapterImages(comicId, idx);
            const done = await downloadChapter(comicId, idx, imgs);
            if (!done) ok = false;
            if (done) store.addDownload(comicId, [idx]);
        }
        setDownloading(false);
        setMsg(ok ? `已下载 ${indexes.length} 话` : '部分下载失败，请检查网络');
        nav.pop();
    };

    return (
        <view style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <TopBar
                theme={theme}
                title={`下载 · ${comic?.title ?? ''}`}
                onBack={() => nav.pop()}
            />
            <List
                listId={`chapters-${comicId}`}
                listType="single"
                spanCount={1}
                scrollOrientation="vertical"
                style={{ flex: 1 }}
            >
                {chapters.map((ch) => {
                    const isDownloaded = store.isDownloaded(comicId, ch.index);
                    return (
                        <list-item item-key={`${ch.index}`} key={ch.index}>
                            <view
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#fff',
                                    paddingTop: '14px',
                                    paddingBottom: '14px',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    borderBottomWidth: '1px',
                                    borderBottomColor: '#f0f0f0',
                                }}
                                bindtap={() => toggle(ch.index)}
                            >
                                <Checkbox
                                    checked={!!selected[ch.index]}
                                    onChange={() => toggle(ch.index)}
                                />
                                <text
                                    style={{
                                        flex: 1,
                                        marginLeft: '12px',
                                        fontSize: '15px',
                                        color: '#212121',
                                    }}
                                >
                                    {ch.title}
                                </text>
                                {isDownloaded ? (
                                    <text
                                        style={{
                                            fontSize: '12px',
                                            color: '#43A047',
                                        }}
                                    >
                                        已下载
                                    </text>
                                ) : null}
                            </view>
                        </list-item>
                    );
                })}
            </List>
            <view
                style={{
                    padding: 16,
                    backgroundColor: '#fff',
                    borderTopWidth: '1px',
                    borderTopColor: '#eee',
                }}
            >
                <Button
                    disabled={selectedCount === 0 || downloading}
                    onClick={() => void startDownload()}
                >
                    {downloading ? '下载中...' : `开始下载（${selectedCount}）`}
                </Button>
            </view>
            {msg ? (
                <view
                    style={{
                        position: 'absolute',
                        bottom: '80px',
                        alignSelf: 'center',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        paddingLeft: '20px',
                        paddingRight: '20px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        borderRadius: '4px',
                    }}
                >
                    <text style={{ color: '#fff', fontSize: '14px' }}>
                        {msg}
                    </text>
                </view>
            ) : null}
        </view>
    );
}
