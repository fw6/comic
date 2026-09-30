import { useCallback, useEffect, useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import {
    cancelDownload,
    clearDownloads,
    getDownloads,
    retryDownload,
    subscribeDownloads,
    unsubscribeDownloads,
    type DownloadProgress,
    type DownloadStatus,
    type DownloadTaskView,
} from "../api";
import {
    EmptyState,
    Loading,
    PageHeader,
    ProgressBar,
    Tag,
} from "../components/ui";
import { Button } from "../components/beui/button";
import {
    AnimatedBadge,
    type AnimatedBadgeStatus,
} from "../components/beui/animated-badge";
import { AnimatedNumber } from "../components/beui/animated-number";

const STATUS_LABEL: Record<DownloadStatus, string> = {
    queued: "排队中",
    downloading: "下载中",
    done: "已完成",
    failed: "失败",
    cancelled: "已取消",
};

const STATUS_BADGE: Record<DownloadStatus, AnimatedBadgeStatus> = {
    queued: "neutral",
    downloading: "loading",
    done: "success",
    failed: "danger",
    cancelled: "warning",
};

/** 完成/取消两态在浅色主题下要用本仓库的语义色（beui 原生的 emerald/amber 偏亮）。 */
const STATUS_BADGE_CLASS: Record<DownloadStatus, string> = {
    queued: "",
    downloading: "",
    done: "text-success",
    failed: "",
    cancelled: "text-warning",
};

/** 下载任务队列页（wayfinder #20/#23）：订阅进度事件 + 快照，管理多任务下载。 */
export default function Downloads() {
    const [tasks, setTasks] = useState<DownloadTaskView[] | null>(null);

    // 订阅进度（Channel 存 Rust State，worker 推送；卸载时退订清理，grilling #23 #6）
    useEffect(() => {
        const channel = new Channel<DownloadProgress>();
        channel.onmessage = (p) => {
            setTasks((prev) =>
                prev?.map((t) => (t.taskId === p.taskId ? { ...t, ...p } : t)) ??
                null,
            );
        };
        void subscribeDownloads(channel);
        void getDownloads().then(setTasks);
        return () => {
            void unsubscribeDownloads();
        };
    }, []);

    const refresh = useCallback(() => {
        void getDownloads().then(setTasks);
    }, []);

    async function onCancel(taskId: string) {
        await cancelDownload(taskId);
        refresh();
    }

    async function onRetry(taskId: string) {
        await retryDownload(taskId);
        refresh();
    }

    async function onClearFinished() {
        await clearDownloads();
        refresh();
    }

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
            <PageHeader
                title="下载"
                sub="后台下载任务队列，随时掌握进度"
                actions={
                    tasks && tasks.length > 0 ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void onClearFinished()}
                        >
                            <Trash2 className="size-3.5" />
                            清空已完成
                        </Button>
                    ) : undefined
                }
            />

            {tasks === null ? (
                <Loading label="读取下载队列" />
            ) : tasks.length === 0 ? (
                <EmptyState
                    icon={<Download className="size-7" />}
                    text="暂无下载任务"
                    hint="在阅读器里点「下载本话」把章节存到本地"
                />
            ) : (
                <div className="flex flex-col gap-2">
                    {tasks.map((t) => (
                        <TaskRow
                            key={t.taskId}
                            task={t}
                            onCancel={() => void onCancel(t.taskId)}
                            onRetry={() => void onRetry(t.taskId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function TaskRow({
    task,
    onCancel,
    onRetry,
}: {
    task: DownloadTaskView;
    onCancel: () => void;
    onRetry: () => void;
}) {
    const pct = task.total === 0 ? 0 : Math.round((task.done / task.total) * 100);
    const canCancel = task.status === "queued" || task.status === "downloading";
    const canRetry = task.status === "failed" || task.status === "cancelled";
    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {task.comicTitle}
                </span>
                <Tag>第 {task.chapterIndex} 话</Tag>
                <AnimatedBadge
                    status={STATUS_BADGE[task.status]}
                    size="sm"
                    contentKey={task.status}
                    className={STATUS_BADGE_CLASS[task.status]}
                >
                    {STATUS_LABEL[task.status]}
                </AnimatedBadge>
                <div className="flex items-center gap-1.5">
                    {canCancel && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            取消
                        </Button>
                    )}
                    {canRetry && (
                        <Button variant="secondary" size="sm" onClick={onRetry}>
                            <RotateCcw className="size-3.5" />
                            重试
                        </Button>
                    )}
                </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
                <ProgressBar pct={pct} done={task.status === "done"} />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    <AnimatedNumber value={task.done} startOnView={false} />
                    {" / "}
                    {task.total}
                </span>
            </div>

            {task.error && (
                <div className="mt-2 text-xs text-destructive">{task.error}</div>
            )}
        </div>
    );
}
