import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useScroll } from "motion/react";
import {
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Download,
    Maximize,
} from "lucide-react";
import {
    crawl,
    imgSrc,
    localSrc,
    enqueueDownload,
    listDownloaded,
    type Chapter,
    type Comic,
} from "../api";
import { filterExternalChapters } from "../lib/chapters";
import { nearBottom, pageIndexAt, positionWithinChapter } from "../lib/scroll";
import { getProgress, getSettings, setProgress, touchHistory } from "../lib/storage";
import { useIsMobile } from "../lib/platform";
import { cn } from "../lib/utils";
import ProxyImage from "../components/ProxyImage";
import { useToast } from "../components/toast";
import { ExpandableActionBar } from "../components/beui/expandable-action-bar";
import { Loader } from "../components/beui/loader";
import { ScrollProgress } from "../components/beui/scroll-progress";
import { Button } from "../components/beui/button";

interface PageItem {
    /** 在过滤后章节列表中的下标 */
    chapterIdx: number;
    url: string;
}

/** 未测量页的高度估算：撑起布局与滚动条，图片加载后按真实高度收缩。
 * 比例优先取该源已加载页面的实测中位数（长条漫与常规页差别很大），
 * 还没有样本时按源给出经验值。 */
const FALLBACK_RATIO: Record<string, number> = { webtoons: 2 };
const DEFAULT_RATIO = 1.4;
/** 每个源保留的最近样本数。 */
const RATIO_SAMPLES = 8;
const ratioSamples = new Map<string, number[]>();

