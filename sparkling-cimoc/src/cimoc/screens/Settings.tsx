import { useState } from '@lynx-js/react';
import { Row } from '../components/Row.js';
import { Screen } from '../components/Screen.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Snackbar } from '../components/Snackbar.js';
import { TopBar } from '../components/TopBar.js';
import type { LibraryTab } from '../data/models.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import {
    ACCENTS,
    FONT,
    FONT_SERIF,
    MODE_LABELS,
    RADIUS,
    THEME_ORDER,
    type ThemeName,
} from '../theme/index.js';

function ThemeRow() {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const choose = (name: ThemeName) => store.setThemeName(name);
    return (
        <view
            style={{
                backgroundColor: t.surface,
                paddingTop: '12px',
                paddingBottom: '12px',
                paddingLeft: '16px',
                paddingRight: '16px',
                borderBottomWidth: '1px',
                borderBottomColor: t.hairline,
            }}
        >
            <text
                style={{
                    fontSize: FONT.bodyLg,
                    color: t.text,
                    marginBottom: '10px',
                    ...FONT_SERIF,
                    letterSpacing: '0.5px',
                }}
            >
                主题颜色
            </text>
            <view
                style={{
                    alignItems: 'stretch',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                }}
            >
                {THEME_ORDER.map((name) => (
                    <view
                        key={name}
                        bindtap={() => choose(name)}
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '22px',
                            backgroundColor: ACCENTS[name].accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: '2px',
                            borderColor:
                                theme.accent.name === name
                                    ? t.text
                                    : 'transparent',
                        }}
                    >
                        {theme.accent.name === name ? (
                            <text
                                style={{
                                    color: ACCENTS[name].onAccent,
                                    fontSize: FONT.titleSm,
                                }}
                            >
                                ✓
                            </text>
                        ) : null}
                    </view>
                ))}
            </view>
        </view>
    );
}

