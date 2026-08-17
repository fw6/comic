import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { imgSrc, type Comic } from "../api";
import { AlertIcon, ChevronRightIcon, InboxIcon } from "./icons";

/**
 * 共享 UI 原语：封面、标签、漫画卡片/列表行、空状态、开关等。
 * 各屏幕组合这些原语，样式由 index.css 设计令牌驱动。
 */

/* ---------- 封面（加载 shimmer + 失败回退） ---------- */

export function Cover({
    src,
    alt,
    className,
}: {
    src: string;
    alt: string;
    className?: string;
}) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const showShimmer = !loaded && !error;
    return (
        <div className={`cover ${showShimmer ? "cover--shimmer" : ""} ${className ?? ""}`}>
            {error ? (
                <div className="cover__fallback">{alt.trim().charAt(0) || "C"}</div>
            ) : (
                <img
                    className={`cover__img ${loaded ? "cover__img--loaded" : ""}`}
                    src={src}
                    alt={alt}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                />
            )}
        </div>
    );
}

/* ---------- 标签 ---------- */

export function Tag({
    children,
    accent,
    mono,
}: {
    children: ReactNode;
    accent?: boolean;
    mono?: boolean;
}) {
    const cls = [
        "tag",
        accent ? "tag--accent" : "",
        mono ? "tag--mono" : "",
    ]
        .filter(Boolean)
        .join(" ");
    return <span className={cls}>{children}</span>;
}

/* ---------- 漫画网格卡片（桌面） ---------- */

export function ComicCard({ comic, delay }: { comic: Comic; delay?: number }) {
    return (
        <Link
            to={`/comic/${comic.source}/${encodeURIComponent(comic.id)}`}
            className="card"
            style={{ animationDelay: delay ? `${delay}ms` : undefined }}
        >
            <Cover src={imgSrc(comic.cover)} alt={comic.title} />
            <div>
                <div className="card__title">{comic.title}</div>
                <div className="card__author">{comic.author || "未知作者"}</div>
            </div>
        </Link>
    );
}

/* ---------- 漫画列表行（移动端，参考图风格） ---------- */

export function ComicRow({
    to,
    cover,
    title,
    subtitle,
    meta,
    tags,
    chapterTag,
    delay,
}: {
    to: string;
    cover: string;
    title: string;
    subtitle?: string;
    meta?: string;
    tags?: string[];
    chapterTag?: string;
    delay?: number;
}) {
    return (
        <Link
            to={to}
            className="row"
            style={{ animationDelay: delay ? `${delay}ms` : undefined }}
        >
            <Cover src={imgSrc(cover)} alt={title} />
            <div className="row__body">
                <div className="row__title">{title}</div>
                {subtitle && <div className="row__author">{subtitle}</div>}
                {meta && <div className="row__caption">{meta}</div>}
                {(tags !== undefined || chapterTag !== undefined) && (
                    <div className="tag-row">
                        {tags?.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
                        {chapterTag && <Tag accent mono>#{chapterTag}</Tag>}
                    </div>
                )}
            </div>
            <span className="row__chevron">
                <ChevronRightIcon />
            </span>
        </Link>
    );
}

/* ---------- 空状态 ---------- */

export function EmptyState({ text, icon }: { text: string; icon?: ReactNode }) {
    return (
        <div className="empty">
            {icon ?? <InboxIcon />}
            <div className="empty__text">{text}</div>
        </div>
    );
}

/* ---------- 加载 ---------- */

export function Spinner() {
    return <div className="spinner" aria-label="加载中" />;
}

/* ---------- 错误横幅 ---------- */

export function Banner({ children }: { children: ReactNode }) {
    return (
        <div className="banner">
            <AlertIcon />
            <div>{children}</div>
        </div>
    );
}

/* ---------- 开关 ---------- */

export function Switch({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            className={`switch ${checked ? "switch--on" : ""}`}
            onClick={() => onChange(!checked)}
        />
    );
}

/* ---------- 进度条 ---------- */

export function ProgressBar({
    pct,
    done,
}: {
    pct: number;
    done?: boolean;
}) {
    return (
        <div className="progress">
            <div
                className={`progress__bar ${done ? "progress__bar--done" : ""}`}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
        </div>
    );
}
