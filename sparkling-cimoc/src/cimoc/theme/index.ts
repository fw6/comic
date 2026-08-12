// 「墨·朱」theme system for Cimoc.
// Two full palettes — ink (dark, default) and paper (light) — each derived from
// semantic tokens, plus 7 selectable accent hues. The old Material-style
// "light theme + black night overlay" is replaced by these two real palettes.

export type ThemeMode = 'ink' | 'paper';

export type ThemeName =
    | 'vermilion'
    | 'blue'
    | 'bluegrey'
    | 'teal'
    | 'purple'
    | 'pink'
    | 'brown';

export interface Accent {
    name: ThemeName;
    label: string;
    /** 强调色主体：FAB、进度、选中态、状态点 */
    accent: string;
    /** 强调色淡印：选中背景、已读章节 */
    accentSoft: string;
    /** 强调色上的文字/图标颜色 */
    onAccent: string;
}

export const ACCENTS: Record<ThemeName, Accent> = {
    vermilion: {
        name: 'vermilion',
        label: '朱红',
        accent: '#E53935',
        accentSoft: 'rgba(229,57,53,0.14)',
        onAccent: '#FFF7F2',
    },
    blue: {
        name: 'blue',
        label: '天蓝',
        accent: '#4A7FDB',
        accentSoft: 'rgba(74,127,219,0.16)',
        onAccent: '#FFFFFF',
    },
    bluegrey: {
        name: 'bluegrey',
        label: '蓝灰',
        accent: '#6E7E8C',
        accentSoft: 'rgba(110,126,140,0.18)',
        onAccent: '#FFFFFF',
    },
    teal: {
        name: 'teal',
        label: '青绿',
        accent: '#2E9E8B',
        accentSoft: 'rgba(46,158,139,0.16)',
        onAccent: '#FFFFFF',
    },
    purple: {
        name: 'purple',
        label: '紫',
        accent: '#8B6CE0',
        accentSoft: 'rgba(139,108,224,0.18)',
        onAccent: '#FFFFFF',
    },
    pink: {
        name: 'pink',
        label: '粉',
        accent: '#E05A8A',
        accentSoft: 'rgba(224,90,138,0.16)',
        onAccent: '#FFFFFF',
    },
    brown: {
        name: 'brown',
        label: '棕',
        accent: '#A07C5C',
        accentSoft: 'rgba(160,124,92,0.18)',
        onAccent: '#FFF8F2',
    },
};

export const THEME_ORDER: ThemeName[] = [
    'vermilion',
    'blue',
    'bluegrey',
    'teal',
    'purple',
    'pink',
    'brown',
];

export const MODE_LABELS: Record<ThemeMode, string> = {
    ink: '墨色',
    paper: '纸面',
};

/**
 * 语义化色板：所有屏幕只消费这些 token，不再硬编码色值。
 */
export interface ThemeTokens {
    bg: string; // 页面底色
    surface: string; // 卡片 / 顶栏面
    surfaceRaised: string; // 浮层：弹窗、抽屉
    surfaceSunken: string; // 凹陷面：分组条、非激活底
    text: string; // 主文字
    textSub: string; // 次级文字
    textMut: string; // 弱化文字 / 占位
    hairline: string; // 列表分隔线
    border: string; // 输入框 / 卡片描边
    accent: string; // 强调色（随选择变化）
    accentSoft: string; // 强调色淡印
    onAccent: string; // 强调色上的文字/图标
    success: string; // 已下载 / 完成
    danger: string; // 破坏性 / 角标
    overlay: string; // 遮罩
    readerBg: string; // 阅读器画布
}

const INK: Omit<ThemeTokens, 'accent' | 'accentSoft' | 'onAccent'> = {
    bg: '#14141A',
    surface: '#1D1D25',
    surfaceRaised: '#262630',
    surfaceSunken: '#191921',
    text: '#F0ECE1',
    textSub: '#A29C8D',
    textMut: '#6E695E',
    hairline: '#2B2B35',
    border: '#35353F',
    success: '#66BB6A',
    danger: '#E53935',
    overlay: 'rgba(0,0,0,0.62)',
    readerBg: '#0C0C11',
};

const PAPER: Omit<ThemeTokens, 'accent' | 'accentSoft' | 'onAccent'> = {
    bg: '#EFE8DA',
    surface: '#FBF7ED',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#E6DECE',
    text: '#221D16',
    textSub: '#6F675A',
    textMut: '#9B9282',
    hairline: '#E2DAC9',
    border: '#D2C9B6',
    success: '#2E9E5B',
    danger: '#D6362C',
    overlay: 'rgba(28,22,16,0.5)',
    readerBg: '#FFFFFF',
};

export function buildTokens(mode: ThemeMode, accent: Accent): ThemeTokens {
    const base = mode === 'ink' ? INK : PAPER;
    return {
        ...base,
        accent: accent.accent,
        accentSoft: accent.accentSoft,
        onAccent: accent.onAccent,
    };
}

export interface AppTheme {
    mode: ThemeMode;
    accent: Accent;
    tokens: ThemeTokens;
}

export function appTheme(mode: ThemeMode, accent: Accent): AppTheme {
    return { mode, accent, tokens: buildTokens(mode, accent) };
}

export function defaultAppTheme(): AppTheme {
    return appTheme('ink', ACCENTS.vermilion);
}

// --- typography / geometry constants ---

/** 衬线字体族：标题与栏目使用（系统 CJK 衬线，制造「印刷物」质感） */
export const FONT_SERIF = { fontFamily: 'serif' } as const;

export const RADIUS = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '999px',
} as const;

export const SPACE = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
} as const;
