import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crawl, imgSrc, cimocVersion, type Comic } from "../api";
import { persistWebtoonsCache } from "../lib/storage";

const SOURCES = [
    { id: "mangadex", title: "MangaDex" },
    { id: "webtoons", title: "Webtoons" },
];

export default function Sources() {
    const [source, setSource] = useState("mangadex");
    const [keyword, setKeyword] = useState("");
    const [comics, setComics] = useState<Comic[]>([]);
    const [loading, setLoading] = useState(false);
    const [version, setVersion] = useState("");

    useEffect(() => {
        cimocVersion()
            .then(setVersion)
            .catch(() => {});
    }, []);

    async function search() {
        setLoading(true);
        try {
            const results = await crawl<Comic[]>("search", source, { keyword });
            setComics(results);
            if (source === "webtoons") void persistWebtoonsCache();
        } catch (e) {
            console.error("search failed", e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h2 style={{ margin: "0 0 8px" }}>搜索</h2>
            <div style={{ marginBottom: 8 }}>
                {SOURCES.map((s) => (
                    <label key={s.id} style={{ marginRight: 16 }}>
                        <input
                            type="radio"
                            name="source"
                            checked={source === s.id}
                            onChange={() => setSource(s.id)}
                        />
                        {s.title}
                    </label>
                ))}
            </div>
            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && search()}
                    placeholder="搜索漫画标题…"
                    style={{ flex: 1, padding: 8 }}
                />
                <button onClick={search} disabled={loading}>
                    {loading ? "搜索中…" : "搜索"}
                </button>
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 12,
                }}
            >
                {comics.map((c) => (
                    <Link
                        key={c.id}
                        to={`/comic/${c.source}/${encodeURIComponent(c.id)}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                    >
                        <img
                            src={imgSrc(c.cover)}
                            alt={c.title}
                            style={{
                                width: "100%",
                                height: 180,
                                objectFit: "cover",
                                background: "#eee",
                                borderRadius: 8,
                            }}
                        />
                        <div style={{ fontSize: 13 }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{c.author}</div>
                    </Link>
                ))}
            </div>
            {version && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#aaa" }}>
                    Rust core: {version}
                </div>
            )}
        </div>
    );
}
