import { bundledSources, crawl, syncSources } from "../../api";
import { applyBundledSources } from "../sources";
import { FILES, getStore } from "./store";

/** 已装源（wayfinder #16：sources.json 域，key = sourceId）。 */
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

/**
 * 启动时同步源脚本：sources.json 缺失时用内置源初始化（#16 Q8：首启种子）；
 * 老安装合并新增的内置源（#32：避免缺新内置源需手动清 sources.json）；
 * dev 模式每次覆盖（#17 开发回路：改脚本重启即生效）。随后把脚本同步进 Rust registry，
 * 并用内置源清单填充前端的源列表与热链对（显示名取已装源的 name）。
 */
export async function initSources(): Promise<void> {
    const dev = import.meta.env.DEV;
    const existing = await getSources();
    const missing = Object.keys(existing).length === 0;
    const bundled = await bundledSources();
    if (missing || dev) {
        const now = Date.now();
        const next: Record<string, SourceEntry> = {};
        for (const s of bundled) {
            next[s.id] = {
                sourceId: s.id,
                name: s.title,
                version: 1,
                script: s.script,
                updatedAt: now,
            };
        }
        await setSources(next);
    } else {
        // 老安装：把内置源里缺失的新源合并进来（不覆盖已装版本）。
        const now = Date.now();
        let changed = false;
        const merged: Record<string, SourceEntry> = { ...existing };
        for (const s of bundled) {
            if (!merged[s.id]) {
                merged[s.id] = {
                    sourceId: s.id,
                    name: s.title,
                    version: 1,
                    script: s.script,
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
    applyBundledSources(bundled, current);
}

/** 源脚本同步的单例：首次调用执行，后续调用等待同一个 Promise。
 * 页面取数前 await 它——脚本尚未进入 registry 时，脚本源的 op 会按空结果返回。 */
let sourcesReady: Promise<void> | null = null;

export function whenSourcesReady(): Promise<void> {
    sourcesReady ??= initSources().catch((err) => {
        console.error("源脚本同步失败", err);
    });
    return sourcesReady;
}

// ---------- 源进程内缓存的持久化（cache_dump / cache_hydrate，grilling #6 存储域） ----------

/** 启动时把上次保存的各源进程内缓存回灌进 Rust。没有持久缓存的源 hydrate 是空操作。 */
export async function hydrateSourceCaches(): Promise<void> {
    const store = await getStore(FILES.sourceCache);
    const all = (await store.get<Record<string, unknown>>("caches")) ?? {};
    for (const [id, data] of Object.entries(all)) {
        if (data && Object.keys(data).length > 0) {
            await crawl("cache_hydrate", id, data);
        }
    }
}

/** 抓取后把某源的进程内缓存写入磁盘；该源没有持久缓存时 dump 出空对象，不写。 */
export async function persistSourceCache(source: string): Promise<void> {
    const dump = await crawl<Record<string, unknown>>("cache_dump", source, {});
    if (Object.keys(dump).length === 0) return;
    const store = await getStore(FILES.sourceCache);
    const all = (await store.get<Record<string, unknown>>("caches")) ?? {};
    all[source] = dump;
    await store.set("caches", all);
}