export function SettingsScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme, settings, updateSettings } = store;
    const t = theme.tokens;
    const [showStartup, setShowStartup] = useState(false);
    const [snack, setSnack] = useState('');

    const STARTUP_LABELS: Record<LibraryTab, string> = {
        history: '历史',
        favorite: '收藏',
        download: '下载',
        local: '本地',
    };

    const showSnack = (msg: string) => setSnack(msg);

    return (
        <Screen theme={theme}>
            <TopBar theme={theme} title="设置" onBack={() => nav.pop()} />
            <view>
                <SectionHeader theme={theme} title="阅读设置" />
                <Row
                    theme={theme}
                    title="默认阅读模式"
                    value={
                        settings.defaultMode === 'page'
                            ? '翻页模式'
                            : '卷纸模式'
                    }
                    onTap={() => nav.push({ name: 'readerConfig' })}
                />
                <Row
                    theme={theme}
                    title="阅读配置"
                    onTap={() => nav.push({ name: 'readerConfig' })}
                />
                <Row
                    theme={theme}
                    title="保持屏幕常亮"
                    value={settings.keepScreenBright ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            keepScreenBright: !settings.keepScreenBright,
                        })
                    }
                />
                <Row
                    theme={theme}
                    title="隐藏导航栏"
                    value={settings.hideNav ? '开' : '关'}
                    onTap={() => updateSettings({ hideNav: !settings.hideNav })}
                />
                <Row
                    theme={theme}
                    title="隐藏信息栏"
                    value={settings.hideInfo ? '开' : '关'}
                    onTap={() =>
                        updateSettings({ hideInfo: !settings.hideInfo })
                    }
                />
                <Row
                    theme={theme}
                    title="自动裁边"
                    value={settings.autoCropWhiteEdge ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            autoCropWhiteEdge: !settings.autoCropWhiteEdge,
                        })
                    }
                />
                <Row
                    theme={theme}
                    title="白色背景"
                    value={settings.whiteBackground ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            whiteBackground: !settings.whiteBackground,
                        })
                    }
                />
                <Row
                    theme={theme}
                    title="音量键翻页"
                    value={settings.volumeKeyTurn ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            volumeKeyTurn: !settings.volumeKeyTurn,
                        })
                    }
                />

                <SectionHeader theme={theme} title="下载设置" />
                <Row
                    theme={theme}
                    title="多任务下载线程"
                    value={`${settings.downloadThreads}`}
                    onTap={() =>
                        updateSettings({
                            downloadThreads:
                                settings.downloadThreads === 10
                                    ? 1
                                    : settings.downloadThreads + 1,
                        })
                    }
                />
                <Row
                    theme={theme}
                    title="扫描已下载漫画"
                    onTap={() => showSnack('该功能尚未实现')}
                />

                <SectionHeader theme={theme} title="搜索设置" />
                <Row
                    theme={theme}
                    title="自动补全搜索词"
                    value={settings.autocomplete ? '开' : '关'}
                    onTap={() =>
                        updateSettings({ autocomplete: !settings.autocomplete })
                    }
                />

                <SectionHeader theme={theme} title="应用设置" />
                <Row
                    theme={theme}
                    title="仅连接 Wi-Fi"
                    value={settings.wifiOnly ? '开' : '关'}
                    onTap={() =>
                        updateSettings({ wifiOnly: !settings.wifiOnly })
                    }
                />
                <Row
                    theme={theme}
                    title="仅加载封面 Wi-Fi"
                    value={settings.coverWifiOnly ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            coverWifiOnly: !settings.coverWifiOnly,
                        })
                    }
                />
                <Row
                    theme={theme}
                    title="界面模式"
                    value={MODE_LABELS[theme.mode]}
                    onTap={() =>
                        store.setMode(theme.mode === 'ink' ? 'paper' : 'ink')
                    }
                />
                <ThemeRow />
                <Row
                    theme={theme}
                    title="启动画面"
                    value={STARTUP_LABELS[settings.startupScreen]}
                    onTap={() => setShowStartup(true)}
                />
                <Row
                    theme={theme}
                    title="存储位置"
                    value="默认"
                    onTap={() => showSnack('存储位置切换需重启应用')}
                />
                <Row
                    theme={theme}
                    title="清除缓存"
                    onTap={() => showSnack('该功能尚未实现')}
                />
            </view>

            {/* startup screen picker */}
            {showStartup ? (
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: t.overlay,
                        justifyContent: 'flex-end',
                    }}
                    bindtap={() => setShowStartup(false)}
                >
                    <view
                        style={{
                            backgroundColor: t.surfaceRaised,
                            borderTopLeftRadius: RADIUS.lg,
                            borderTopRightRadius: RADIUS.lg,
                            padding: '16px',
                        }}
                        bindtap={() => {}}
                    >
                        <text
                            style={{
                                fontSize: FONT.titleSm,
                                fontWeight: '600',
                                color: t.text,
                                ...FONT_SERIF,
                                letterSpacing: '0.5px',
                                marginBottom: '10px',
                            }}
                        >
                            选择启动画面
                        </text>
                        {(Object.keys(STARTUP_LABELS) as LibraryTab[]).map(
                            (k) => (
                                <view
                                    key={k}
                                    bindtap={() => {
                                        updateSettings({ startupScreen: k });
                                        setShowStartup(false);
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingTop: '10px',
                                        paddingBottom: '10px',
                                        borderBottomWidth: '1px',
                                        borderBottomColor: t.hairline,
                                    }}
                                >
                                    <text
                                        style={{
                                            flexGrow: 1,
                                            fontSize: FONT.body,
                                            color: t.text,
                                        }}
                                    >
                                        {STARTUP_LABELS[k]}
                                    </text>
                                    {settings.startupScreen === k ? (
                                        <text
                                            style={{
                                                color: t.accent,
                                                fontSize: FONT.body,
                                            }}
                                        >
                                            ✓
                                        </text>
                                    ) : null}
                                </view>
                            ),
                        )}
                    </view>
                </view>
            ) : null}

            {/* snackbar */}
            {snack ? (
                <Snackbar
                    theme={theme}
                    message={snack}
                    onHide={() => setSnack('')}
                />
            ) : null}
        </Screen>
    );
}
