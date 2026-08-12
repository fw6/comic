import { Button, Checkbox, List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { Screen } from '../components/Screen.js';
import { Snackbar } from '../components/Snackbar.js';
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
    const t = theme.tokens;
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
        <Screen theme={theme}>
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
                style={{ flexGrow: 1 }}
            >
                {chapters.map((ch) => {
                    const isDownloaded = store.isDownloaded(comicId, ch.index);
                    return (
                        <list-item item-key={`${ch.index}`} key={ch.index}>
                            <view
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: t.surface,
                                    paddingTop: '14px',
                                    paddingBottom: '14px',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    borderBottomWidth: '1px',
                                    borderBottomColor: t.hairline,
                                }}
                                bindtap={() => toggle(ch.index)}
                            >
                                <Checkbox
                                    checked={!!selected[ch.index]}
                                    onChange={() => toggle(ch.index)}
                                />
                                <text
                                    style={{
                                        flexGrow: 1,
                                        marginLeft: '12px',
                                        fontSize: '15px',
                                        color: t.text,
                                    }}
                                >
                                    {ch.title}
                                </text>
                                {isDownloaded ? (
                                    <text
                                        style={{
                                            fontSize: '12px',
                                            color: t.success,
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
                    padding: '16px',
                    backgroundColor: t.surface,
                    borderTopWidth: '1px',
                    borderTopColor: t.hairline,
                }}
            >
                <Button
                    disabled={selectedCount === 0 || downloading}
                    onClick={() => void startDownload()}
                >
                    {downloading ? '下载中...' : `开始下载（${selectedCount}）`}
                </Button>
            </view>
            {msg ? <Snackbar theme={theme} message={msg} /> : null}
        </Screen>
    );
}
