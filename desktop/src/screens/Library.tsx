import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { imgSrc, scanLocal, type Comic, type LocalComic } from "../api";
import {
    comicKey,
    getFavorites,
    getHistory,
    getSettings,
    type HistoryRecord,
} from "../lib/storage";

type Tab = "history" | "favorites" | "downloads" | "local";

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

    const tabs: { id: Tab; label: string }[] = [
        { id: "history", label: "历史" },
        { id: "favorites", label: "收藏" },
        { id: "downloads", label: "下载" },
        { id: "local", label: "本地" },
    ];

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            fontWeight: tab === t.id ? 600 : 400,
                            border: "1px solid var(--border)",
                            background: tab === t.id ? "var(--card-bg)" : "transparent",
                            padding: "6px 14px",
                            borderRadius: 6,
                            cursor: "pointer",
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "history" &&
                (history.length === 0 ? (
                    <Empty text="暂无阅读历史" />
                ) : (
                    <ComicList
                        items={history.map((h) => ({
                            key: comicKey(h.comic.source, h.comic.id),
                            comic: h.comic,
                            caption: `读到第 ${h.chapterIndex} 话`,
                            to: `/reader/${h.comic.source}/${encodeURIComponent(h.comic.id)}/${h.chapterIndex}`,
                        }))}
                    />
                ))}

            {tab === "favorites" &&
                (favorites.length === 0 ? (
                    <Empty text="暂无收藏，去书源页收藏喜欢的漫画" />
                ) : (
                    <ComicList
                        items={favorites.map((c) => ({
                            key: comicKey(c.source, c.id),
                            comic: c,
                            caption: c.author,
                            to: `/comic/${c.source}/${encodeURIComponent(c.id)}`,
                        }))}
                    />
                ))}

            {tab === "downloads" &&
                (downloadDir === null ? (
                    <Empty text="下载目录不可用，请到「设置」中检查" />
                ) : downloads.length === 0 ? (
                    <Empty text="还没有下载的漫画" />
                ) : (
                    <DirList items={downloads} />
                ))}

            {tab === "local" && (
                <div>
                    <button onClick={pickLocalDir} style={{ marginBottom: 12, cursor: "pointer" }}>
                        {lastScanDir ? "重新选择文件夹…" : "选择文件夹扫描…"}
                    </button>
                    {lastScanDir && (
                        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>
                            {lastScanDir}
                        </div>
                    )}
                    {local.length === 0 ? (
                        <Empty
                            text={
                                lastScanDir
                                    ? "该文件夹没有已下载的漫画"
                                    : "选择包含已下载漫画的文件夹"
                            }
                        />
                    ) : (
                        <DirList items={local} />
                    )}
                </div>
            )}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return <div style={{ color: "var(--muted)", padding: "24px 0" }}>{text}</div>;
}

function DirList({ items }: { items: LocalComic[] }) {
    return (
        <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
            {items.map((d) => (
                <li
                    key={d.comicId}
                    style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}
                >
                    <strong>{d.comicId}</strong>
                    <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                        {d.chapterCount} 个章节目录
                    </span>
                </li>
            ))}
        </ul>
    );
}

function ComicList({
    items,
}: {
    items: { key: string; comic: Comic; caption: string; to: string }[];
}) {
    return (
        <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
            {items.map((it) => (
                <li
                    key={it.key}
                    style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                    }}
                >
                    <img
                        src={imgSrc(it.comic.cover)}
                        alt={it.comic.title}
                        style={{
                            width: 48,
                            height: 64,
                            objectFit: "cover",
                            background: "#eee",
                            borderRadius: 4,
                        }}
                    />
                    <Link to={it.to} style={{ textDecoration: "none", color: "inherit" }}>
                        <div>{it.comic.title}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>
                            {it.caption}
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
