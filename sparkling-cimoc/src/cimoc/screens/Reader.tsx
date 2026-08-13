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
import { useEffect, useState } from '@lynx-js/react';
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
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHud, setShowHud] = useState(true);
    const [curChapter, setCurChapter] = useState(chapterIndex);
    const [curPage, setCurPage] = useState(0);
    const [clock, setClock] = useState(currentClock());
    const [downloading, setDownloading] = useState(false);

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

    useEffect(() => {
        // record reading history + 进度（Cimoc 进入阅读器即自动记录）
        if (comic) store.recordHistory(comic.id, curChapter);
    }, [comic, curChapter]);

    useEffect(() => {
        // 加载当前章节图片（真实网络或已下载本地）
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
    }, [comicId, curChapter]);

    useEffect(() => {
        const id = setInterval(() => setClock(currentClock()), 30_000);
        return () => clearInterval(id);
    }, []);

    const doDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        const ok = await downloadChapter(comicId, curChapter, images);
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

    const chapter = chapters.find((c) => c.index === curChapter);
    const chapterTitle = chapter?.title ?? `第 ${curChapter} 话`;
    const isDark = !store.settings.whiteBackground;
    const readerBg = store.settings.whiteBackground ? '#FFFFFF' : theme.tokens.readerBg;

    // 左缘右滑返回：卷纸模式（横向无交互）始终可用；
    // 翻页模式仅在第 0 页（左滑无上一页可翻）时接管，其余页交给 Swiper 翻页。
    const edgeBack = useEdgeBackGesture(
        () => nav.pop(),
        mode === 'stream' || (mode === 'page' && curPage === 0),
    );

    const toggleHud = () => setShowHud(!showHud);
    // 章节号不一定是连续数组下标（真实图源为话数，排序新旧不一），
    // 用最小/最大话数作为翻章边界，且与排序无关。
    const epNos = chapters.map((c) => c.index);
    const minEp = epNos.length > 0 ? Math.min(...epNos) : 0;
    const maxEp = epNos.length > 0 ? Math.max(...epNos) : 0;
    const prevChapter = () => {
        if (curChapter > minEp) setCurChapter(curChapter - 1);
    };
    const nextChapter = () => {
        if (curChapter < maxEp) setCurChapter(curChapter + 1);
    };

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
                    <text style={{ color: theme.tokens.textMut, fontSize: '15px' }}>
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
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {images.map((src, i) => (
                        <view
                            key={i}
                            style={{
                                width: '100%',
                                height: '600px',
                            }}
                        >
                            <PageImage src={src} />
                        </view>
                    ))}
                </view>
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
                                {curPage + 1}/{images.length}
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
                    {/* bottom seek bar */}
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
                                setCurPage(Math.round(v * (images.length - 1)))
                            }
                            style={{ width: '100%', height: '32px' }}
                        >
                            <SliderTrack>
                                <SliderIndicator
                                    style={{
                                        backgroundColor: theme.tokens.accent,
                                    }}
                                />
                            </SliderTrack>
                            <SliderThumb />
                        </SliderRoot>
                    </view>
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
                        bindtap={prevChapter}
                    />
                    <view
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '33%',
                        }}
                        bindtap={nextChapter}
                    />
                </>
            ) : null}
        </view>
    );
}
