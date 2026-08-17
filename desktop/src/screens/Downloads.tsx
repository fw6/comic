import { useCallback, useEffect, useState } from "react";
import { Channel } from "@tauri-apps/api/core";
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
import { EmptyState, ProgressBar } from "../components/ui";
import { DownloadIcon, RefreshIcon } from "../components/icons";

const STATUS_LABEL: Record<DownloadStatus, string> = {
    queued: "排队中",
    downloading: "下载中",
    done: "已完成",
    failed: "失败",
    cancelled: "已取消",
};

const STATUS_BADGE: Record<DownloadStatus, string> = {
    queued: "badge--queued",
    downloading: "badge--downloading",
    done: "badge--done",
    failed: "badge--failed",
    cancelled: "badge--cancelled",
};

/** 下载任务队列页（wayfinder #20/#23）：订阅进度事件 + 快照，管理多任务下载。 */
export default function Downloads() {
    const [tasks, setTasks] = useState<DownloadTaskView[]>([]);

    // 订阅进度（Channel 存 Rust State，worker 推送；卸载时退订清理，grilling #23 #6）
    useEffect(() => {
        const channel = new Channel<DownloadProgress>();
        channel.onmessage = (p) => {
            setTasks((prev) =>
                prev.map((t) => (t.taskId === p.taskId ? { ...t, ...p } : t)),
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
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">下载</h1>
                    <div className="page__sub">后台下载任务队列，随时掌握进度</div>
                </div>
                {tasks.length > 0 && (
                    <button className="btn btn--ghost" onClick={() => void onClearFinished()}>
                        <RefreshIcon />
                        清空已完成
                    </button>
                )}
            </div>

            {tasks.length === 0 ? (
                <EmptyState text="暂无下载任务" icon={<DownloadIcon />} />
            ) : (
                <div className="list">
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
    const badge = `badge ${STATUS_BADGE[task.status]}`;
    return (
        <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                    }}
                >
                    <div className="row__title" style={{ flexShrink: 1 }}>
                        {task.comicTitle}
                    </div>
                    <span style={{ color: "var(--fg-3)", fontSize: 12, flexShrink: 0 }}>
                        第 {task.chapterIndex} 话
                    </span>
                    <span className={badge} style={{ flexShrink: 0 }}>
                        {STATUS_LABEL[task.status]}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <ProgressBar pct={pct} done={task.status === "done"} />
                    <span style={{ color: "var(--fg-3)", fontSize: 12, flexShrink: 0 }}>
                        {task.done}/{task.total}
                    </span>
                </div>
                {task.error && (
                    <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>
                        {task.error}
                    </div>
                )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {canCancel && (
                    <button className="btn btn--danger-soft btn--sm" onClick={onCancel}>
                        取消
                    </button>
                )}
                {canRetry && (
                    <button className="btn btn--soft btn--sm" onClick={onRetry}>
                        重试
                    </button>
                )}
            </div>
        </div>
    );
}
