import { load, type Store } from "@tauri-apps/plugin-store";
import { downloadDir } from "@tauri-apps/api/path";
import { crawl, bundledSources, syncSources, type Comic } from "../api";
import { getStore as getFsStore } from "./storage-fs";

// S3 seam：进度/收藏/历史/设置持久化（grilling #6：每域一 JSON，tauri-plugin-store）。
// 本模块只依赖 Store 的 get/set/delete/entries/clear 契约；测试 mock 插件后验证自有逻辑。
// 移动端（wayfinder #29/#30）：tauri-plugin-store 不支持移动端 → 按平台切换
// 到 storage-fs.ts（fs 读写 appDataDir JSON，接口一致，上层零改动）。

/** 移动平台检测（Tauri 桌面 webview UA 含 Android/iPhone/iPad/iPod）。 */
const IS_MOBILE = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

export interface ProgressRecord {
    chapterIndex: number;
    /** 话内位置：0..1（卷纸流滚动比例） */
    position: number;
    updatedAt: number;
}

export interface HistoryRecord {
    comic: Comic;
    chapterIndex: number;
    lastReadAt: number;
}

export interface Settings {
    downloadDir: string | null;
    darkMode: boolean;
    autoTrim: boolean;
    /** WebDAV 备份凭据（wayfinder #24/#25：明文存 settings，钥匙串后置）。 */
    webdav?: { baseUrl: string; user: string; password: string };
}

const FILES = {
    settings: "settings.json",
    favorites: "favorites.json",
    history: "history.json",
    progress: "progress.json",
    webtoonsCache: "webtoons-cache.json",
    sources: "sources.json",
} as const;

const storeCache = new Map<string, Promise<Store>>();

function getStore(file: (typeof FILES)[keyof typeof FILES]) {
    // 移动端走 fs 版（store 插件不支持）；桌面保持 store 版（现行为，grilling #29）
    return IS_MOBILE ? getFsStore(file) : loadStore(file);
}

function loadStore(file: string): Promise<Store> {
    if (!storeCache.has(file)) {
        storeCache.set(file, load(file));
    }
    return storeCache.get(file)!;
}

/** 漫画跨域唯一键：(source, comicId)。 */
export function comicKey(source: string, comicId: string): string {
    return `${source}:${comicId}`;
}

// ---------- 进度（自动记录：章节 + 话内位置） ----------

export async function getProgress(source: string, comicId: string): Promise<ProgressRecord | null> {
    const store = await getStore(FILES.progress);
    return (await store.get<ProgressRecord>(comicKey(source, comicId))) ?? null;
}

export async function setProgress(
    source: string,
    comicId: string,
    record: ProgressRecord,
): Promise<void> {
    const store = await getStore(FILES.progress);
    await store.set(comicKey(source, comicId), record);
}

// ---------- 历史（最近阅读，按 lastReadAt 倒序） ----------

// lastReadAt 严格递增：同毫秒内多次 touch 也能稳定排序（避免 Date.now() 相等）。
let lastTs = 0;
function nextTimestamp(): number {
    const now = Date.now();
    lastTs = Math.max(now, lastTs + 1);
    return lastTs;
}

export async function getHistory(): Promise<HistoryRecord[]> {
    const store = await getStore(FILES.history);
    const entries = await store.entries<HistoryRecord>();
    return entries
        .map(([, record]) => record)
        .sort((a, b) => b.lastReadAt - a.lastReadAt);
}

export async function touchHistory(comic: Comic, chapterIndex: number): Promise<void> {
    const store = await getStore(FILES.history);
    await store.set(comicKey(comic.source, comic.id), {
        comic,
        chapterIndex,
        lastReadAt: nextTimestamp(),
    });
}

// ---------- 收藏（存 Comic 快照，Library 展示免回源） ----------

export async function getFavorites(): Promise<Comic[]> {
    const store = await getStore(FILES.favorites);
    const entries = await store.entries<Comic>();
    return entries.map(([, comic]) => comic);
}

export async function isFavorite(source: string, comicId: string): Promise<boolean> {
    const store = await getStore(FILES.favorites);
    return store.has(comicKey(source, comicId));
}

/** 切换收藏状态，返回切换后的状态。 */
export async function toggleFavorite(comic: Comic): Promise<boolean> {
    const store = await getStore(FILES.favorites);
    const key = comicKey(comic.source, comic.id);
    if (await store.has(key)) {
        await store.delete(key);
        return false;
    }
    await store.set(key, comic);
    return true;
}

// ---------- 设置（最小集：下载目录/夜间模式/自动裁边） ----------

const DEFAULT_SETTINGS: Settings = {
    downloadDir: null,
    darkMode: false,
    autoTrim: false,
};

/** 下载目录默认值（grilling #6：~/Downloads/cimoc）。 */
export async function defaultDownloadDir(): Promise<string> {
    const base = await downloadDir();
    return `${base}/cimoc`;
}

export async function getSettings(): Promise<Settings> {
    const store = await getStore(FILES.settings);
    const saved = await store.get<Partial<Settings>>("settings");
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    return {
        ...merged,
        downloadDir: merged.downloadDir ?? (await defaultDownloadDir()),
    };
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
    const store = await getStore(FILES.settings);
    const current = await store.get<Partial<Settings>>("settings");
    await store.set("settings", { ...current, ...partial });
}

// ---------- 已装源（wayfinder #16：sources.json 域，key = sourceId） ----------

export interface SourceEntry {
    sourceId: string;
    name: string;
    /** 递增整数版本（#16 Q7），与源仓库 index 对比决定更新。 */
    version: number;
    script: string;
    updatedAt: number;
}

