import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { crawl, crawlCached, sourceErrors, type Comic, type SourceError } from "../api";
import { persistWebtoonsCache, whenSourcesReady } from "../lib/storage";
import { useIsMobile } from "../lib/platform";
import { SOURCES, sourceTitle } from "../lib/sources";
import { cn } from "../lib/utils";
import {
    Banner,
    ComicCard,
    ComicRow,
    EmptyState,
    Loading,
    PageHeader,
} from "../components/ui";
import { Button } from "../components/beui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/beui/tabs";
import { Input } from "../components/beui/input";
import { SourceSheet } from "../components/source-sheet";
import { ChevronDown, Compass, Search } from "lucide-react";

/** 当前列表要加载什么：分类浏览（label）或搜索（keyword）。 */
interface ListRequest {
    source: string;
    op: "category" | "search";
    category: string | null;
    keyword: string;
}

/** 列表缓存的新鲜窗口：窗口内切换源/分类直接用缓存、不发请求；
 * 窗口外先显示缓存（stale），再拉最新覆盖（revalidate）。 */
const LIST_MAX_AGE_MS = 2 * 60 * 1000;

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
    // 源选择面板（切换源是低频操作，列表收进面板；页头只留当前源按钮）
    const [sheetOpen, setSheetOpen] = useState(false);
    const sourceTriggerRef = useRef<HTMLButtonElement>(null);

    // 切换源：加载分类 tab，默认进第一个分类。SWR：先渲染缓存分类（立即出 tab），再拉最新。
    useEffect(() => {
        if (loadedSource.current === source) return;
        let cancelled = false;
        setCategories([]);
        setInSearch(false);
        setComics([]);
        (async () => {
            // 等源脚本同步完成：registry 未就绪时脚本源的 op 会返回空
            await whenSourcesReady();
            if (cancelled) return;
            const cached = await crawlCached<string[]>("categories", source, {});
            if (cancelled) return;
            if (cached) {
                setCategories(cached.data);
                setCategory(cached.data[0] ?? null);
                setRequest({
                    source,
                    op: "category",
                    category: cached.data[0] ?? null,
                    keyword: "",
                });
            }
            const cats = await crawl<string[]>("categories", source, {}).catch(
                (): string[] => [],
            );
            if (cancelled) return;
            loadedSource.current = source;
            // 源返回空（可能失败）且已有缓存时，保留缓存分类
            if (cats.length > 0 || !cached) setCategories(cats);
            if (!cached) {
                setCategory(cats[0] ?? null);
                setRequest({ source, op: "category", category: cats[0] ?? null, keyword: "" });
            }
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

    // 按 request 加载列表（分类浏览或搜索结果）。SWR：先渲染缓存列表，再拉最新替换；
    // 缓存足够新（窗口内）时跳过本次请求（切源往返不重复拉取）。
    useEffect(() => {
        if (request.op === "category" && !request.category) return;
        if (loadedRequest.current === request) return;
        const seq = ++listSeq.current;
        setLoading(true);
        setSourceErr(null);
        (async () => {
            const payload =
                request.op === "search"
                    ? { keyword: request.keyword }
                    : { label: request.category };
            try {
                const cached = await crawlCached<Comic[]>(
                    request.op,
                    request.source,
                    payload,
                );
                if (seq !== listSeq.current) return;
                if (cached) {
                    setComics(cached.data);
                    setLoading(false);
                    if (Date.now() - cached.fetchedAt < LIST_MAX_AGE_MS) {
                        loadedRequest.current = request;
                        return;
                    }
                }
                const results = await crawl<Comic[]>(
                    request.op,
                    request.source,
                    payload,
                );
                if (seq !== listSeq.current) return;
                loadedRequest.current = request;
                // 源返回空（可能失败）且已有缓存展示时，保留缓存列表（错误行经 sourceErr 呈现）
                if (results.length > 0 || !cached) setComics(results);
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
                title="发现"
                sub="搜索漫画，或按分类浏览"
                actions={
                    <button
                        type="button"
                        ref={sourceTriggerRef}
                        onClick={() => setSheetOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={sheetOpen}
                        className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-full bg-primary/12 pl-3 pr-2.5 text-xs font-medium text-primary",
                            "transition-colors hover:bg-primary/20",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        )}
                    >
                        {sourceTitle(source)}
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                    </button>
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

            {/* 分类（beui Tabs：弹簧滑块指示器）；源列表在页头的选择面板里 */}
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
                <Loading label="正在加载列表" />
            ) : isEmpty ? (
                <EmptyState
                    icon={<Compass className="size-7" />}
                    text={sourceErr ? "这个漫画源暂时用不了" : "这里还没有漫画"}
                    hint={
                        sourceErr
                            ? "换一个漫画源，或稍后再试"
                            : "换个分类，或搜别的词"
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

            <SourceSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                current={source}
                onSelect={setSource}
                restoreFocusRef={sourceTriggerRef}
            />
        </div>
    );
}
