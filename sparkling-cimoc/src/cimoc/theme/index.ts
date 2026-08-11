// Material Design theme system for Cimoc.
// Cimoc uses a light Material theme with 6 selectable accent themes and a
// semi-transparent dark overlay for "night mode" (rather than a real dark theme).

export type ThemeName =
    | 'blue'
    | 'bluegrey'
    | 'teal'
    | 'purple'
    | 'pink'
    | 'brown';

export interface MaterialTheme {
    name: ThemeName;
    label: string;
    primary: string; // colorPrimary
    primaryDark: string; // colorPrimaryDark
    accent: string; // colorAccent
}

export const THEMES: Record<ThemeName, MaterialTheme> = {
    blue: {
        name: 'blue',
        label: '天蓝',
        primary: '#2196F3',
        primaryDark: '#1976D2',
        accent: '#2196F3',
    },
    bluegrey: {
        name: 'bluegrey',
        label: '蓝灰',
        primary: '#455A64',
        primaryDark: '#37474F',
        accent: '#607D8B',
    },
    teal: {
        name: 'teal',
        label: '青绿',
        primary: '#009688',
        primaryDark: '#00796B',
        accent: '#009688',
    },
    purple: {
        name: 'purple',
        label: '紫色',
        primary: '#9C27B0',
        primaryDark: '#7B1FA2',
        accent: '#9C27B0',
    },
    pink: {
        name: 'pink',
        label: '粉色',
        primary: '#E91E63',
        primaryDark: '#C2185B',
        accent: '#E91E63',
    },
    brown: {
        name: 'brown',
        label: '棕色',
        primary: '#795548',
        primaryDark: '#5D4037',
        accent: '#795548',
    },
};

export const THEME_ORDER: ThemeName[] = [
    'blue',
    'bluegrey',
    'teal',
    'purple',
    'pink',
    'brown',
];

// Night mode overlay: translucent black mask on top of the light theme.
// Cimoc alpha is configurable in [0x64, 0xC8] => [100, 200].
export const NIGHT_ALPHA_MIN = 100;
export const NIGHT_ALPHA_MAX = 200;
export const NIGHT_ALPHA_DEFAULT = 150;

export interface AppTheme {
    theme: MaterialTheme;
    night: boolean;
    nightAlpha: number; // 0..255, only used when night
}

export function nightOverlayColor(alpha: number): string {
    return `rgba(0, 0, 0, ${Math.round(alpha) / 255})`;
}

export function lightTheme(): AppTheme {
    return {
        theme: THEMES.blue,
        night: false,
        nightAlpha: NIGHT_ALPHA_DEFAULT,
    };
}
