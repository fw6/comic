import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useScroll } from "motion/react";
import { ArrowLeft, BookOpen, Check, Heart } from "lucide-react";
import { crawl, imgSrc, type Chapter, type Comic } from "../api";
import { filterExternalChapters } from "../lib/chapters";
import { getProgress, isFavorite, toggleFavorite } from "../lib/storage";
import { cn } from "../lib/utils";
import { sourceTitle } from "../lib/sources";
import { useScrollContainerRef } from "../lib/scroll-container";
import {
    Banner,
    Cover,
    EmptyState,
    LinkButton,
    Loading,
    Reveal,
    Tag,
} from "../components/ui";
import { Button } from "../components/beui/button";
import { ScrollProgress } from "../components/beui/scroll-progress";

const STATUS_LABEL: Record<string, string> = {
    serial: "连载中",
    completed: "已完结",
    hiatus: "暂停",
};

export default function Detail() {
    const { source, comicId } = useParams();
    const navigate = useNavigate();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const [comic, setComic] = useState<Comic | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [favorite, setFavorite] = useState(false);
    const [resume, setResume] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const container = useScrollContainerRef();
    const { scrollYProgress } = useScroll(
        container ? { container } : { container: undefined },
    );

    useEffect(() => {
        let cancelled = false;
        setError(null);
        (async () => {
            try {
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
            } catch (e) {
                if (cancelled) return;
                setError(
                    e instanceof Error && e.message
                        ? e.message
                        : "源没有返回这部作品的信息",
                );
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [source, id, reloadKey]);

    async function onToggleFavorite() {
        if (!comic) return;
        setFavorite(await toggleFavorite(comic));
    }

    if (error) {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
                <BackButton onClick={() => navigate(-1)} />
                <Banner>
                    加载失败：{error}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        重试
                    </Button>
                </Banner>
            </div>
        );
    }

    if (!comic) {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
                <BackButton onClick={() => navigate(-1)} />
                <Loading label="读取作品信息" />
            </div>
        );
    }

    return (
        <>
            <ScrollProgress
                progress={scrollYProgress}
                fixed
                height={2}
                className="bg-primary"
            />
            <div
                className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8"
            >
                <BackButton onClick={() => navigate(-1)} />

                <div className="flex flex-col gap-6 md:flex-row md:gap-8">
                    <Cover
                        src={imgSrc(comic.cover)}
                        alt={comic.title}
                        className="mx-auto w-40 shrink-0 rounded-lg md:mx-0 md:w-52"
                    />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            {comic.title}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <Tag tone="primary">{sourceTitle(comic.source)}</Tag>
                            {comic.author && <span>{comic.author}</span>}
                            {STATUS_LABEL[comic.status] && (
                                <span>· {STATUS_LABEL[comic.status]}</span>
                            )}
                            {comic.updateTime && <span>· {comic.updateTime}</span>}
                        </div>

                        {comic.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {comic.tags.map((t) => (
                                    <Tag key={t}>{t}</Tag>
                                ))}
                            </div>
                        )}

                        {comic.intro && (
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                {comic.intro}
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap gap-2">
                            {resume !== null && (
                                <LinkButton
                                    to={`/reader/${source}/${encodeURIComponent(id)}/${resume}`}
                                    variant="primary"
                                    size="lg"
                                >
                                    <BookOpen className="size-4" />
                                    继续阅读 第 {resume} 话
                                </LinkButton>
                            )}
                            {resume === null && chapters.length > 0 && (
                                <LinkButton
                                    to={`/reader/${source}/${encodeURIComponent(id)}/${chapters[0].index}`}
                                    variant="primary"
                                    size="lg"
                                >
                                    <BookOpen className="size-4" />
                                    开始阅读
                                </LinkButton>
                            )}
                            <Button
                                variant="secondary"
                                size="lg"
                                onClick={() => void onToggleFavorite()}
                                aria-pressed={favorite}
                            >
                                <Heart
                                    className={cn(
                                        "size-4",
                                        favorite && "fill-primary text-primary",
                                    )}
                                />
                                {favorite ? "已收藏" : "收藏"}
                            </Button>
                        </div>
                    </div>
                </div>

                <section className="mt-8">
                    <header className="mb-4 flex items-end justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">
                                章节
                            </h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {chapters.length === 0
                                    ? "该作品暂无可用章节（外链章节已过滤）"
                                    : `共 ${chapters.length} 话`}
                            </p>
                        </div>
                    </header>

                    {chapters.length === 0 ? (
                        <EmptyState
                            icon={<BookOpen className="size-7" />}
                            text="暂无可用章节"
                            hint="该作品只有站外链接章节，已按设置过滤"
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {chapters.map((ch, i) => (
                                <Reveal
                                    key={ch.index}
                                    delay={Math.min(i * 12, 240)}
                                >
                                    <Link
                                        to={`/reader/${source}/${encodeURIComponent(id)}/${ch.index}`}
                                        className={cn(
                                            "flex h-full items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors",
                                            ch.index === resume
                                                ? "border-primary/50 bg-primary/10 text-foreground"
                                                : "border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {ch.title}
                                        </span>
                                        {ch.downloaded && (
                                            <Check
                                                className="size-3.5 shrink-0 text-success"
                                                aria-label="已下载"
                                            />
                                        )}
                                    </Link>
                                </Reveal>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className="mb-4 -ml-2 hidden md:inline-flex"
        >
            <ArrowLeft className="size-4" />
            返回
        </Button>
    );
}
