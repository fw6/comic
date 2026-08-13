import {
    SliderIndicator,
    SliderRoot,
    SliderThumb,
    SliderTrack,
    Swiper,
    SwiperItem,
    screenHeight,
    screenWidth,
} from '@lynx-js/lynx-ui';
import { useEffect, useMemo, useState } from '@lynx-js/react';
import { useEdgeBackGesture } from '../components/edgeBackGesture.js';
import type { Chapter, Comic } from '../data/models.js';
import {
    downloadChapter,
    loadChapterImages,
    loadChapters,
    loadComic,
} from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF, RADIUS } from '../theme/index.js';

function currentClock(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PageImage({ src }: { src: string }) {
    // 真实图源图片 URL 直接加载（无 mock 占位）
    return (
        <image
            src={src}
            mode="aspectFit"
            style={{ width: '100%', height: '100%' }}
        />
    );
}

/**
 * 卷纸模式单图：宽度 100%。bindload 拿到图片自然尺寸后按宽高比撑满，
 * 测量前用 600px 兜底（aspectFit 不裁切）。
 */
function StreamImage({
    src,
    aspect,
    onMeasure,
}: {
    src: string;
    aspect?: number; // 高/宽
    onMeasure: (src: string, w: number, h: number) => void;
}) {
    return (
        <view
            style={{
                width: '100%',
                height:
                    aspect !== undefined
                        ? `${Math.round(screenWidth * aspect)}px`
                        : '600px',
                backgroundColor: '#101014',
            }}
        >
            <image
                src={src}
                mode="aspectFit"
                style={{ width: '100%', height: '100%' }}
                bindload={(e) => onMeasure(src, e.detail.width, e.detail.height)}
            />
        </view>
    );
}

/** 卷纸流中已加载的一话 */
interface FeedEntry {
    chapter: number;
    images: string[];
}

export function ReaderScreen({
    nav,
    comicId,
    chapterIndex,
    mode,
}: {
    nav: NavApi;
    comicId: string;
    chapterIndex: number;
    mode: 'page' | 'stream';
}) {
    const store = useAppStore();
    const { theme } = store;
    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [images, setImages] = useState<string[]>([]); // 翻页模式：当前话图片
    const [loading, setLoading] = useState(true);
    const [showHud, setShowHud] = useState(true);
    const [curChapter, setCurChapter] = useState(chapterIndex);
    const [curPage, setCurPage] = useState(0);
    const [clock, setClock] = useState(currentClock());
    const [downloading, setDownloading] = useState(false);

    // 卷纸模式：连续加载的章节流（无限滚动）
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const [feedEnded, setFeedEnded] = useState(false);
    const [aspects, setAspects] = useState<Record<string, number>>({});

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const c = await loadComic(comicId);
            const chs = await loadChapters(comicId);
            if (!cancelled) {
                setComic(c);
                setChapters(chs);
                if (chs.length === 0) setLoading(false); // 无章节可读，结束加载态
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comicId]);

    useEffect(() => {
        // record reading history + 进度（Cimoc 进入阅读器即自动记录）
        if (comic) store.recordHistory(comic.id, curChapter);
    }, [comic, curChapter]);

    useEffect(() => {
        // 翻页模式：加载当前章节图片
        if (mode !== 'page') return;
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            const imgs = await loadChapterImages(comicId, curChapter);
            if (!cancelled) {
                setImages(imgs);
                setCurPage(0);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comicId, curChapter, mode]);

    useEffect(() => {
        // 卷纸模式：章节就绪后把首话灌入流（切话时 feed 清空会重新触发）
        if (mode !== 'stream' || feed.length > 0) return;
        if (chapters.length === 0) return;
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            const imgs = await loadChapterImages(comicId, curChapter);
            if (!cancelled) {
                setFeed([{ chapter: curChapter, images: imgs }]);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [mode, comicId, curChapter, chapters.length, feed.length]);

    useEffect(() => {
        const id = setInterval(() => setClock(currentClock()), 30_000);
        return () => clearInterval(id);
    }, []);

    // 按话数排序，用作翻页边界与无限滚动的下一话解析（话数可能不连续）
    const sorted = useMemo(
        () => [...chapters].sort((a, b) => a.index - b.index),
        [chapters],
    );

    const chapterTitleOf = (idx: number) =>
        chapters.find((c) => c.index === idx)?.title ?? `第 ${idx} 话`;

    const nextIndexAfter = (idx: number): number | undefined => {
        const p = sorted.findIndex((c) => c.index === idx);
        return p >= 0 && p < sorted.length - 1
            ? sorted[p + 1].index
            : undefined;
    };
    const prevIndexBefore = (idx: number): number | undefined => {
        const p = sorted.findIndex((c) => c.index === idx);
        return p > 0 ? sorted[p - 1].index : undefined;
    };

    /** 卷纸模式：滑到底自动加载下一话（无限滚动） */
    const loadMore = async () => {
        if (mode !== 'stream' || loadingMore || feedEnded) return;
        const last = feed[feed.length - 1];
        if (!last) return;
        const next = nextIndexAfter(last.chapter);
        if (next === undefined) {
            setFeedEnded(true);
            return;
        }
        setLoadingMore(true);
        try {
            const imgs = await loadChapterImages(comicId, next);
            if (imgs.length === 0) {
                setFeedEnded(true);
                return;
            }
            setFeed((prev) => [...prev, { chapter: next, images: imgs }]);
            setCurChapter(next); // 进度/历史跟进到最新读到的话
        } finally {
            setLoadingMore(false);
        }
    };

    /** 切话：卷纸模式重置流到指定话；翻页模式走图片加载 effect */
    const switchChapter = (idx: number) => {
        if (idx === curChapter) return;
        if (mode === 'stream') {
            setFeed([]);
            setFeedEnded(false);
            setAspects({});
        }
        setCurChapter(idx);
    };

    const goPrevChapter = () => {
        const p = prevIndexBefore(curChapter);
        if (p !== undefined) switchChapter(p);
    };
    const goNextChapter = () => {
        const n = nextIndexAfter(curChapter);
        if (n !== undefined) switchChapter(n);
    };

    const doDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        const srcs =
            mode === 'stream'
                ? (feed.find((f) => f.chapter === curChapter)?.images ?? [])
                : images;
        const ok = await downloadChapter(comicId, curChapter, srcs);
        if (ok) store.addDownload(comicId, [curChapter]);
        setDownloading(false);
    };

    if (!comic) {
        return (
            <view
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    backgroundColor: theme.tokens.readerBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <text style={{ color: theme.tokens.textSub, fontSize: '15px' }}>
                    加载中...
                </text>
            </view>
        );
    }

    const chapterTitle = chapterTitleOf(curChapter);
    const readerBg = store.settings.whiteBackground
        ? '#FFFFFF'
        : theme.tokens.readerBg;

    const toggleHud = () => setShowHud(!showHud);

    // 左缘右滑返回：卷纸模式（横向无交互）始终可用；
    // 翻页模式仅在第 0 页（左滑无上一页可翻）时接管，其余页交给 Swiper 翻页。
    const edgeBack = useEdgeBackGesture(
        () => nav.pop(),
        mode === 'stream' || (mode === 'page' && curPage === 0),
    );

    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                backgroundColor: readerBg,
            }}
            bindtap={toggleHud}
            bindtouchstart={edgeBack.bindtouchstart}
            bindtouchmove={edgeBack.bindtouchmove}
            bindtouchend={edgeBack.bindtouchend}
            bindtouchcancel={edgeBack.bindtouchcancel}
        >
            {/* Content */}
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
                    <text
                        style={{
                            color: theme.tokens.textMut,
                            fontSize: '15px',
                        }}
                    >
                        图片加载中...
                    </text>
                </view>
            ) : mode === 'page' ? (
                <Swiper
                    data={images}
                    itemWidth={screenWidth}
                    itemHeight={screenHeight}
                    containerWidth={screenWidth}
                    mode="normal"
                    modeConfig={{ align: 'center', spaceBetween: 0 }}
                    onChange={(current) => setCurPage(current)}
                    style={{ width: screenWidth, height: screenHeight }}
                >
                    {({ item }) => (
                        <SwiperItem>
                            <PageImage src={item} />
                        </SwiperItem>
                    )}
                </Swiper>
            ) : (
                /* 卷纸模式：上下滑动阅读，滑到底自动续下一话 */
                <scroll-view
                    scroll-orientation="vertical"
                    lower-threshold={240}
                    scroll-bar-enable={false}
                    bindscrolltolower={loadMore}
                    style={{
                        flexGrow: 1,
                        width: '100%',
                        backgroundColor: readerBg,
                    }}
                >
                    {feed.map((entry, fi) => (
                        <view key={entry.chapter}>
                            {fi > 0 ? (
                                <view
                                    style={{
                                        alignItems: 'center',
                                        paddingTop: '20px',
                                        paddingBottom: '20px',
                                    }}
                                >
                                    <view
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingLeft: '12px',
                                            paddingRight: '12px',
                                            paddingTop: '4px',
                                            paddingBottom: '4px',
                                            borderRadius: RADIUS.pill,
                                            backgroundColor:
                                                theme.tokens.accentSoft,
                                        }}
                                    >
                                        <text
                                            style={{
                                                fontSize: '12px',
                                                color: theme.tokens.accent,
                                                ...FONT_SERIF,
                                                letterSpacing: '1px',
                                            }}
                                        >
                                            {chapterTitleOf(entry.chapter)}
                                        </text>
                                    </view>
                                </view>
                            ) : null}
                            {entry.images.map((src) => (
                                <StreamImage
                                    key={src}
                                    src={src}
                                    aspect={aspects[src]}
                                    onMeasure={(s, w, h) => {
                                        if (w > 0 && h > 0) {
                                            setAspects((prev) =>
                                                prev[s] === h / w
                                                    ? prev
                                                    : { ...prev, [s]: h / w },
                                            );
                                        }
                                    }}
                                />
                            ))}
                        </view>
                    ))}
                    {loadingMore ? (
                        <view
                            style={{
                                alignItems: 'center',
                                paddingTop: '16px',
                                paddingBottom: '16px',
                            }}
                        >
                            <text
                                style={{
                                    color: theme.tokens.textMut,
                                    fontSize: '13px',
                                }}
                            >
                                加载下一话…
                            </text>
                        </view>
                    ) : null}
                    {feedEnded ? (
                        <view
                            style={{
                                alignItems: 'center',
                                paddingTop: '16px',
                                paddingBottom: '32px',
                            }}
                        >
                            <text
                                style={{
                                    color: theme.tokens.textMut,
                                    fontSize: '13px',
                                }}
                            >
                                已读完最后一话
                            </text>
                        </view>
                    ) : null}
                </scroll-view>
            )}

            {/* HUD */}
            {showHud ? (
                <view
                    style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                >
                    <view
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            height: '64px',
                            paddingTop: '20px',
                            paddingLeft: '12px',
                            paddingRight: '12px',
                        }}
                    >
                        <view
                            style={{
                                alignItems: 'stretch',
                                display: 'flex',
                                flexDirection: 'column',
                                width: '44px',
                                height: '44px',
                                justifyContent: 'center',
                            }}
                            bindtap={(e) => {
                                e.stopPropagation?.();
                                nav.pop();
                            }}
                        >
                            <text style={{ color: '#fff', fontSize: '28px' }}>
                                ‹
                            </text>
                        </view>
                        <text
                            style={{
                                flexGrow: 1,
                                color: '#fff',
                                fontSize: '16px',
                                marginLeft: '8px',
                                textOverflow: 'ellipsis',
                                ...FONT_SERIF,
                                letterSpacing: '0.5px',
                            }}
                            text-maxline={'1'}
                        >
                            {comic.title} · {chapterTitle}
                        </text>
                        <view
                            style={{
                                backgroundColor: theme.tokens.accent,
                                borderRadius: '12px',
                                paddingLeft: '8px',
                                paddingRight: '8px',
                                paddingTop: '2px',
                                paddingBottom: '2px',
                                marginRight: '4px',
                            }}
                        >
                            <text
                                style={{
                                    color: theme.tokens.onAccent,
                                    fontSize: '12px',
                                }}
                            >
                                {mode === 'page'
                                    ? `${curPage + 1}/${images.length}`
                                    : `第 ${curChapter} 话`}
                            </text>
                        </view>
                        <view
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderRadius: '12px',
                                paddingLeft: '8px',
                                paddingRight: '8px',
                                paddingTop: '2px',
                                paddingBottom: '2px',
                            }}
                        >
                            <text style={{ color: '#fff', fontSize: '12px' }}>
                                {clock}
                            </text>
                        </view>
                    </view>
                    {/* 翻页模式进度条 */}
                    {mode === 'page' ? (
                        <view
                            style={{
                                position: 'absolute',
                                top: '44px',
                                left: 0,
                                right: 0,
                                paddingLeft: '16px',
                                paddingRight: '16px',
                            }}
                        >
                            <SliderRoot
                                value={
                                    images.length > 1
                                        ? curPage / (images.length - 1)
                                        : 0
                                }
                                step={1 / Math.max(1, images.length - 1)}
                                onValueChange={(v) =>
                                    setCurPage(
                                        Math.round(v * (images.length - 1)),
                                    )
                                }
                                style={{ width: '100%', height: '32px' }}
                            >
                                <SliderTrack>
                                    <SliderIndicator
                                        style={{
                                            backgroundColor:
                                                theme.tokens.accent,
                                        }}
                                    />
                                </SliderTrack>
                                <SliderThumb />
                            </SliderRoot>
                        </view>
                    ) : null}
                    {/* download this chapter */}
                    <view
                        style={{
                            position: 'absolute',
                            top: '44px',
                            right: '16px',
                            backgroundColor: theme.tokens.accent,
                            borderRadius: RADIUS.sm,
                            paddingLeft: '10px',
                            paddingRight: '10px',
                            paddingTop: '6px',
                            paddingBottom: '6px',
                        }}
                        bindtap={(e) => {
                            e.stopPropagation?.();
                            void doDownload();
                        }}
                    >
                        <text
                            style={{
                                color: theme.tokens.onAccent,
                                fontSize: '12px',
                            }}
                        >
                            {downloading ? '下载中...' : '下载本章'}
                        </text>
                    </view>
                </view>
            ) : null}

            {/* chapter nav overlay when HUD hidden - tap zones */}
            {!showHud ? (
                <>
                    <view
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '33%',
                        }}
                        bindtap={goPrevChapter}
                    />
                    <view
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '33%',
                        }}
                        bindtap={goNextChapter}
                    />
                </>
            ) : null}
        </view>
    );
}
