import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import {
    scanLocal,
    listDownloaded,
    type Comic,
    type LocalComic,
} from "../api";
import {
    comicKey,
    getFavorites,
    getHistory,
    getSettings,
    type HistoryRecord,
} from "../lib/storage";
import { ComicRow, EmptyState } from "../components/ui";
import {
    ClockIcon,
    DownloadIcon,
    FolderIcon,
    HeartIcon,
    ChevronDownIcon,
} from "../components/icons";

type Tab = "history" | "favorites" | "downloads" | "local";

const TABS: { id: Tab; label: string; icon: typeof ClockIcon }[] = [
    { id: "history", label: "历史", icon: ClockIcon },
    { id: "favorites", label: "收藏", icon: HeartIcon },
    { id: "downloads", label: "下载", icon: DownloadIcon },
    { id: "local", label: "本地", icon: FolderIcon },
];

export default function Library() {
    const [tab, setTab] = useState<Tab>("history");
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [favorites, setFavorites] = useState<Comic[]>([]);
    const [downloads, setDownloads] = useState<LocalComic[]>([]);
    const [local, setLocal] = useState<LocalComic[]>([]);
    const [downloadDir, setDownloadDir] = useState<string | null>(null);
    const [lastScanDir, setLastScanDir] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setHistory(await getHistory());
        setFavorites(await getFavorites());
        const s = await getSettings();
        setDownloadDir(s.downloadDir);
        setDownloads(s.downloadDir ? await scanLocal(s.downloadDir) : []);
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh, tab]);

    async function pickLocalDir() {
        const dir = await open({ directory: true });
        if (typeof dir !== "string") return;
        setLastScanDir(dir);
        setLocal(await scanLocal(dir));
    }

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">书架</h1>
                    <div className="page__sub">你的阅读足迹、收藏与本地漫画</div>
                </div>
            </div>

            <div className="segment" aria-label="书架分类" style={{ marginBottom: 24 }}>
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            aria-pressed={tab === t.id}
                            onClick={() => setTab(t.id)}
                            className={`segment__item ${tab === t.id ? "segment__item--active" : ""}`}
                        >
                            <Icon />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === "history" &&
                (history.length === 0 ? (
                    <EmptyState text="还没有阅读历史，去书源挑一部开始吧" icon={<ClockIcon />} />
                ) : (
                    <div className="list">
                        {history.map((h) => (
                            <ComicRow
                                key={comicKey(h.comic.source, h.comic.id)}
                                to={`/reader/${h.comic.source}/${encodeURIComponent(h.comic.id)}/${h.chapterIndex}`}
                                cover={h.comic.cover}
                                title={h.comic.title}
                                subtitle={h.comic.author}
                                meta={`读到第 ${h.chapterIndex} 话`}
                            />
                        ))}
                    </div>
                ))}

            {tab === "favorites" &&
                (favorites.length === 0 ? (
                    <EmptyState text="暂无收藏，去书源页收藏喜欢的漫画" icon={<HeartIcon />} />
                ) : (
                    <div className="list">
                        {favorites.map((c) => (
                            <ComicRow
                                key={comicKey(c.source, c.id)}
                                to={`/comic/${c.source}/${encodeURIComponent(c.id)}`}
                                cover={c.cover}
                                title={c.title}
                                subtitle={c.author}
                            />
                        ))}
                    </div>
                ))}

            {tab === "downloads" &&
                (downloadDir === null ? (
                    <EmptyState text="下载目录不可用，请到「设置」中检查" icon={<DownloadIcon />} />
                ) : downloads.length === 0 ? (
                    <EmptyState text="还没有下载的漫画" icon={<DownloadIcon />} />
                ) : (
                    <DirList dir={downloadDir} items={downloads} />
                ))}

            {tab === "local" && (
                <div>
                    <button className="btn btn--ghost" onClick={pickLocalDir} style={{ marginBottom: 14 }}>
                        <FolderIcon />
                        {lastScanDir ? "重新选择文件夹…" : "选择文件夹扫描…"}
                    </button>
                    {lastScanDir && (
                        <div style={{ color: "var(--fg-3)", fontSize: 12, marginBottom: 8 }}>
                            {lastScanDir}
                        </div>
                    )}
                    {local.length === 0 ? (
                        <EmptyState
                            text={
                                lastScanDir
                                    ? "该文件夹没有已下载的漫画"
                                    : "选择包含已下载漫画的文件夹"
                            }
                            icon={<FolderIcon />}
                        />
                    ) : (
                        <DirList dir={lastScanDir!} items={local} />
                    )}
                </div>
            )}
        </div>
    );
}

/** 下载/本地漫画列表（wayfinder #19）：点漫画就地展开章节，点章节进本地阅读器。 */
function DirList({ dir, items }: { dir: string; items: LocalComic[] }) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [chapters, setChapters] = useState<Record<string, string[]>>({});

    async function toggle(key: string, item: LocalComic) {
        if (expanded === key) {
            setExpanded(null);
            return;
        }
        setExpanded(key);
        if (!chapters[key]) {
            const listed = await listDownloaded(dir, item.source, item.comicId);
            const flat: Record<string, string[]> = {};
            for (const [idx, paths] of Object.entries(listed)) flat[idx] = paths;
            setChapters((c) => ({ ...c, ...flat }));
        }
    }

    return (
        <div className="list">
            {items.map((d) => {
                const key = `${d.source}:${d.comicId}`;
                const chs = chapters[key];
                const isOpen = expanded === key;
                return (
                    <div key={key} className="row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <button
                                onClick={() => void toggle(key, d)}
                                style={{ width: "100%", textAlign: "left" }}
                                aria-expanded={isOpen}
                            >
                                <div className="row__title">{d.comicId}</div>
                                <div className="row__caption">
                                    {d.source !== "local" ? `${d.source} · ` : ""}
                                    {d.chapterCount} 话
                                </div>
                            </button>
                            {isOpen && chs && (
                                <ul
                                    style={{
                                        padding: "6px 0 2px",
                                        listStyle: "none",
                                        margin: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    {Object.entries(chs).map(([idx, paths]) => (
                                        <li key={idx}>
                                            <Link
                                                to={`/local/${d.source}/${encodeURIComponent(d.comicId)}/${idx}`}
                                                className="chapter-item"
                                            >
                                                <span className="chapter-item__title">
                                                    第 {idx} 话（{paths.length} 页）
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <span
                            className="row__chevron"
                            style={{
                                transform: isOpen ? "rotate(180deg)" : undefined,
                                transition: "transform 0.2s var(--ease)",
                            }}
                        >
                            <ChevronDownIcon />
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
