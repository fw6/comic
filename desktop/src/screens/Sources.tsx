import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { crawl, sourceErrors, type Comic, type SourceError } from "../api";
import { persistWebtoonsCache } from "../lib/storage";
import { useIsMobile } from "../lib/platform";
import { SOURCES } from "../lib/sources";
import { cn } from "../lib/utils";
import {
    Banner,
    ComicCard,
    ComicRow,
    EmptyState,
    Loading,
    PageHeader,
    Tag,
} from "../components/ui";
import { Button } from "../components/beui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/beui/tabs";
import { Input } from "../components/beui/input";
import { Compass, Search } from "lucide-react";

/** 当前列表要加载什么：分类浏览（label）或搜索（keyword）。 */
interface ListRequest {
    source: string;
    op: "category" | "search";
    category: string | null;
    keyword: string;
}

export default function Sources() {
    const mobile = useIsMobile();
    const [params] = useSearchParams();
    const [source, setSource] = useState(params.get("source") ?? SOURCES[0].id);
    const [categories, setCategories] = useState<string[]>([]);
    // 高亮的分类 tab（浏览模式）
    const [category, setCategory] = useState<string | null>(null);
    // 当前视图是否为搜索结果（用于 tab 高亮/输入框提示）
    const [inSearch, setInSearch] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [request, setRequest] = useState<ListRequest>({
        source: params.get("source") ?? SOURCES[0].id,
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
    // 已经建好目录的源 / 已经取到结果的请求：effect 被重放（React 开发期会重跑）时不再
    // 重复取，也不清掉用户正在看的分类与列表。只在拿到结果后才记，重放时没取完的照常重取。
    const loadedSource = useRef<string | null>(null);
    const loadedRequest = useRef<ListRequest | null>(null);

    // 切换源：加载分类 tab，默认进第一个分类
    useEffect(() => {
        if (loadedSource.current === source) return;
        let cancelled = false;
        setCategories([]);
        setInSearch(false);
        setComics([]);
        (async () => {
            const cats = await crawl<string[]>("categories", source, {}).catch(
                (): string[] => [],
            );
            if (cancelled) return;
            loadedSource.current = source;
            setCategories(cats);
            const first = cats[0] ?? null;
            setCategory(first);
            setRequest({ source, op: "category", category: first, keyword: "" });
            const errs = await sourceErrors().catch(
                (): Record<string, SourceError> => ({}),
            );
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
        if (loadedRequest.current === request) return;
        const seq = ++listSeq.current;
        setLoading(true);
        setSourceErr(null);
        (async () => {
            try {
                const payload =
                    request.op === "search"
                        ? { keyword: request.keyword }
                        : { label: request.category };
                const results = await crawl<Comic[]>(
                    request.op,
                    request.source,
                    payload,
                );
                if (seq !== listSeq.current) return;
                loadedRequest.current = request;
                setComics(results);
                if (request.source === "webtoons") void persistWebtoonsCache();
            } catch (e) {
                console.error("list failed", e);
            } finally {
                if (seq !== listSeq.current) return;
                const errs = await sourceErrors().catch(
                    (): Record<string, SourceError> => ({}),
                );
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
            if (category)
                setRequest({ source, op: "category", category, keyword: "" });
            return;
        }
        setInSearch(true);
        setRequest({ source, op: "search", category: null, keyword: kw });
    }

    const isEmpty = !loading && comics.length === 0;

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
            <PageHeader
                title="书源"
                sub="浏览各大漫画源，或搜索你喜欢的作品"
                actions={
                    <Tag tone="primary">
                        {SOURCES.find((s) => s.id === source)?.title ?? source}
                    </Tag>
                }
            />

            <div className="mb-4 flex items-end gap-2">
                <Input
                    className="flex-1"
                    value={keyword}
                    onChange={setKeyword}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSearch();
                    }}
                    placeholder="搜索漫画标题…"
                    leftIcon={<Search className="size-4" />}
                    aria-label="搜索漫画标题"
                />
                <Button
                    variant="primary"
                    size="md"
                    onClick={onSearch}
                    disabled={loading}
                >
                    {loading ? "加载中…" : "搜索"}
                </Button>
            </div>

            {/* 源与分类（beui Tabs：弹簧滑块指示器） */}
            <Tabs
                value={source}
                onValueChange={(v) => v !== source && setSource(v)}
                variant="pill"
                className="mb-2 w-full"
            >
                <TabsList className="max-w-full bg-card">
                    {SOURCES.map((s) => (
                        <TabsTrigger key={s.id} value={s.id}>
                            {s.title}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {categories.length > 0 && (
                <Tabs
                    value={inSearch ? "__search" : (category ?? "")}
                    onValueChange={selectCategory}
                    variant="segment"
                    className="mb-5 w-full"
                >
                    <TabsList className="max-w-full bg-card">
                        {categories.map((c) => (
                            <TabsTrigger key={c} value={c}>
                                {c}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            )}

            {sourceErr && (
                <Banner>
                    加载失败：{sourceErr}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={onSearch}
                    >
                        重试
                    </Button>
                </Banner>
            )}

            {loading && comics.length === 0 ? (
                <Loading label="正在读取列表" />
            ) : isEmpty ? (
                <EmptyState
                    icon={<Compass className="size-7" />}
                    text={sourceErr ? "当前源暂不可用" : "暂无内容"}
                    hint={
                        sourceErr
                            ? "可以换一个源，或稍后再试"
                            : "换一个分类，或搜索其它关键词"
                    }
                />
            ) : (
                <div
                    className={cn(
                        "transition-opacity duration-200",
                        loading && "pointer-events-none opacity-50",
                    )}
                    aria-busy={loading}
                >
                    {mobile ? (
                        <div className="flex flex-col gap-2">
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
                        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                            {comics.map((c, i) => (
                                <ComicCard
                                    key={c.id}
                                    comic={c}
                                    delay={Math.min(i * 30, 300)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