export async function getSources(): Promise<Record<string, SourceEntry>> {
    const store = await getStore(FILES.sources);
    return (await store.get<Record<string, SourceEntry>>("sources")) ?? {};
}

export async function setSources(entries: Record<string, SourceEntry>): Promise<void> {
    const store = await getStore(FILES.sources);
    await store.set("sources", entries);
}

const SOURCE_NAMES: Record<string, string> = {
    webtoons: "Webtoons",
    mangadex: "MangaDex",
    copymanga: "Copymanga",
    dongman: "咚漫",
    manhuagui: "漫画柜",
    baozimh: "包子漫画",
};

/**
 * 启动时同步源脚本：sources.json 缺失时用内置脚本初始化（#16 Q8：首启种子）；
 * 老安装合并新增的内置源（#32：避免缺新内置源需手动清 sources.json）；
 * dev 模式每次覆盖（#17 开发回路：改脚本重启即生效）。随后把脚本同步进 Rust registry。
 */
export async function initSources(): Promise<void> {
    const dev = import.meta.env.DEV;
    const existing = await getSources();
    const missing = Object.keys(existing).length === 0;
    if (missing || dev) {
        const bundled = await bundledSources();
        const now = Date.now();
        const next: Record<string, SourceEntry> = {};
        for (const [id, script] of Object.entries(bundled)) {
            next[id] = {
                sourceId: id,
                name: SOURCE_NAMES[id] ?? id,
                version: 1,
                script,
                updatedAt: now,
            };
        }
        await setSources(next);
    } else {
        // 老安装：把内置源里缺失的新源合并进来（不覆盖已装版本）。
        const bundled = await bundledSources();
        const now = Date.now();
        let changed = false;
        const merged: Record<string, SourceEntry> = { ...existing };
        for (const [id, script] of Object.entries(bundled)) {
            if (!merged[id]) {
                merged[id] = {
                    sourceId: id,
                    name: SOURCE_NAMES[id] ?? id,
                    version: 1,
                    script,
                    updatedAt: now,
                };
                changed = true;
            }
        }
        if (changed) await setSources(merged);
    }
    const current = await getSources();
    const scripts: Record<string, string> = {};
    for (const [id, entry] of Object.entries(current)) scripts[id] = entry.script;
    await syncSources(scripts);
}

// ---------- Webtoons series URL 缓存（进程内静态 → 持久化，grilling #6 存储域） ----------

/** 启动时把上次保存的 series URL 映射回灌进 Rust 进程内缓存。 */
export async function hydrateWebtoonsCache(): Promise<void> {
    const store = await getStore(FILES.webtoonsCache);
    const data = await store.get<Record<string, string>>("cache");
    if (data && Object.keys(data).length > 0) {
        await crawl("cache_hydrate", "webtoons", data);
    }
}

/** 搜索/详情后把进程内缓存落盘（仅 webtoons 有该缓存）。 */
export async function persistWebtoonsCache(): Promise<void> {
    const store = await getStore(FILES.webtoonsCache);
    const dump = await crawl<Record<string, string>>("cache_dump", "webtoons", {});
    if (Object.keys(dump).length > 0) {
        await store.set("cache", dump);
    }
}

// ---------- WebDAV 备份/恢复（wayfinder #24/#25 定案） ----------

/** 备份文件版本（grilling #25 #6：version≠1 拒绝恢复）。 */
export const BACKUP_VERSION = 1;

export interface BackupData {
    version: number;
    /** unix 毫秒，备份时刻（信息展示）。 */
    exportedAt: number;
    /** key = comicKey(source, comicId) */
    favorites: Record<string, Comic>;
    history: Record<string, HistoryRecord>;
    progress: Record<string, ProgressRecord>;
}

/** 收集三域为备份 JSON 字符串（单文件 cimoc-backup.json 内容，grilling #25 #2）。 */
export async function exportBackupJson(): Promise<string> {
    const [favStore, hisStore, proStore] = await Promise.all([
        getStore(FILES.favorites),
        getStore(FILES.history),
        getStore(FILES.progress),
    ]);
    const favorites: Record<string, Comic> = {};
    for (const [k, v] of await favStore.entries<Comic>()) favorites[k] = v;
    const history: Record<string, HistoryRecord> = {};
    for (const [k, v] of await hisStore.entries<HistoryRecord>()) history[k] = v;
    const progress: Record<string, ProgressRecord> = {};
    for (const [k, v] of await proStore.entries<ProgressRecord>()) progress[k] = v;
    const data: BackupData = {
        version: BACKUP_VERSION,
        exportedAt: Date.now(),
        favorites,
        history,
        progress,
    };
    return JSON.stringify(data);
}

/** 解析并校验备份 JSON：版本不符抛错（防旧格式误恢复，grilling #25 #6）。 */
export function parseBackupJson(json: string): BackupData {
    const data = JSON.parse(json) as BackupData;
    if (data.version !== BACKUP_VERSION) {
        throw new Error(`备份版本 ${data.version} 不受支持（当前 ${BACKUP_VERSION}）`);
    }
    return data;
}

/** 恢复：整体覆盖本地三域（快照语义，grilling #25 #4）。 */
export async function importBackupData(data: BackupData): Promise<void> {
    const [favStore, hisStore, proStore] = await Promise.all([
        getStore(FILES.favorites),
        getStore(FILES.history),
        getStore(FILES.progress),
    ]);
    await Promise.all([favStore.clear(), hisStore.clear(), proStore.clear()]);
    for (const [k, v] of Object.entries(data.favorites)) await favStore.set(k, v);
    for (const [k, v] of Object.entries(data.history)) await hisStore.set(k, v);
    for (const [k, v] of Object.entries(data.progress)) await proStore.set(k, v);
}
