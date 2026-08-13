import { close, navigate } from 'sparkling-navigation';

/**
 * Sparkling 原生多页导航：每个屏幕是一个独立 Lynx 容器（bundle），
 * 用 `navigate()`/`close()` 在原生容器栈上推/弹，系统返回由容器自动处理。
 * 屏幕参数经 scheme 查询串传递，目标页从 `lynx.__globalProps.queryItems` 读取。
 */

/** 可被 push 的屏幕（`main` 为根容器，`sources`/`library` 是 main 内联 tab，不在此列）。 */
export type Screen =
    | { name: 'search' }
    | {
          name: 'result';
          keyword: string;
          sources: string[];
          mode: 'search' | 'category';
      }
    | { name: 'detail'; comicId: string }
    | {
          name: 'reader';
          comicId: string;
          chapterIndex: number;
          mode: 'page' | 'stream';
      }
    | { name: 'settings' }
    | { name: 'about' }
    | { name: 'backup' }
    | { name: 'chapters'; comicId: string }
    | { name: 'readerConfig' }
    | { name: 'sourceDetail'; sourceId: string }
    | { name: 'category'; sourceId: string }
    | { name: 'tagEditor'; comicId: string }
    | { name: 'eventSettings'; mode: 'page' | 'stream' }
    | { name: 'task'; comicId: string };

/** 某屏幕的纯参数形状（去掉 name 判别键）。decodeScreen 的返回类型据此推导。 */
export type ScreenParams<N extends Screen['name']> = Omit<
    Extract<Screen, { name: N }>,
    'name'
>;

export interface NavApi {
    push: (s: Screen) => void;
    pop: () => void;
}

/** bundle 文件名约定见 app.config.ts `output.filename.bundle = '[name].lynx.bundle'`。 */
const BUNDLE_SUFFIX = '.lynx.bundle';

function toBundle(name: Screen['name']): string {
    return `${name}${BUNDLE_SUFFIX}`;
}

/** 把 Screen 参数序列化为 scheme 查询串（数组 JSON，数字转字符串）。 */
function screenToParams(s: Screen): Record<string, string> {
    switch (s.name) {
        case 'result':
            return {
                keyword: s.keyword,
                sources: JSON.stringify(s.sources),
                mode: s.mode,
            };
        case 'reader':
            return {
                comicId: s.comicId,
                chapterIndex: String(s.chapterIndex),
                mode: s.mode,
            };
        case 'detail':
        case 'chapters':
        case 'tagEditor':
        case 'task':
            return { comicId: s.comicId };
        case 'sourceDetail':
        case 'category':
            return { sourceId: s.sourceId };
        case 'eventSettings':
            return { mode: s.mode };
        case 'search':
        case 'settings':
        case 'about':
        case 'backup':
        case 'readerConfig':
            return {};
    }
}

/** 与 screenToParams 互为逆运算的解码器表：screen name -> 查询参数 -> 带类型 props。 */
const DECODERS: {
    [N in Screen['name']]: (params: Record<string, string>) => ScreenParams<N>;
} = {
    search: () => ({}),
    settings: () => ({}),
    about: () => ({}),
    backup: () => ({}),
    readerConfig: () => ({}),
    result: (p) => ({
        keyword: p.keyword ?? '',
        sources: JSON.parse(p.sources ?? '[]') as string[],
        mode: (p.mode as 'search' | 'category') ?? 'search',
    }),
    detail: (p) => ({ comicId: p.comicId ?? '' }),
    reader: (p) => ({
        comicId: p.comicId ?? '',
        chapterIndex: Number(p.chapterIndex ?? '0'),
        mode: (p.mode as 'page' | 'stream') ?? 'stream',
    }),
    chapters: (p) => ({ comicId: p.comicId ?? '' }),
    sourceDetail: (p) => ({ sourceId: p.sourceId ?? '' }),
    category: (p) => ({ sourceId: p.sourceId ?? '' }),
    tagEditor: (p) => ({ comicId: p.comicId ?? '' }),
    eventSettings: (p) => ({
        mode: (p.mode as 'page' | 'stream') ?? 'page',
    }),
    task: (p) => ({ comicId: p.comicId ?? '' }),
};

/** 把当前容器的 scheme 查询参数解码为某屏幕的带类型 props。 */
export function decodeScreen<N extends Screen['name']>(
    name: N,
    params: Record<string, string>,
): ScreenParams<N> {
    const decode = DECODERS[name] as (
        p: Record<string, string>,
    ) => ScreenParams<N>;
    return decode(params);
}

export const nav: NavApi = {
    push(s) {
        navigate(
            {
                path: toBundle(s.name),
                options: {
                    params: { ...screenToParams(s), hide_nav_bar: 1 },
                },
            },
            () => {
                // fire-and-forget：导航失败由容器日志呈现
            },
        );
    },
    pop() {
        close();
    },
};

/** 读取当前容器 scheme 查询参数（`lynx.__globalProps.queryItems`）。 */
export function readParams(): Record<string, string> {
    return lynx.__globalProps.queryItems ?? {};
}
