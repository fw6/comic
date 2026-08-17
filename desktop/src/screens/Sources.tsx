import { useEffect, useRef, useState } from "react";
import { crawl, sourceErrors, type Comic, type SourceError } from "../api";
import { persistWebtoonsCache } from "../lib/storage";
import { useIsMobile } from "../lib/platform";
import { Banner, ComicCard, ComicRow, EmptyState } from "../components/ui";
import { CloseIcon, SearchIcon } from "../components/icons";

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
    const mobile = useIsMobile();
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
    // 源脚本错误行（wayfinder #17：源坏了不再伪装成空列表）
    const [sourceErr, setSourceErr] = useState<string | null>(null);
    // 请求序号：丢弃过期响应，避免分类/搜索竞态
    const listSeq = useRef(0);

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
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">书源</h1>
                    <div className="page__sub">浏览各大漫画源，或搜索你喜欢的作品</div>
                </div>
            </div>

            {/* 搜索栏（参考移动端风格） */}
            <div className="searchbar">
                <SearchIcon />
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSearch()}
                    placeholder="搜索漫画标题…"
                    aria-label="搜索漫画标题"
                />
                {keyword && (
                    <button
                        className="searchbar__clear"
                        onClick={() => setKeyword("")}
                        aria-label="清空搜索"
                    >
                        <CloseIcon />
                    </button>
                )}
                <button className="btn btn--primary btn--sm" onClick={onSearch} disabled={loading}>
                    {loading ? "加载中…" : "搜索"}
                </button>
            </div>

            {/* 源 tab 条 */}
            <div className="pill-row" aria-label="漫画源">
                {SOURCES.map((s) => (
                    <button
                        key={s.id}
                        aria-pressed={source === s.id}
                        onClick={() => s.id !== source && setSource(s.id)}
                        className={`pill ${source === s.id ? "pill--active" : ""}`}
                    >
                        {s.title}
                    </button>
                ))}
            </div>

            {/* 分类 tab 条 */}
            {categories.length > 0 && (
                <div className="pill-row" aria-label="分类">
                    {categories.map((c) => (
                        <button
                            key={c}
                            aria-pressed={!inSearch && category === c}
                            onClick={() => selectCategory(c)}
                            className={`pill ${!inSearch && category === c ? "pill--accent" : ""}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}

            {sourceErr && (
                <Banner>
                    加载失败：{sourceErr}（点「搜索」重试）
                </Banner>
            )}

            {/* 漫画列表：桌面网格卡片 / 移动端列表行（参考图风格） */}
            {loading && comics.length === 0 ? (
                <div className="spinner" />
            ) : comics.length === 0 ? (
                <EmptyState text={sourceErr ? "当前源暂不可用" : "暂无内容"} />
            ) : mobile ? (
                <div className="list">
                    {comics.map((c, i) => (
                        <ComicRow
                            key={c.id}
                            delay={Math.min(i * 28, 280)}
                            to={`/comic/${c.source}/${encodeURIComponent(c.id)}`}
                            cover={c.cover}
                            title={c.title}
                            subtitle={c.author || "未知作者"}
                            tags={c.tags}
                            chapterTag={c.lastChapter.replace(/^#/, "")}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid">
                    {comics.map((c, i) => (
                        <ComicCard key={c.id} comic={c} delay={Math.min(i * 30, 300)} />
                    ))}
                </div>
            )}
        </div>
    );
}
