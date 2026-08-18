import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import ProxyImage from "../components/ProxyImage";
import {
    BackIcon,
    BookOpenIcon,
    DownloadIcon,
    FullscreenIcon,
} from "../components/icons";

interface PageItem {
    /** 在过滤后章节列表中的下标 */
    chapterIdx: number;
    url: string;
}

/** 未测量页的估算高度（@tanstack/react-virtual 需要非零估算撑起布局与滚动条）。
 * 按源粗估页宽高比，真实测量（ResizeObserver）后立即纠正。 */
function estimatePageHeight(source: string | undefined, viewportWidth: number): number {
    // MangaDex 常规页高宽比 ≈ 1.4；Webtoons 条图普遍更高
    const ratio = source === "webtoons" ? 2 : 1.4;
    return Math.round(Math.max(400, viewportWidth * ratio));
}

export default function Reader({ local = false }: { local?: boolean }) {
    const { source, comicId, chapterIndex } = useParams();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const navigate = useNavigate();

    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [autoTrim, setAutoTrim] = useState(false);
    const [enqueueHint, setEnqueueHint] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const chaptersRef = useRef<Chapter[]>([]);
    const comicRef = useRef<Comic | null>(null);
    const pagesRef = useRef<PageItem[]>([]);
    const currentIdxRef = useRef(0);
    const loadingRef = useRef(false);
    const loadedChaptersRef = useRef<Set<number>>(new Set());
    const restoredRef = useRef(false);
    const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    chaptersRef.current = chapters;
    comicRef.current = comic;
    pagesRef.current = pages;
    loadingRef.current = loading;

    /** 虚拟器测量的页尺寸数组（与 pages 平行；未测/异常的项按 0，与旧 heights 语义一致）。
     * measurementsCache 在重建期间可能含 undefined 项，防御性归一化防 NaN。用 ref 持有，
     * 避免在 useVirtualizer 声明前引用它（TDZ）。 */
    const pageSizesRef = useRef<() => number[]>(() => []);

    /**
     * 虚拟化渲染：只挂载视口附近页面（含 overscan），页面高度经 ResizeObserver
     * 测量（图片加载后自动重测）；未测页用 estimateSize 撑布局。
     */
    const virtualizer = useVirtualizer({
        count: pages.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () =>
            estimatePageHeight(source, containerRef.current?.clientWidth ?? 400),
        overscan: 3,
        // 每次虚拟器更新（含测量变化）尝试一次进度恢复；restoredRef 保证只落地一次。
        onChange: () => {
            if (restoredRef.current) return;
            const c = comicRef.current;
            const pgs = pagesRef.current;
            if (!c || pgs.length === 0) return;
            // 等虚拟器至少对一页完成真实测量（图片加载前高度为 0，先让测量发生）
            if (virtualizer.itemSizeCache.size === 0) return;
            void (async () => {
                const prog = await getProgress(c.source, c.id);
                if (!prog) return;
                if (prog.chapterIndex !== Number(chapterIndexRef.current)) return; // 换章不套用旧进度
                const total = pageSizesRef.current().reduce((a, b) => a + b, 0);
                if (total <= 0) return; // 首章图片尚未测出高度，等下一次更新
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

    const chapterIndexRef = useRef(0);
    chapterIndexRef.current = Number(chapterIndex);

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
            } finally {
                loadingRef.current = false;
                setLoading(false);
            }
        },
        [source, id, local],
    );

    /** 入队当前话下载（wayfinder #20/#23：Reader「下载本话」改入队 + 轻提示，不再阻塞）。 */
    const enqueueCurrentChapter = useCallback(async () => {
        const chs = chaptersRef.current;
        const idx = currentIdxRef.current;
        const ch = chs[idx];
        if (!ch) return;
        const settings = await getSettings();
        if (!settings.downloadDir) return;
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
        setEnqueueHint(
            out.result === "alreadyDownloaded" ? "该章节已下载" : "已加入下载队列",
        );
        setTimeout(() => setEnqueueHint(null), 2000);
    }, [source, id]);

    /** 按视口中心计算（章节, 话内位置）并落盘进度 + 历史。
     * 页高取虚拟器测量（未测页按 0，与旧 heights 数组语义一致）。 */
    const recordProgress = useCallback(() => {
        const el = containerRef.current;
        const c = comicRef.current;
        const chs = chaptersRef.current;
        const pgs = pagesRef.current;
        const sizes = pageSizesRef.current();
        if (!el || !c || chs.length === 0 || pgs.length === 0 || sizes.length === 0) return;
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
                // wayfinder #31：listDownloaded 返回 {url, path}，localSrc 传 url+source+comicId 走下载索引
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
            const d = await crawl<{ comic: Comic; chapters: Chapter[] }>("detail", source!, {
                comicId: id,
            });
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

    return (
        <div
            ref={containerRef}
            onScroll={onScroll}
            onClick={onContainerClick}
            style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                background: "var(--bg)",
                color: "var(--fg)",
            }}
        >
            {!fullscreen && (
                <div className="reader-bar">
                    {local ? (
                        <Link to="/library" className="icon-btn" aria-label="返回书架">
                            <BackIcon />
                        </Link>
                    ) : (
                        <Link
                            to={`/comic/${source}/${encodeURIComponent(id)}`}
                            className="icon-btn"
                            aria-label="返回章节"
                        >
                            <BackIcon />
                        </Link>
                    )}
                    <div className="reader-bar__title">
                        {comic?.title ?? "阅读中"}
                        {currentChapter && (
                            <span className="reader-bar__chapter">
                                {" "}
                                · {currentChapter.title}
                            </span>
                        )}
                    </div>
                    {!local && (
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => void enqueueCurrentChapter()}
                        >
                            <DownloadIcon />
                            本话
                        </button>
                    )}
                    <button
                        className="btn btn--soft btn--sm"
                        onClick={toggleFullscreen}
                        aria-label="全屏"
                    >
                        <FullscreenIcon />
                        全屏
                    </button>
                    {enqueueHint && <div className="toast">{enqueueHint}</div>}
                </div>
            )}
            {chapters.length === 0 ? (
                <div className="reader-end">
                    <BookOpenIcon />
                    {local ? "该作品没有已下载的章节" : "该作品暂无可用章节（外链章节已过滤）"}
                </div>
            ) : (
                <>
                    <div
                        className="reader-pages"
                        style={{
                            height: virtualizer.getTotalSize(),
                            position: "relative",
                            display: "block",
                            padding: 0,
                            gap: 0,
                        }}
                    >
                        {virtualizer.getVirtualItems().map((vi) => {
                            const page = pages[vi.index];
                            if (!page) return null;
                            return (
                                <div
                                    key={vi.key}
                                    data-index={vi.index}
                                    ref={virtualizer.measureElement}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        transform: `translateY(${vi.start}px)`,
                                    }}
                                >
                                    <ProxyImage
                                        src={
                                            local
                                                ? localSrc(page.url, { source, comicId: id })
                                                : imgSrc(page.url)
                                        }
                                        alt={`page ${vi.index + 1}`}
                                        style={{
                                            display: "block",
                                            margin: "0 auto",
                                            width: autoTrim ? "106%" : "100%",
                                            maxWidth: autoTrim ? "none" : 720,
                                            marginLeft: autoTrim ? "-3%" : undefined,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    {loading && <div className="spinner" />}
                    {!loading && lastChapter && pages.length > 0 && (
                        <div className="reader-end">
                            <BookOpenIcon />
                            已到最后一话
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
