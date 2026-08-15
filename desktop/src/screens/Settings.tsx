import { useEffect, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, setSettings, type Settings as SettingsT } from "../lib/storage";
import { applyTheme } from "../lib/theme";

export default function Settings() {
    const [settings, setSettingsState] = useState<SettingsT | null>(null);

    useEffect(() => {
        void getSettings().then(setSettingsState);
    }, []);

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

    if (!settings) {
        return <div style={{ padding: 16 }}>加载中…</div>;
    }

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
