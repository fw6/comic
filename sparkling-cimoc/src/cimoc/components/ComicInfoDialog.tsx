import { useEffect, useState } from '@lynx-js/react';
import type { Comic } from '../data/models.js';
import { loadChapters } from '../data/service.js';
import { useAppStore } from '../store.js';
import { FONT, FONT_SERIF, RADIUS } from '../theme/index.js';

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
    const store = useAppStore();
    const t = store.theme.tokens;
    const progress = store.getProgress(comic.id);
    // 章节号（话数）不是数组下标，需按 index 精确匹配
    const lastChapterIndex = progress?.chapter ?? comic.lastReadChapter ?? 0;
    const lastReadTime = progress?.time ?? comic.lastReadTime ?? 0;
    const [lastChapterTitle, setLastChapterTitle] = useState('-');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const chapters = await loadChapters(comic.id);
            if (!cancelled && chapters.length > 0) {
                const ch = chapters.find(
                    (c) => c.index === lastChapterIndex,
                );
                setLastChapterTitle(ch?.title ?? '-');
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comic.id, lastChapterIndex]);

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
            <text style={{ width: '100px', fontSize: FONT.body, color: t.textMut }}>
                {label}
            </text>
            <text style={{ flexGrow: 1, fontSize: FONT.body, color: t.text }}>
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
                backgroundColor: t.overlay,
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: '40px',
                paddingRight: '40px',
            }}
            bindtap={onClose}
        >
            <view
                style={{
                    backgroundColor: t.surfaceRaised,
                    borderRadius: RADIUS.lg,
                    padding: '20px',
                    width: '100%',
                }}
                bindtap={() => {}}
            >
                <text
                    style={{
                        fontSize: FONT.titleLg,
                        fontWeight: '600',
                        color: t.text,
                        ...FONT_SERIF,
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                    }}
                >
                    {comic.title}
                </text>
                {row('图源', comic.sourceTitle)}
                {row('状态', comic.status === 'finish' ? '已完结' : '连载中')}
                {row('当前章节', lastChapterTitle)}
                {row('最后阅读', formatReadTime(lastReadTime))}
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
                            backgroundColor: t.accent,
                            borderRadius: RADIUS.sm,
                            paddingLeft: '20px',
                            paddingRight: '20px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            marginRight: '12px',
                        }}
                    >
                        <text
                            style={{
                                color: t.onAccent,
                                fontSize: FONT.body,
                            }}
                        >
                            {actionLabel}
                        </text>
                    </view>
                    <view
                        bindtap={onClose}
                        style={{
                            backgroundColor: t.surfaceSunken,
                            borderRadius: RADIUS.sm,
                            paddingLeft: '20px',
                            paddingRight: '20px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                        }}
                    >
                        <text style={{ color: t.text, fontSize: FONT.body }}>
                            取消
                        </text>
                    </view>
                </view>
            </view>
        </view>
    );
}