function learnedRatio(source: string | undefined): number {
    const samples = source ? ratioSamples.get(source) : undefined;
    if (!samples || samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function rememberRatio(source: string | undefined, ratio: number): boolean {
    if (!source || !Number.isFinite(ratio) || ratio <= 0) return false;
    const samples = ratioSamples.get(source) ?? [];
    samples.push(ratio);
    if (samples.length > RATIO_SAMPLES) samples.shift();
    ratioSamples.set(source, samples);
    return true;
}

export default function Reader({ local = false }: { local?: boolean }) {
    const { source, comicId, chapterIndex } = useParams();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const navigate = useNavigate();
    const toast = useToast();
    const mobile = useIsMobile();

    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [autoTrim, setAutoTrim] = useState(false);
    const [columnWidth, setColumnWidth] = useState(720);
    const [ratio, setRatio] = useState(
        () => learnedRatio(source) || FALLBACK_RATIO[source ?? ""] || DEFAULT_RATIO,
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const columnRef = useRef<HTMLDivElement>(null);
    const chaptersRef = useRef<Chapter[]>([]);
    const comicRef = useRef<Comic | null>(null);
    const pagesRef = useRef<PageItem[]>([]);
    const currentIdxRef = useRef(0);
    const chapterIndexRef = useRef(0);
    const loadingRef = useRef(false);
    const loadedChaptersRef = useRef<Set<number>>(new Set());
    const restoredRef = useRef(false);
    const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    chaptersRef.current = chapters;
    comicRef.current = comic;
    pagesRef.current = pages;
    loadingRef.current = loading;
    chapterIndexRef.current = Number(chapterIndex);

    const { scrollYProgress } = useScroll({ container: containerRef });

    /** 虚拟器测量的页尺寸数组（与 pages 平行；未测/异常的项按 0，与旧 heights 语义一致）。 */
    const pageSizesRef = useRef<() => number[]>(() => []);

    /** 未加载页的预留高度：列宽 × 该源实测中位宽高比。 */
    const estimatePageHeight = useCallback(
        (width: number) => Math.round(Math.max(320, width * ratio)),
        [ratio],
    );

    /** 图片给出真实大小时记录比例，后续未加载页的预留高度随之收敛。 */
    const onNaturalSize = useCallback(
        (width: number, height: number) => {
            if (!rememberRatio(source, height / width)) return;
            const next = learnedRatio(source);
            // 变化小于 5% 不重建布局，避免边读边抖
            if (next > 0 && Math.abs(next - ratio) / ratio > 0.05) setRatio(next);
        },
        [source, ratio],
    );

    /**
     * 虚拟化渲染：只挂载视口附近页面（含 overscan），页面高度经 ResizeObserver
     * 测量（图片加载后自动重测）；未测页用 estimateSize 撑布局。
     */
    const virtualizer = useVirtualizer({
        count: pages.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => estimatePageHeight(columnWidth),
        overscan: 3,
        // 每次虚拟器更新（含测量变化）尝试一次进度恢复；restoredRef 保证只执行一次。
        onChange: () => {
            if (restoredRef.current) return;
            const c = comicRef.current;
            const pgs = pagesRef.current;
            if (!c || pgs.length === 0) return;
            // 等虚拟器至少对一页完成真实测量（图片加载前高度为预留值）
            if (virtualizer.itemSizeCache.size === 0) return;
            void (async () => {
                const prog = await getProgress(c.source, c.id);
                if (!prog) return;
                if (prog.chapterIndex !== Number(chapterIndexRef.current)) return; // 换章不套用旧进度
                const total = pageSizesRef.current().reduce((a, b) => a + b, 0);
                if (total <= 0) return;
                restoredRef.current = true;
                virtualizer.scrollToOffset(Math.min(total, prog.position * total));
            })();
        },
    });

    pageSizesRef.current = () => {
        // measurementsCache 是稀疏数组（重建期有空洞）；.map 会跳过空洞，
        // 用 for 循环显式取每项并把空洞/非数值归 0（稠密化），防止 sum 累加 undefined 得 NaN。
        const cache = virtualizer.measurementsCache;
        const sizes: number[] = new Array(cache.length);
        for (let i = 0; i < cache.length; i++) {
            const s = cache[i]?.size;
            sizes[i] = typeof s === "number" && Number.isFinite(s) ? s : 0;
        }
        return sizes;
    };

    /** 阅读列宽度（决定估算高度与最小高度）。 */
    useEffect(() => {
        const el = columnRef.current;
        if (!el) return;
        const update = (width: number) => setColumnWidth(Math.round(width));
        update(el.getBoundingClientRect().width);
        const observer = new ResizeObserver(([entry]) =>
            update(entry.contentRect.width),
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [autoTrim, mobile]);

    /** 追加某章图片（幂等：已加载章节跳过；失败可重试）。 */
    const appendChapter = useCallback(
        async (chapterIdx: number) => {
            if (loadingRef.current || loadedChaptersRef.current.has(chapterIdx)) return;
            if (!chaptersRef.current[chapterIdx]) return;
            loadedChaptersRef.current.add(chapterIdx);
            loadingRef.current = true;
            setLoading(true);
            try {
                // 本地模式（wayfinder #19）：页面来自下载目录文件；在线走 crawl images
                // wayfinder #31：离线优先用原始图 url（没记录则回退文件路径），配合 localSrc
                const imgs = local
                    ? (() => {
                          const ch = chaptersRef.current[chapterIdx];
                          return ch.pages.map((p, i) => ch.pagesUrl?.[i] || p);
                      })()
                    : await crawl<string[]>("images", source!, {
                          comicId: id,
                          chapterIndex: chaptersRef.current[chapterIdx].index,
                      });
                const next = [
                    ...pagesRef.current,
                    ...imgs.map((url) => ({ chapterIdx, url })),
                ];
                pagesRef.current = next;
                setPages(next);
                currentIdxRef.current = chapterIdx;
            } catch (err) {
                loadedChaptersRef.current.delete(chapterIdx);
                console.error(err);
                toast.show("这一话加载失败，滚动到底部可重试", "error");
            } finally {
                loadingRef.current = false;
                setLoading(false);
            }
        },
        [source, id, local, toast],
    );

    /** 入队当前话下载（wayfinder #20/#23：Reader「下载本话」改入队 + 轻提示，不再阻塞）。 */
    const enqueueCurrentChapter = useCallback(async () => {
        const chs = chaptersRef.current;
        const idx = currentIdxRef.current;
        const ch = chs[idx];
        if (!ch) return;
        const settings = await getSettings();
        if (!settings.downloadDir) {
            toast.show("请先在设置里选择下载目录", "error");
            return;
        }
        const referer = source === "webtoons" ? "https://www.webtoons.com/" : "";
        const urls = pagesRef.current
            .filter((p) => p.chapterIdx === idx)
            .map((p) => p.url);
        if (urls.length === 0) return;
        const out = await enqueueDownload({
            source: source!,
            comicId: id,
            comicTitle: comicRef.current?.title ?? id,
            chapterIndex: ch.index,
            dir: settings.downloadDir,
            referer,
            urls,
        });
        toast.show(
            out.result === "alreadyDownloaded" ? "该章节已下载" : "已加入下载队列",
            out.result === "alreadyDownloaded" ? "neutral" : "success",
        );
    }, [source, id, toast]);

    /** 按视口中心计算（章节, 话内位置）并写入进度 + 历史。 */
    const recordProgress = useCallback(() => {
        const el = containerRef.current;
        const c = comicRef.current;
        const chs = chaptersRef.current;
        const pgs = pagesRef.current;
        const sizes = pageSizesRef.current();
        if (!el || !c || chs.length === 0 || pgs.length === 0 || sizes.length === 0)
            return;
        const center = el.scrollTop + el.clientHeight / 2;
        const pageIdx = Math.min(pageIndexAt(center, sizes), pgs.length - 1);
        const chapterIdx = pgs[pageIdx].chapterIdx;
        const from = pgs.findIndex((p) => p.chapterIdx === chapterIdx);
        let to = from;
        while (to < pgs.length && pgs[to].chapterIdx === chapterIdx) to++;
        const position = positionWithinChapter(center, sizes, from, to);
        void setProgress(c.source, c.id, {
            chapterIndex: chs[chapterIdx].index,
            position,
            updatedAt: Date.now(),
        });
        // 本地阅读不写历史（#19：离线拿不到真实标题，历史 tab 保持链在线 reader）
        if (!local) void touchHistory(c, chs[chapterIdx].index);
    }, [local]);

    const onScroll = useCallback(() => {
        if (progressTimer.current !== null) clearTimeout(progressTimer.current);
        progressTimer.current = setTimeout(() => {
            const el = containerRef.current;
            if (!el) return;
            const { scrollTop, clientHeight, scrollHeight } = el;
            // 跨话连续：接近底部且有下一话（至少一页真实测量过，防初始级联）→ 加载下一话
            if (
                nearBottom(scrollTop, clientHeight, scrollHeight) &&
                currentIdxRef.current < chaptersRef.current.length - 1 &&
                virtualizer.itemSizeCache.size > 0
            ) {
                void appendChapter(currentIdxRef.current + 1);
            }
            recordProgress();
        }, 250);
    }, [appendChapter, recordProgress, virtualizer]);

    // 进入：加载详情（漫画 + 过滤后章节）+ 首章图片，并记一条历史
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (local) {
                // 本地模式：不联网，章节与页面来自下载目录（wayfinder #19）
                const settings = await getSettings();
                const dir = settings.downloadDir;
                if (!dir) return;
                const listed = await listDownloaded(dir, source!, id);
                const chs: Chapter[] = Object.entries(listed)
                    .map(([idx, pages]) => ({
                        index: Number(idx),
                        title: `第 ${Number(idx)} 话`,
                        pages: pages.map((p) => p.path),
                        pagesUrl: pages.map((p) => p.url),
                        external: false,
                        downloaded: true,
                        read: false,
                    }))
                    .sort((a, b) => a.index - b.index);
                const comic: Comic = {
                    id,
                    source: source!,
                    sourceTitle: "本地",
                    title: id,
                    author: "",
                    intro: "",
                    cover: "",
                    status: "serial",
                    updateTime: "",
                    lastChapter: "",
                    tags: [],
                    lastReadChapter: 0,
                    lastReadTime: 0,
                };
                if (cancelled) return;
                const target = Math.max(
                    0,
                    chs.findIndex((c) => c.index === Number(chapterIndex)),
                );
                comicRef.current = comic;
                chaptersRef.current = chs;
                setComic(comic);
                setChapters(chs);
                currentIdxRef.current = target;
                loadingRef.current = false;
                await appendChapter(target);
                return;
            }
            const d = await crawl<{ comic: Comic; chapters: Chapter[] }>(
                "detail",
                source!,
                { comicId: id },
            );
            if (cancelled) return;
            const chs = filterExternalChapters(d.chapters);
            const target = Math.max(
                0,
                chs.findIndex((c) => c.index === Number(chapterIndex)),
            );
            comicRef.current = d.comic;
            chaptersRef.current = chs;
            setComic(d.comic);
            setChapters(chs);
            currentIdxRef.current = target;
            void touchHistory(d.comic, chs[target]?.index ?? 0);
            loadingRef.current = false;
            await appendChapter(target);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, id, chapterIndex, local]);

    // 全屏沉浸（grilling #6）：隐藏顶栏；Esc/点击画面退出；非全屏时 Esc 返回
    const toggleFullscreen = useCallback(async () => {
        const next = !fullscreen;
        await getCurrentWindow().setFullscreen(next);
        setFullscreen(next);
    }, [fullscreen]);

    const onContainerClick = useCallback(() => {
        if (fullscreen) {
            void getCurrentWindow().setFullscreen(false);
            setFullscreen(false);
        }
    }, [fullscreen]);

    // 自动裁边（设置项）：页面略放大，裁掉边缘空白
    useEffect(() => {
        void getSettings().then((s) => setAutoTrim(s.autoTrim));
    }, []);

    // 卸载时清掉进度防抖计时器
    useEffect(
        () => () => {
            if (progressTimer.current !== null) clearTimeout(progressTimer.current);
        },
        [],
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (fullscreen) {
                void getCurrentWindow().setFullscreen(false);
                setFullscreen(false);
            } else {
                navigate(-1);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fullscreen, navigate]);

    const lastChapter = currentIdxRef.current >= chapters.length - 1;
    const currentChapter = chapters[currentIdxRef.current];
    const reserved = estimatePageHeight(columnWidth);
    const backTo = local
        ? "/library"
        : `/comic/${source}/${encodeURIComponent(id)}`;

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
            {!fullscreen && (
                <header className="z-30 flex items-center gap-2 border-b border-border bg-background px-2 py-1.5">
                    <Link
                        to={backTo}
                        aria-label={local ? "返回书架" : "返回章节"}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                            {comic?.title ?? "阅读中"}
                        </div>
                        {currentChapter && (
                            <div className="truncate text-[11px] text-muted-foreground">
                                {currentChapter.title}
                                {pages.length > 0 && (
                                    <>
                                        {" · "}
                                        已载入 {pages.length} 页
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <ExpandableActionBar
                        size="sm"
                        expandOnHover={!mobile}
                        items={[
                            ...(local
                                ? []
                                : [
                                      {
                                          id: "download",
                                          label: "下载本话",
                                          icon: <Download className="size-4" />,
                                          onClick: () => void enqueueCurrentChapter(),
                                      },
                                  ]),
                            {
                                id: "fullscreen",
                                label: "全屏",
                                icon: <Maximize className="size-4" />,
                                onClick: () => void toggleFullscreen(),
                            },
                        ]}
                    />
                </header>
            )}

            <ScrollProgress
                progress={scrollYProgress}
                fixed={false}
                position="top"
                height={2}
                className="bg-primary"
            />

            <div
                ref={containerRef}
                onScroll={onScroll}
                onClick={onContainerClick}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
                {chapters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
                        <BookOpen className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            {local
                                ? "该作品没有已下载的章节"
                                : "该作品暂无可用章节（外链章节已过滤）"}
                        </p>
                        <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
                            返回
                        </Button>
                    </div>
                ) : (
                    <>
                        <div
                            ref={columnRef}
                            className="relative mx-auto w-full"
                            style={{ maxWidth: autoTrim ? "none" : 720 }}
                        >
                            <div
                                className="relative"
                                style={{ height: virtualizer.getTotalSize() }}
                            >
                                {virtualizer.getVirtualItems().map((vi) => {
                                    const page = pages[vi.index];
                                    if (!page) return null;
                                    const previous = pages[vi.index - 1];
                                    const startsChapter =
                                        !previous ||
                                        previous.chapterIdx !== page.chapterIdx;
                                    return (
                                        <div
                                            key={vi.key}
                                            data-index={vi.index}
                                            ref={virtualizer.measureElement}
                                            className="absolute left-0 top-0 w-full overflow-hidden"
                                            style={{
                                                transform: `translateY(${vi.start}px)`,
                                            }}
                                        >
                                            <ReaderPage
                                                src={
                                                    local
                                                        ? localSrc(page.url, {
                                                              source,
                                                              comicId: id,
                                                          })
                                                        : imgSrc(page.url)
                                                }
                                                index={vi.index}
                                                reserved={reserved}
                                                autoTrim={autoTrim}
                                                onNaturalSize={onNaturalSize}
                                                chapterTitle={
                                                    startsChapter
                                                        ? chapters[page.chapterIdx]
                                                              ?.title
                                                        : undefined
                                                }
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {loading && (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                                <Loader
                                    variant="dots"
                                    size={18}
                                    label="正在加载下一话"
                                />
                                正在加载下一话…
                            </div>
                        )}

                        {!loading && lastChapter && pages.length > 0 && (
                            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                                <BookOpen className="size-8 text-muted-foreground" />
                                <p className="text-sm font-medium">已到最后一话</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigate(backTo)}
                                >
                                    返回目录
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/** 阅读页图片：宽度 100%、高度自适应；加载完成前用预留高度撑住布局，避免滚动跳动。 */
function ReaderPage({
    src,
    index,
    reserved,
    autoTrim,
    chapterTitle,
    onNaturalSize,
}: {
    src: string;
    index: number;
    reserved: number;
    autoTrim: boolean;
    chapterTitle?: string;
    onNaturalSize: (width: number, height: number) => void;
}) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    return (
        <div style={{ minHeight: loaded ? undefined : reserved }}>
            {chapterTitle && (
                <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground">
                        {chapterTitle}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                </div>
            )}

            <div
                className={cn("relative", !loaded && !failed && "overflow-hidden")}
                style={{ minHeight: loaded || failed ? undefined : reserved }}
            >
                {!loaded && !failed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
                        <Loader
                            variant="dots"
                            size={18}
                            label={`第 ${index + 1} 页加载中`}
                        />
                        <span className="text-[11px] tabular-nums">
                            第 {index + 1} 页
                        </span>
                    </div>
                )}

                {failed ? (
                    <button
                        type="button"
                        onClick={() => {
                            setFailed(false);
                            setRetryKey((k) => k + 1);
                        }}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 py-10 text-muted-foreground transition-colors hover:text-foreground"
                        style={{ minHeight: reserved }}
                    >
                        <AlertTriangle className="size-5" />
                        <span className="text-xs">
                            第 {index + 1} 页加载失败，点击重试
                        </span>
                    </button>
                ) : (
                    <ProxyImage
                        key={retryKey}
                        src={src}
                        alt={`第 ${index + 1} 页`}
                        onLoad={(el) => {
                            setLoaded(true);
                            if (el.naturalWidth > 0) {
                                onNaturalSize(el.naturalWidth, el.naturalHeight);
                            }
                        }}
                        onFailed={() => setFailed(true)}
                        className="block h-auto w-full"
                        style={
                            autoTrim
                                ? { width: "106%", marginLeft: "-3%", maxWidth: "none" }
                                : undefined
                        }
                    />
                )}
            </div>
        </div>
    );
}
