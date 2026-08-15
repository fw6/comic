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

const STATUS_LABEL: Record<DownloadStatus, string> = {
    queued: "排队中",
    downloading: "下载中",
    done: "已完成",
    failed: "失败",
    cancelled: "已取消",
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
        <div style={{ padding: 16 }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                }}
            >
                <h2 style={{ margin: 0 }}>下载</h2>
                <button onClick={() => void onClearFinished()} style={{ cursor: "pointer" }}>
                    清空已完成
                </button>
            </div>
            {tasks.length === 0 ? (
                <div style={{ color: "var(--muted)" }}>暂无下载任务</div>
            ) : (
                <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
                    {tasks.map((t) => (
                        <TaskRow
                            key={t.taskId}
                            task={t}
                            onCancel={() => void onCancel(t.taskId)}
                            onRetry={() => void onRetry(t.taskId)}
                        />
                    ))}
                </ul>
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
        <li
            style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {task.comicTitle}
                        </strong>
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>
                            第 {task.chapterIndex} 话
                        </span>
                        <span style={{ fontSize: 12 }}>{STATUS_LABEL[task.status]}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <div
                            style={{
                                flex: 1,
                                height: 6,
                                background: "var(--border)",
                                borderRadius: 3,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    background: "var(--fg)",
                                }}
                            />
                        </div>
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>
                            {task.done}/{task.total}
                        </span>
                    </div>
                    {task.error && (
                        <div style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                            {task.error}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {canCancel && (
                        <button onClick={onCancel} style={{ cursor: "pointer" }}>
                            取消
                        </button>
                    )}
                    {canRetry && (
                        <button onClick={onRetry} style={{ cursor: "pointer" }}>
                            重试
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}
