import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { crawl, imgSrc, cimocVersion, sourceErrors, type Comic, type SourceError } from "../api";
import { persistWebtoonsCache } from "../lib/storage";

const SOURCES = [
    { id: "mangadex", title: "MangaDex" },
    { id: "webtoons", title: "Webtoons" },
];

/** 当前列表要加载什么：分类浏览（label）或搜索（keyword）。 */
interface ListRequest {
    source: string;
    op: "category" | "search";
    category: string | null;
    keyword: string;
}

export default function Sources() {
    const [source, setSource] = useState("mangadex");
    const [categories, setCategories] = useState<string[]>([]);
    // 高亮的分类 tab（浏览模式）
    const [category, setCategory] = useState<string | null>(null);
    // 当前视图是否为搜索结果（用于 tab 高亮/输入框提示）
    const [inSearch, setInSearch] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [request, setRequest] = useState<ListRequest>({
        source: "mangadex",
        op: "category",
        category: null,
        keyword: "",
    });
    const [comics, setComics] = useState<Comic[]>([]);
    const [loading, setLoading] = useState(false);
    const [version, setVersion] = useState("");
    // 源脚本错误行（wayfinder #17：源坏了不再伪装成空列表）
    const [sourceErr, setSourceErr] = useState<string | null>(null);
    // 请求序号：丢弃过期响应，避免分类/搜索竞态
    const listSeq = useRef(0);

    useEffect(() => {
        cimocVersion()
            .then(setVersion)
            .catch(() => {});
    }, []);

    // 切换源：加载分类 tab，默认进第一个分类
    useEffect(() => {
        let cancelled = false;
        setCategories([]);
        setInSearch(false);
        setComics([]);
        (async () => {
            const cats = await crawl<string[]>("categories", source, {}).catch(
                (): string[] => [],
            );
            if (cancelled) return;
            setCategories(cats);
            const first = cats[0] ?? null;
            setCategory(first);
            setRequest({ source, op: "category", category: first, keyword: "" });
            const errs = await sourceErrors().catch((): Record<string, SourceError> => ({}));
            if (cancelled) return;
            setSourceErr(errs[source]?.message.split("\n")[0] ?? null);
        })();
        return () => {
            cancelled = true;
        };
    }, [source]);

    // 按 request 加载列表（分类浏览或搜索结果）
    useEffect(() => {
        if (request.op === "category" && !request.category) return;
        const seq = ++listSeq.current;
        setLoading(true);
        setSourceErr(null);
        (async () => {
            try {
                const payload =
                    request.op === "search"
                        ? { keyword: request.keyword }
                        : { label: request.category };
                const results = await crawl<Comic[]>(request.op, request.source, payload);
                if (seq !== listSeq.current) return;
                setComics(results);
                if (request.source === "webtoons") void persistWebtoonsCache();
            } catch (e) {
                console.error("list failed", e);
            } finally {
                if (seq !== listSeq.current) return;
                const errs = await sourceErrors().catch((): Record<string, SourceError> => ({}));
                if (seq !== listSeq.current) return;
                setSourceErr(errs[request.source]?.message.split("\n")[0] ?? null);
                setLoading(false);
            }
        })();
    }, [request]);

    function selectCategory(label: string) {
        setCategory(label);
        setInSearch(false);
        setKeyword("");
        setRequest({ source, op: "category", category: label, keyword: "" });
    }

    function onSearch() {
        const kw = keyword.trim();
        if (!kw) {
            // 空关键词 → 回到分类浏览
            setInSearch(false);
            if (category) setRequest({ source, op: "category", category, keyword: "" });
            return;
        }
        setInSearch(true);
        setRequest({ source, op: "search", category: null, keyword: kw });
    }

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h2 style={{ margin: "0 0 8px" }}>书源</h2>

            {/* 源 tab 条 */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 8,
                    marginBottom: 12,
                }}
            >
                {SOURCES.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => s.id !== source && setSource(s.id)}
                        style={{
                            padding: "6px 16px",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            background:
                                source === s.id
                                    ? "var(--accent, #4a90d9)"
                                    : "var(--card-bg, transparent)",
                            color: source === s.id ? "#fff" : "var(--fg)",
                            fontWeight: source === s.id ? 600 : 400,
                        }}
                    >
                        {s.title}
                    </button>
                ))}
            </div>

            {/* 分类 tab 条 */}
            {categories.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 12,
                    }}
                >
                    {categories.map((c) => (
                        <button
                            key={c}
                            onClick={() => selectCategory(c)}
                            style={{
                                padding: "4px 12px",
                                border: "1px solid var(--border)",
                                borderRadius: 14,
                                cursor: "pointer",
                                background:
                                    !inSearch && category === c
                                        ? "var(--accent, #4a90d9)"
                                        : "var(--card-bg, transparent)",
                                color: !inSearch && category === c ? "#fff" : "var(--fg)",
                                fontSize: 13,
                            }}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}

            {/* 搜索 */}
            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSearch()}
                    placeholder={inSearch ? "搜索 “" + request.keyword + "”…（清空回车回分类）" : "搜索漫画标题…"}
                    style={{ flex: 1, padding: 8 }}
                />
                <button onClick={onSearch} disabled={loading}>
                    {loading ? "加载中…" : "搜索"}
                </button>
            </div>

            {sourceErr && (
                <div
                    style={{
                        margin: "8px 0",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "var(--danger-bg, #fde8e8)",
                        color: "var(--danger, #c0392b)",
                        fontSize: 13,
                    }}
                >
                    加载失败：{sourceErr}（点「搜索」重试）
                </div>
            )}

            {/* 漫画列表 */}
            {comics.length === 0 && !loading ? (
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
                    {sourceErr ? "当前源暂不可用" : "暂无内容"}
                </div>
            ) : (
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
            )}

            {version && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#aaa" }}>
                    Rust core: {version}
                </div>
            )}
        </div>
    );
}
