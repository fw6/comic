import { useEffect, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, setSettings, type Settings as SettingsT } from "../lib/storage";
import { applyTheme } from "../lib/theme";
import {
    getSources,
    setSources,
    type SourceEntry,
} from "../lib/storage";
import { syncSources, sourceErrors, type SourceError } from "../api";

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

    useEffect(() => {
        void getSettings().then(setSettingsState);
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
