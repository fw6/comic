import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { crawl, type Chapter, type Comic } from "../api";
import { filterExternalChapters } from "../lib/chapters";
import { getProgress, isFavorite, toggleFavorite } from "../lib/storage";
import { Cover, EmptyState, Tag } from "../components/ui";
import { BackIcon, BookOpenIcon, CheckIcon, HeartIcon } from "../components/icons";

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
        <div className="page">
            {/* 桌面端返回（移动端由顶部栏提供） */}
            <button className="detail__back icon-btn" onClick={() => navigate(-1)} aria-label="返回">
                <BackIcon />
            </button>

            {comic ? (
                <>
                    <div className="detail">
                        <Cover src={comic.cover} alt={comic.title} className="detail__cover" />
                        <div className="detail__info">
                            <h1>{comic.title}</h1>
                            <div className="detail__meta">
                                {comic.author && <span>{comic.author}</span>}
                                {STATUS_LABEL[comic.status] && (
                                    <span> · {STATUS_LABEL[comic.status]}</span>
                                )}
                                {comic.updateTime && <span> · {comic.updateTime}</span>}
                            </div>
                            {comic.tags.length > 0 && (
                                <div className="tag-row" style={{ marginBottom: 16 }}>
                                    {comic.tags.map((t) => (
                                        <Tag key={t}>{t}</Tag>
                                    ))}
                                </div>
                            )}
                            {comic.intro && <p className="detail__intro">{comic.intro}</p>}
                            <div className="detail__actions">
                                {resume !== null && (
                                    <Link
                                        className="btn btn--primary btn--lg"
                                        to={`/reader/${source}/${encodeURIComponent(id)}/${resume}`}
                                    >
                                        <BookOpenIcon />
                                        继续阅读 第 {resume} 话
                                    </Link>
                                )}
                                <button
                                    className="btn btn--ghost btn--lg"
                                    onClick={() => void onToggleFavorite()}
                                    aria-pressed={favorite}
                                >
                                    <HeartIcon
                                        fill={favorite ? "currentColor" : "none"}
                                    />
                                    {favorite ? "已收藏" : "收藏"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="chapters">
                        <div className="panel__head">
                            <div>
                                <div className="panel__title">章节</div>
                                <div className="panel__desc">
                                    {chapters.length === 0
                                        ? "该作品暂无可用章节（外链章节已过滤）"
                                        : `共 ${chapters.length} 话`}
                                </div>
                            </div>
                        </div>
                        {chapters.length === 0 ? (
                            <EmptyState text="该作品暂无可用章节（外链章节已过滤）" />
                        ) : (
                            <div className="chapters__grid">
                                {chapters.map((ch) => (
                                    <Link
                                        key={ch.index}
                                        className={`chapter-item ${
                                            ch.index === resume ? "chapter-item--current" : ""
                                        }`}
                                        to={`/reader/${source}/${encodeURIComponent(id)}/${ch.index}`}
                                    >
                                        {ch.index === resume && <span className="chapter-item__dot" />}
                                        <span className="chapter-item__title">{ch.title}</span>
                                        {ch.downloaded && (
                                            <CheckIcon
                                                width={14}
                                                height={14}
                                                style={{ color: "var(--success)", flexShrink: 0 }}
                                            />
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="spinner" />
            )}
        </div>
    );
}
