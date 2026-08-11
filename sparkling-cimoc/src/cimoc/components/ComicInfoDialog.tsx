import { useEffect, useState } from '@lynx-js/react';
import type { Comic } from '../data/models.js';
import { loadChapters } from '../data/service.js';

function formatReadTime(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Cimoc 的漫画长按信息弹窗：标题/图源/状态/当前章节/最后阅读时间。
 */
export function ComicInfoDialog({
    comic,
    actionLabel,
    onAction,
    onClose,
}: {
    comic: Comic;
    actionLabel: string;
    onAction: () => void;
    onClose: () => void;
}) {
    const [lastChapterTitle, setLastChapterTitle] = useState('-');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const chapters = await loadChapters(comic.id);
            if (!cancelled && chapters.length > 0) {
                const idx = Math.min(
                    comic.lastReadChapter,
                    chapters.length - 1,
                );
                setLastChapterTitle(chapters[idx]?.title ?? '-');
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comic.id]);

    const row = (label: string, value: string) => (
        <view
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                paddingTop: '6px',
                paddingBottom: '6px',
            }}
        >
            <text style={{ width: '100px', fontSize: '14px', color: '#999' }}>
                {label}
            </text>
            <text style={{ flexGrow: 1, fontSize: '14px', color: '#212121' }}>
                {value}
            </text>
        </view>
    );

    return (
        <view
            style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: '40px',
                paddingRight: '40px',
            }}
            bindtap={onClose}
        >
            <view
                style={{
                    backgroundColor: '#fff',
                    borderRadius: '6px',
                    padding: '20px',
                    width: '100%',
                }}
                bindtap={() => {}}
            >
                <text
                    style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#212121',
                        marginBottom: '8px',
                    }}
                >
                    {comic.title}
                </text>
                {row('图源', comic.sourceTitle)}
                {row('状态', comic.status === 'finish' ? '已完结' : '连载中')}
                {row('当前章节', lastChapterTitle)}
                {row('最后阅读', formatReadTime(comic.lastReadTime))}
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        marginTop: '12px',
                    }}
                >
                    <view
                        bindtap={onAction}
                        style={{
                            backgroundColor: '#E53935',
                            borderRadius: '4px',
                            paddingLeft: '20px',
                            paddingRight: '20px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            marginRight: '12px',
                        }}
                    >
                        <text style={{ color: '#fff', fontSize: '14px' }}>
                            {actionLabel}
                        </text>
                    </view>
                    <view
                        bindtap={onClose}
                        style={{
                            backgroundColor: '#eee',
                            borderRadius: '4px',
                            paddingLeft: '20px',
                            paddingRight: '20px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                        }}
                    >
                        <text style={{ color: '#212121', fontSize: '14px' }}>
                            取消
                        </text>
                    </view>
                </view>
            </view>
        </view>
    );
}
