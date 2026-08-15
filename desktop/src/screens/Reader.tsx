import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
    crawl,
    imgSrc,
    localSrc,
    downloadImage,
    listDownloaded,
    type Chapter,
    type Comic,
} from "../api";
import { filterExternalChapters } from "../lib/chapters";
import { nearBottom, pageIndexAt, positionWithinChapter } from "../lib/scroll";
import { getProgress, getSettings, setProgress, touchHistory } from "../lib/storage";

interface PageItem {
    /** 在过滤后章节列表中的下标 */
    chapterIdx: number;
    url: string;
}

export default function Reader({ local = false }: { local?: boolean }) {
    const { source, comicId, chapterIndex } = useParams();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const navigate = useNavigate();

    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [heights, setHeights] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [autoTrim, setAutoTrim] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const chaptersRef = useRef<Chapter[]>([]);
    const comicRef = useRef<Comic | null>(null);
    const pagesRef = useRef<PageItem[]>([]);
    const heightsRef = useRef<number[]>([]);
    const currentIdxRef = useRef(0);
    const loadingRef = useRef(false);
    const downloadingRef = useRef(false);
    const loadedChaptersRef = useRef<Set<number>>(new Set());
    const restoredRef = useRef(false);
    const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    chaptersRef.current = chapters;
    comicRef.current = comic;
    pagesRef.current = pages;
    heightsRef.current = heights;
    loadingRef.current = loading;

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
                const imgs = local
                    ? chaptersRef.current[chapterIdx].pages
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

    /** 记录某页的已测高度（heights 与 pages 平行）。 */
    const setPageHeight = useCallback((pageIndex: number, height: number) => {
        const h = [...heightsRef.current];
        while (h.length <= pageIndex) h.push(0);
        h[pageIndex] = height;
        heightsRef.current = h;
        setHeights(h);
    }, []);

    /** 下载当前话（Reader 内下载，grilling #6；热链域带 Referer）。 */
    const downloadCurrentChapter = useCallback(async () => {
        const chs = chaptersRef.current;
        const idx = currentIdxRef.current;
        const ch = chs[idx];
        if (!ch || downloadingRef.current) return;
        const settings = await getSettings();
        if (!settings.downloadDir) return;
        downloadingRef.current = true;
        setDownloading(true);
        try {
            const referer = source === "webtoons" ? "https://www.webtoons.com/" : "";
            const urls = pagesRef.current
                .filter((p) => p.chapterIdx === idx)
                .map((p) => p.url);
            for (let i = 0; i < urls.length; i++) {
                await downloadImage(
                    urls[i],
                    settings.downloadDir,
                    source!,
                    id,
                    ch.index,
                    i,
                    referer,
                );
            }
        } catch (e) {
            console.error("download failed", e);
        } finally {
            downloadingRef.current = false;
            setDownloading(false);
        }
    }, [source, id]);

    /** 按视口中心计算（章节, 话内位置）并落盘进度 + 历史。 */
    const recordProgress = useCallback(() => {
        const el = containerRef.current;
        const c = comicRef.current;
        const chs = chaptersRef.current;
        const pgs = pagesRef.current;
        const hts = heightsRef.current;
        if (!el || !c || chs.length === 0 || pgs.length === 0 || hts.length === 0) return;
        const center = el.scrollTop + el.clientHeight / 2;
        const pageIdx = pageIndexAt(center, hts);
        const chapterIdx = pgs[pageIdx].chapterIdx;
        const from = pgs.findIndex((p) => p.chapterIdx === chapterIdx);
        let to = from;
        while (to < pgs.length && pgs[to].chapterIdx === chapterIdx) to++;
        const position = positionWithinChapter(center, hts, from, to);
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
            // 跨话连续：接近底部且有下一话（至少一页已渲染，防初始级联）→ 加载下一话
            if (
                nearBottom(scrollTop, clientHeight, scrollHeight) &&
                currentIdxRef.current < chaptersRef.current.length - 1 &&
                heightsRef.current.some((h) => h > 0)
            ) {
                void appendChapter(currentIdxRef.current + 1);
            }
            recordProgress();
        }, 250);
    }, [appendChapter, recordProgress]);

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
                    .map(([idx, paths]) => ({
                        index: Number(idx),
                        title: `第 ${Number(idx)} 话`,
                        pages: paths,
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

    // 首次进入且当前话全部页高已测出：按已存进度恢复（仅当记录章节与打开章节一致）
    useEffect(() => {
        if (!comic || restoredRef.current || pages.length === 0) return;
        if (heights.length !== pages.length || heights.some((h) => h <= 0)) return;
        restoredRef.current = true;
        void (async () => {
            const prog = await getProgress(comic.source, comic.id);
            const el = containerRef.current;
            if (!prog || !el) return;
            if (prog.chapterIndex !== Number(chapterIndex)) return; // 换章不套用旧进度
            const total = heights.reduce((a, b) => a + b, 0);
            if (total > 0) el.scrollTop = Math.min(total, prog.position * total);
        })();
    }, [comic, pages, heights, chapterIndex]);

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

    return (
        <div
            ref={containerRef}
            onScroll={onScroll}
            onClick={onContainerClick}
            style={{
                height: "100vh",
                overflowY: "auto",
                background: "var(--bg)",
                color: "var(--fg)",
            }}
        >
            {!fullscreen && (
                <div
                    style={{
                        position: "sticky",
                        top: 0,
                        background: "var(--bar-bg)",
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 10,
                    }}
                >
                    {local ? (
                        <Link to="/library">← 书架</Link>
                    ) : (
                        <Link to={`/comic/${source}/${encodeURIComponent(id)}`}>← 章节</Link>
                    )}
                    {!local && (
                        <button onClick={() => void downloadCurrentChapter()} disabled={downloading}>
                            {downloading ? "下载中…" : "下载本话"}
                        </button>
                    )}
                    <button onClick={toggleFullscreen} style={{ marginLeft: "auto" }}>
                        全屏
                    </button>
                </div>
            )}
            {chapters.length === 0 ? (
                <div style={{ padding: 32, color: "#999" }}>
                    {local
                        ? "该作品没有已下载的章节"
                        : "该作品暂无可用章节（外链章节已过滤）"}
                </div>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 0",
                    }}
                >
                    {pages.map((p, i) => (
                        <img
                            key={i}
                            src={local ? localSrc(p.url) : imgSrc(p.url)}
                            alt={`page ${i + 1}`}
                            loading="lazy"
                            onLoad={(e) =>
                                setPageHeight(
                                    i,
                                    e.currentTarget.naturalHeight ||
                                        e.currentTarget.clientHeight,
                                )
                            }
                            style={{
                                width: autoTrim ? "106%" : "100%",
                                maxWidth: autoTrim ? "none" : 720,
                                marginLeft: autoTrim ? "-3%" : undefined,
                                background: "#f5f5f5",
                            }}
                        />
                    ))}
                    {loading && (
                        <div style={{ padding: 16, color: "#999" }}>加载中…</div>
                    )}
                    {!loading && lastChapter && pages.length > 0 && (
                        <div style={{ padding: 16, color: "#999" }}>已到最后一话</div>
                    )}
                </div>
            )}
        </div>
    );
}
