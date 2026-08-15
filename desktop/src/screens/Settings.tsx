import { useEffect, useState, type ReactNode } from "react";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import {
    getSettings,
    setSettings,
    exportBackupJson,
    parseBackupJson,
    importBackupData,
    type Settings as SettingsT,
} from "../lib/storage";
import { applyTheme } from "../lib/theme";
import {
    getSources,
    setSources,
    type SourceEntry,
} from "../lib/storage";
import { syncSources, sourceErrors, webdavGet, webdavPut, type SourceError } from "../api";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** 备份文件名（grilling #25 #2：单文件聚合）。 */
const BACKUP_FILE = "cimoc-backup.json";

/** macOS 平台检测：ad-hoc 签名无法过 Gatekeeper 整包替换，macOS 不发自动更新（wayfinder #26）。 */
const IS_MACOS = navigator.userAgent.includes("Mac");

/** 源仓库 index（wayfinder #16：公开单一 JSON，每源条目含内嵌脚本 + 整数版本 + sha256）。 */
const REPO_INDEX_URL =
    "https://raw.githubusercontent.com/fw6/cimoc-sources/main/sources.json";

interface RepoEntry {
    name: string;
    version: number;
    script: string;
    sha256: string;
}

async function sha256Hex(s: string): Promise<string> {
    const data = new TextEncoder().encode(s);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export default function Settings() {
    const [settings, setSettingsState] = useState<SettingsT | null>(null);
    // 源区（wayfinder #16/#17）
    const [sources, setSourcesState] = useState<Record<string, SourceEntry>>({});
    const [errors, setErrors] = useState<Record<string, SourceError>>({});
    const [checking, setChecking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [updates, setUpdates] = useState<Record<string, RepoEntry>>({});
    const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    // WebDAV 段（wayfinder #24/#25）
    const [webdav, setWebdav] = useState({ baseUrl: "", user: "", password: "" });
    const [backing, setBacking] = useState(false);
    const [restoring, setRestoring] = useState(false);
    // 更新段（wayfinder #26/#27：检查/下载进度/重启安装）
    const [update, setUpdate] = useState<Update | null>(null);
    const [checkingUpd, setCheckingUpd] = useState(false);
    const [downloadingUpd, setDownloadingUpd] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [updProgress, setUpdProgress] = useState<{ done: number; total: number } | null>(null);

    useEffect(() => {
        void getSettings().then((s) => {
            setSettingsState(s);
            if (s.webdav) setWebdav(s.webdav);
        });
        void refreshSources();
    }, []);

    async function refreshSources() {
        const [srcs, errs] = await Promise.all([
            getSources(),
            sourceErrors().catch(() => ({})),
        ]);
        setSourcesState(srcs);
        setErrors(errs);
    }

    async function pickDir() {
        const dir = await open({ directory: true });
        if (typeof dir !== "string") return;
        await setSettings({ downloadDir: dir });
        setSettingsState((s) => (s ? { ...s, downloadDir: dir } : s));
    }

    async function toggleDark(dark: boolean) {
        await setSettings({ darkMode: dark });
        applyTheme(dark);
        setSettingsState((s) => (s ? { ...s, darkMode: dark } : s));
    }

    async function toggleTrim(trim: boolean) {
        await setSettings({ autoTrim: trim });
        setSettingsState((s) => (s ? { ...s, autoTrim: trim } : s));
    }

    // ---------- 源更新（手动检查，wayfinder #16） ----------

    async function checkUpdates() {
        setChecking(true);
        setNotice(null);
        try {
            const resp = await fetch(REPO_INDEX_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const index = (await resp.json()) as Record<string, RepoEntry>;
            const installed = await getSources();
            const found: Record<string, RepoEntry> = {};
            for (const [id, entry] of Object.entries(installed)) {
                const repo = index[id];
                if (repo && repo.version > entry.version) found[id] = repo;
            }
            setUpdates(found);
            setNotice(
                Object.keys(found).length > 0
                    ? { kind: "ok", text: `有 ${Object.keys(found).length} 个源可更新` }
                    : { kind: "ok", text: "已是最新版本" },
            );
        } catch (e) {
            setNotice({ kind: "err", text: `检查更新失败：${String(e)}` });
        } finally {
            setChecking(false);
        }
    }

    async function applyUpdates() {
        setApplying(true);
        setNotice(null);
        try {
            const installed = await getSources();
            let applied = 0;
            let failed = 0;
            for (const [id, repo] of Object.entries(updates)) {
                const hex = await sha256Hex(repo.script);
                if (hex !== repo.sha256) {
                    failed += 1;
                    continue; // sha 不符：拒绝替换，旧版本保留
                }
                installed[id] = {
                    sourceId: id,
                    name: repo.name,
                    version: repo.version,
                    script: repo.script,
                    updatedAt: Date.now(),
                };
                applied += 1;
            }
            await setSources(installed);
            const scripts: Record<string, string> = {};
            for (const [id, e] of Object.entries(installed)) scripts[id] = e.script;
            await syncSources(scripts);
            setUpdates({});
            await refreshSources();
            setNotice(
                failed > 0
                    ? { kind: "err", text: `应用 ${applied} 个，${failed} 个校验失败已跳过（保留旧版本）` }
                    : { kind: "ok", text: `已应用 ${applied} 个源更新` },
            );
        } catch (e) {
            setNotice({ kind: "err", text: `应用更新失败：${String(e)}` });
        } finally {
            setApplying(false);
        }
    }

    // ---------- WebDAV 备份/恢复（wayfinder #24/#25） ----------

    async function onWebdavChange(patch: Partial<typeof webdav>) {
        const next = { ...webdav, ...patch };
        setWebdav(next);
        await setSettings({ webdav: next });
        setSettingsState((s) => (s ? { ...s, webdav: next } : s));
    }

    async function backupNow() {
        setBacking(true);
        setNotice(null);
        try {
            if (!webdav.baseUrl || !webdav.user || !webdav.password) {
                throw new Error("请填写 WebDAV 地址、账号与密码");
            }
            const content = await exportBackupJson();
            const res = await webdavPut(
                webdav.baseUrl,
                webdav.user,
                webdav.password,
                BACKUP_FILE,
                content,
            );
            if (!res.success) throw new Error(`WebDAV 返回 HTTP ${res.status}`);
            setNotice({ kind: "ok", text: "备份成功（收藏/历史/进度）" });
        } catch (e) {
            setNotice({ kind: "err", text: `备份失败：${String(e)}` });
        } finally {
            setBacking(false);
        }
    }

    async function restoreNow() {
        setRestoring(true);
        setNotice(null);
        try {
            if (!webdav.baseUrl || !webdav.user || !webdav.password) {
                throw new Error("请填写 WebDAV 地址、账号与密码");
            }
            const confirmed = await confirm(
                "恢复将用备份内容整体覆盖本地的收藏、历史与进度，确定继续？",
                { title: "恢复备份", kind: "warning" },
            );
            if (!confirmed) return;
            const res = await webdavGet(
                webdav.baseUrl,
                webdav.user,
                webdav.password,
                BACKUP_FILE,
            );
            if (!res.ok) {
                throw new Error(
                    res.error ? `WebDAV 读取失败：${res.error}` : `WebDAV 返回 HTTP ${res.status}`,
                );
            }
            const data = parseBackupJson(res.content ?? "{}");
            await importBackupData(data);
            setNotice({ kind: "ok", text: "恢复成功（收藏/历史/进度已覆盖）" });
        } catch (e) {
            setNotice({ kind: "err", text: `恢复失败：${String(e)}` });
        } finally {
            setRestoring(false);
        }
    }

    // ---------- 自动更新（wayfinder #26/#27：设置页手动检查） ----------

    async function checkForUpdate() {
        setCheckingUpd(true);
        setNotice(null);
        try {
            const found = await checkUpdate();
            setUpdate(found);
            setDownloaded(false);
            setUpdProgress(null);
            if (found) {
                setNotice({ kind: "ok", text: `发现新版本 v${found.version}` });
            } else {
                setNotice({ kind: "ok", text: "已是最新版本" });
            }
        } catch (e) {
            setNotice({ kind: "err", text: `检查更新失败：${String(e)}` });
        } finally {
            setCheckingUpd(false);
        }
    }

    async function downloadUpdate() {
        if (!update) return;
        setDownloadingUpd(true);
        setNotice(null);
        try {
            await update.download((event) => {
                if (event.event === "Started") {
                    setUpdProgress({ done: 0, total: event.data.contentLength ?? 0 });
                } else if (event.event === "Progress") {
                    setUpdProgress((p) => ({
                        done: (p?.done ?? 0) + event.data.chunkLength,
                        total: p?.total ?? 0,
                    }));
                } else if (event.event === "Finished") {
                    setUpdProgress(null);
                }
            });
            setDownloaded(true);
            setNotice({ kind: "ok", text: "更新已下载，点击「重启安装」生效" });
        } catch (e) {
            setNotice({ kind: "err", text: `下载更新失败：${String(e)}` });
        } finally {
            setDownloadingUpd(false);
        }
    }

    async function installAndRelaunch() {
        if (!update) return;
        try {
            await update.install();
            await relaunch();
        } catch (e) {
            setNotice({ kind: "err", text: `安装更新失败：${String(e)}` });
        }
    }

    if (!settings) {
        return <div style={{ padding: 16 }}>加载中…</div>;
    }

    const sourceList = Object.values(sources);

    return (
        <div style={{ padding: 16, maxWidth: 560 }}>
            <h2 style={{ marginTop: 0 }}>设置</h2>
            <Row label="下载目录">
                <span
                    style={{
                        color: "var(--muted)",
                        marginRight: 8,
                        wordBreak: "break-all",
                        maxWidth: 320,
                    }}
                >
                    {settings.downloadDir}
                </span>
                <button onClick={pickDir} style={{ cursor: "pointer" }}>
                    选择…
                </button>
            </Row>
            <Row label="夜间模式">
                <input
                    type="checkbox"
                    checked={settings.darkMode}
                    onChange={(e) => void toggleDark(e.target.checked)}
                />
            </Row>
            <Row label="自动裁边">
                <input
                    type="checkbox"
                    checked={settings.autoTrim}
                    onChange={(e) => void toggleTrim(e.target.checked)}
                />
            </Row>

            <h3 style={{ marginBottom: 4 }}>WebDAV 备份</h3>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
                收藏/历史/进度备份到自己的 WebDAV 服务器（{BACKUP_FILE}）。
            </div>
            <Row label="地址">
                <input
                    value={webdav.baseUrl}
                    placeholder="https://dav.example.com/dav/"
                    onChange={(e) => void onWebdavChange({ baseUrl: e.target.value })}
                    style={{ width: 280 }}
                />
            </Row>
            <Row label="账号">
                <input
                    value={webdav.user}
                    onChange={(e) => void onWebdavChange({ user: e.target.value })}
                    style={{ width: 280 }}
                />
            </Row>
            <Row label="密码">
                <input
                    type="password"
                    value={webdav.password}
                    onChange={(e) => void onWebdavChange({ password: e.target.value })}
                    style={{ width: 280 }}
                />
            </Row>
            <div style={{ margin: "8px 0" }}>
                <button onClick={backupNow} disabled={backing || restoring}>
                    {backing ? "备份中…" : "立即备份"}
                </button>
                <button
                    onClick={restoreNow}
                    disabled={backing || restoring}
                    style={{ marginLeft: 8 }}
                >
                    {restoring ? "恢复中…" : "恢复…"}
                </button>
            </div>

            <h3 style={{ marginBottom: 4 }}>更新</h3>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
                检查应用新版本（Windows / Linux 自动更新）。
            </div>
            {IS_MACOS ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    macOS 版暂不提供自动更新，请从发布页手动下载新版本。
                </div>
            ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={checkForUpdate} disabled={checkingUpd || downloadingUpd}>
                        {checkingUpd ? "检查中…" : "检查更新"}
                    </button>
                    {update && !downloaded && !downloadingUpd && (
                        <button onClick={downloadUpdate} disabled={downloadingUpd}>
                            {downloadingUpd ? "下载中…" : `下载 v${update.version}`}
                        </button>
                    )}
                    {downloaded && (
                        <button onClick={installAndRelaunch}>重启安装</button>
                    )}
                    {updProgress && updProgress.total > 0 && (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>
                            {Math.round((updProgress.done / updProgress.total) * 100)}%
                        </span>
                    )}
                </div>
            )}

            <h3 style={{ marginBottom: 4 }}>源</h3>
            <div style={{ margin: "8px 0" }}>
                <button onClick={checkUpdates} disabled={checking || applying}>
                    {checking ? "检查中…" : "检查更新"}
                </button>
                {Object.keys(updates).length > 0 && (
                    <button
                        onClick={applyUpdates}
                        disabled={applying}
                        style={{ marginLeft: 8 }}
                    >
                        {applying ? "应用中…" : `全部应用（${Object.keys(updates).length}）`}
                    </button>
                )}
            </div>
            {notice && (
                <div
                    style={{
                        margin: "6px 0",
                        fontSize: 13,
                        color: notice.kind === "ok" ? "var(--muted)" : "var(--danger, #c0392b)",
                    }}
                >
                    {notice.text}
                </div>
            )}
            {sourceList.map((entry) => {
                const err = errors[entry.sourceId];
                return (
                    <Row key={entry.sourceId} label={`${entry.name} v${entry.version}`}>
                        <span style={{ color: "var(--muted)", marginRight: 8, fontSize: 12 }}>
                            {new Date(entry.updatedAt).toLocaleString()}
                        </span>
                        {err && (
                            <span style={{ color: "var(--danger, #c0392b)", fontSize: 12 }}>
                                最近出错：{err.message.split("\n")[0]}
                            </span>
                        )}
                    </Row>
                );
            })}
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
            }}
        >
            <div>{label}</div>
            <div style={{ display: "flex", alignItems: "center" }}>{children}</div>
        </div>
    );
}
