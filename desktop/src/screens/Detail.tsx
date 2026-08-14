import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { crawl, imgSrc, type Chapter, type Comic } from "../api";

export default function Detail() {
    const { source, comicId } = useParams();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);

    useEffect(() => {
        crawl<{ comic: Comic; chapters: Chapter[] }>("detail", source!, { comicId: id })
            .then((d) => {
                setComic(d.comic);
                setChapters(d.chapters);
            })
            .catch(console.error);
    }, [source, id]);

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
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
                        <h2 style={{ margin: 0 }}>{comic.title}</h2>
                        <div style={{ color: "#666" }}>{comic.author}</div>
                        <p style={{ fontSize: 13 }}>{comic.intro}</p>
                    </div>
                </div>
            )}
            <h3>章节</h3>
            <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
                {chapters.map((ch) => (
                    <li key={ch.index} style={{ margin: "6px 0" }}>
                        <Link to={`/reader/${source}/${encodeURIComponent(id)}/${ch.index}`}>
                            {ch.title}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
