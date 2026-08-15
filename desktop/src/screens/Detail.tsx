import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { crawl, imgSrc, type Chapter, type Comic } from "../api";
import { filterExternalChapters } from "../lib/chapters";
import { getProgress, isFavorite, toggleFavorite } from "../lib/storage";

export default function Detail() {
    const { source, comicId } = useParams();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [favorite, setFavorite] = useState(false);
    const [resume, setResume] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [d, fav, prog] = await Promise.all([
                crawl<{ comic: Comic; chapters: Chapter[] }>("detail", source!, {
                    comicId: id,
                }),
                isFavorite(source!, id),
                getProgress(source!, id),
            ]);
            if (cancelled) return;
            setComic(d.comic);
            setChapters(filterExternalChapters(d.chapters));
            setFavorite(fav);
            if (prog) setResume(prog.chapterIndex);
        })();
        return () => {
            cancelled = true;
        };
    }, [source, id]);

    async function onToggleFavorite() {
        if (!comic) return;
        setFavorite(await toggleFavorite(comic));
    }

    return (
        <div style={{ padding: 16 }}>
            <Link to="/">← 返回</Link>
            {comic && (
                <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                    <img
                        src={imgSrc(comic.cover)}
                        alt={comic.title}
                        style={{
                            width: 120,
                            height: 160,
                            objectFit: "cover",
                            background: "#eee",
                            borderRadius: 8,
                        }}
                    />
                    <div>
                        <h2 style={{ margin: "0 0 4px" }}>{comic.title}</h2>
                        <div style={{ color: "var(--muted)" }}>{comic.author}</div>
                        <p style={{ fontSize: 13, margin: "8px 0" }}>{comic.intro}</p>
                        <button onClick={onToggleFavorite} style={{ cursor: "pointer" }}>
                            {favorite ? "取消收藏" : "收藏"}
                        </button>
                    </div>
                </div>
            )}
            {resume !== null && comic && (
                <div style={{ margin: "12px 0" }}>
                    <Link
                        to={`/reader/${source}/${encodeURIComponent(id)}/${resume}`}
                        style={{
                            padding: "6px 16px",
                            background: "var(--card-bg)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            textDecoration: "none",
                            display: "inline-block",
                        }}
                    >
                        继续阅读 第 {resume} 话
                    </Link>
                </div>
            )}
            <h3>章节</h3>
            {chapters.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    该作品暂无可用章节（外链章节已过滤）
                </div>
            ) : (
                <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
                    {chapters.map((ch) => (
                        <li
                            key={ch.index}
                            style={{
                                padding: "6px 0",
                                borderBottom: "1px solid var(--border)",
                            }}
                        >
                            <Link
                                to={`/reader/${source}/${encodeURIComponent(id)}/${ch.index}`}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                {ch.title}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
