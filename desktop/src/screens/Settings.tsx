import { useEffect, useState, type ReactNode } from "react";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import {
    getSettings,
    setSettings,
    exportBackupJson,
    parseBackupJson,
    importBackupData,
    getSources,
    setSources,
    type Settings as SettingsT,
    type SourceEntry,
} from "../lib/storage";
import { applyTheme } from "../lib/theme";
import { syncSources, sourceErrors, webdavGet, webdavPut, cimocVersion, type SourceError } from "../api";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Switch } from "../components/ui";

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
    const [version, setVersion] = useState("");
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
        void cimocVersion()
            .then(setVersion)
            .catch(() => {});
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
        return <div className="spinner" />;
    }

    const sourceList = Object.values(sources);

    return (
        <div className="page" style={{ maxWidth: 680 }}>
            <div className="page__head">
                <div>
                    <h1 className="page__title">设置</h1>
                    <div className="page__sub">阅读偏好、备份与更新</div>
                </div>
            </div>

            {notice && (
                <div
                    style={{
                        marginBottom: 16,
                        fontSize: 13,
                        padding: "9px 14px",
                        borderRadius: 12,
                        background:
                            notice.kind === "ok" ? "var(--success-soft)" : "var(--danger-soft)",
                        color: notice.kind === "ok" ? "var(--success)" : "var(--danger)",
                    }}
                >
                    {notice.text}
                </div>
            )}

            {/* 通用 */}
            <div className="panel">
                <div className="panel__head">
                    <div>
                        <div className="panel__title">通用</div>
                        <div className="panel__desc">阅读与存储偏好</div>
                    </div>
                </div>
                <SettingRow label="下载目录" hint="漫画下载保存的位置">
                    <span className="s-row__value">{settings.downloadDir}</span>
                    <button className="btn btn--ghost btn--sm" onClick={pickDir}>
                        选择…
                    </button>
                </SettingRow>
                <SettingRow label="夜间模式" hint="深色墨水主题，更护眼">
                    <Switch checked={settings.darkMode} onChange={(v) => void toggleDark(v)} label="夜间模式" />
                </SettingRow>
                <SettingRow label="自动裁边" hint="阅读时裁掉页面边缘空白">
                    <Switch checked={settings.autoTrim} onChange={(v) => void toggleTrim(v)} label="自动裁边" />
                </SettingRow>
            </div>

            {/* WebDAV 备份 */}
            <div className="panel">
                <div className="panel__head">
                    <div>
                        <div className="panel__title">WebDAV 备份</div>
                        <div className="panel__desc">
                            收藏/历史/进度备份到自己的 WebDAV 服务器（{BACKUP_FILE}）
                        </div>
                    </div>
                </div>
                <SettingRow label="地址">
                    <input
                        className="input"
                        style={{ width: 260 }}
                        value={webdav.baseUrl}
                        placeholder="https://dav.example.com/dav/"
                        onChange={(e) => void onWebdavChange({ baseUrl: e.target.value })}
                    />
                </SettingRow>
                <SettingRow label="账号">
                    <input
                        className="input"
                        style={{ width: 260 }}
                        value={webdav.user}
                        onChange={(e) => void onWebdavChange({ user: e.target.value })}
                    />
                </SettingRow>
                <SettingRow label="密码">
                    <input
                        className="input"
                        style={{ width: 260 }}
                        type="password"
                        value={webdav.password}
                        onChange={(e) => void onWebdavChange({ password: e.target.value })}
                    />
                </SettingRow>
                <SettingRow label="操作">
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn--primary btn--sm" onClick={backupNow} disabled={backing || restoring}>
                            {backing ? "备份中…" : "立即备份"}
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={restoreNow} disabled={backing || restoring}>
                            {restoring ? "恢复中…" : "恢复…"}
                        </button>
                    </div>
                </SettingRow>
            </div>

            {/* 应用更新 */}
            <div className="panel">
                <div className="panel__head">
                    <div>
                        <div className="panel__title">应用更新</div>
                        <div className="panel__desc">检查应用新版本（Windows / Linux 自动更新）</div>
                    </div>
                </div>
                {IS_MACOS ? (
                    <SettingRow label="macOS">
                        <span className="s-row__value">暂不提供自动更新，请从发布页手动下载新版本</span>
                    </SettingRow>
                ) : (
                    <SettingRow label="版本">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <button className="btn btn--primary btn--sm" onClick={checkForUpdate} disabled={checkingUpd || downloadingUpd}>
                                {checkingUpd ? "检查中…" : "检查更新"}
                            </button>
                            {update && !downloaded && !downloadingUpd && (
                                <button className="btn btn--soft btn--sm" onClick={downloadUpdate} disabled={downloadingUpd}>
                                    {downloadingUpd ? "下载中…" : `下载 v${update.version}`}
                                </button>
                            )}
                            {downloaded && (
                                <button className="btn btn--soft btn--sm" onClick={installAndRelaunch}>
                                    重启安装
                                </button>
                            )}
                            {updProgress && updProgress.total > 0 && (
                                <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                                    {Math.round((updProgress.done / updProgress.total) * 100)}%
                                </span>
                            )}
                        </div>
                    </SettingRow>
                )}
            </div>

            {/* 源 */}
            <div className="panel">
                <div className="panel__head">
                    <div>
                        <div className="panel__title">源</div>
                        <div className="panel__desc">已安装的漫画源与脚本版本</div>
                    </div>
                </div>
                <SettingRow label="更新">
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn--ghost btn--sm" onClick={checkUpdates} disabled={checking || applying}>
                            {checking ? "检查中…" : "检查更新"}
                        </button>
                        {Object.keys(updates).length > 0 && (
                            <button className="btn btn--soft btn--sm" onClick={applyUpdates} disabled={applying}>
                                {applying ? "应用中…" : `全部应用（${Object.keys(updates).length}）`}
                            </button>
                        )}
                    </div>
                </SettingRow>
                {sourceList.map((entry) => {
                    const err = errors[entry.sourceId];
                    return (
                        <SettingRow
                            key={entry.sourceId}
                            label={`${entry.name} v${entry.version}`}
                            hint={
                                err
                                    ? `最近出错：${err.message.split("\n")[0]}`
                                    : new Date(entry.updatedAt).toLocaleString()
                            }
                        >
                            <span
                                style={{
                                    color: err ? "var(--danger)" : "var(--fg-3)",
                                    fontSize: 12,
                                    textAlign: "right",
                                }}
                            >
                                {err ? "出错了" : "正常"}
                            </span>
                        </SettingRow>
                    );
                })}
            </div>

            {/* 关于 */}
            <div
                style={{
                    textAlign: "center",
                    color: "var(--fg-3)",
                    fontSize: 12,
                    padding: "8px 0 4px",
                }}
            >
                Cimoc · Rust core {version || "…"}
                <span style={{ margin: "0 6px" }}>·</span>
                <a
                    href="https://deerflow.tech"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "underline" }}
                >
                    Created by Deerflow
                </a>
            </div>
        </div>
    );
}

function SettingRow({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="s-row">
            <div>
                <div className="s-row__label">{label}</div>
                {hint && <div className="s-row__hint">{hint}</div>}
            </div>
            <div className="s-row__control">{children}</div>
        </div>
    );
}
