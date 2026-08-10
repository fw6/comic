import { useState } from '@lynx-js/react';
import { TopBar } from '../components/TopBar.js';
import type { LibraryTab } from '../data/models.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { THEME_ORDER, THEMES, type ThemeName } from '../theme/index.js';

function SectionHeader({ title, color }: { title: string; color: string }) {
    return (
        <view
            style={{
                backgroundColor: 'rgba(0,0,0,0.05)',
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: '16px',
                paddingRight: '16px',
            }}
        >
            <text style={{ color, fontSize: '14px', fontWeight: '600' }}>
                {title}
            </text>
        </view>
    );
}

function Row({
    title,
    value,
    onTap,
}: {
    title: string;
    value?: string;
    onTap?: () => void;
}) {
    return (
        <view
            bindtap={onTap}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                paddingTop: '14px',
                paddingBottom: '14px',
                paddingLeft: '16px',
                paddingRight: '16px',
                borderBottomWidth: '1px',
                borderBottomColor: '#f0f0f0',
            }}
        >
            <text style={{ flex: 1, fontSize: '15px', color: '#212121' }}>
                {title}
            </text>
            {value ? (
                <text style={{ fontSize: '14px', color: '#999' }}>{value}</text>
            ) : null}
            <text style={{ color: '#bbb', fontSize: '18px', marginLeft: 8 }}>
                ›
            </text>
        </view>
    );
}

function ThemeRow() {
    const store = useAppStore();
    const { theme } = store;
    const choose = (name: ThemeName) => store.setThemeName(name);
    return (
        <view
            style={{
                backgroundColor: '#fff',
                paddingTop: '12px',
                paddingBottom: '12px',
                paddingLeft: '16px',
                paddingRight: '16px',
            }}
        >
            <text
                style={{ fontSize: '15px', color: '#212121', marginBottom: 10 }}
            >
                主题颜色
            </text>
            <view
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                }}
            >
                {THEME_ORDER.map((name) => (
                    <view
                        key={name}
                        bindtap={() => choose(name)}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '22px',
                            backgroundColor: THEMES[name].primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: '2px',
                            borderColor:
                                theme.theme.name === name
                                    ? '#000'
                                    : 'transparent',
                        }}
                    >
                        {theme.theme.name === name ? (
                            <text style={{ color: '#fff', fontSize: 18 }}>
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
        <view style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <TopBar theme={theme} title="设置" onBack={() => nav.pop()} />
            <view>
                <SectionHeader title="阅读设置" color={theme.theme.primary} />
                <Row
                    title="默认阅读模式"
                    value={
                        settings.defaultMode === 'page'
                            ? '翻页模式'
                            : '卷纸模式'
                    }
                    onTap={() => nav.push({ name: 'readerConfig' })}
                />
                <Row
                    title="阅读配置"
                    onTap={() => nav.push({ name: 'readerConfig' })}
                />
                <Row
                    title="保持屏幕常亮"
                    value={settings.keepScreenBright ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            keepScreenBright: !settings.keepScreenBright,
                        })
                    }
                />
                <Row
                    title="隐藏导航栏"
                    value={settings.hideNav ? '开' : '关'}
                    onTap={() => updateSettings({ hideNav: !settings.hideNav })}
                />
                <Row
                    title="隐藏信息栏"
                    value={settings.hideInfo ? '开' : '关'}
                    onTap={() =>
                        updateSettings({ hideInfo: !settings.hideInfo })
                    }
                />
                <Row
                    title="自动裁边"
                    value={settings.autoCropWhiteEdge ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            autoCropWhiteEdge: !settings.autoCropWhiteEdge,
                        })
                    }
                />
                <Row
                    title="白色背景"
                    value={settings.whiteBackground ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            whiteBackground: !settings.whiteBackground,
                        })
                    }
                />
                <Row
                    title="音量键翻页"
                    value={settings.volumeKeyTurn ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            volumeKeyTurn: !settings.volumeKeyTurn,
                        })
                    }
                />

                <SectionHeader title="下载设置" color={theme.theme.primary} />
                <Row
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
                <Row title="扫描已下载漫画" onTap={() => {}} />

                <SectionHeader title="搜索设置" color={theme.theme.primary} />
                <Row
                    title="自动补全搜索词"
                    value={settings.autocomplete ? '开' : '关'}
                    onTap={() =>
                        updateSettings({ autocomplete: !settings.autocomplete })
                    }
                />

                <SectionHeader title="应用设置" color={theme.theme.primary} />
                <Row
                    title="仅连接 Wi-Fi"
                    value={settings.wifiOnly ? '开' : '关'}
                    onTap={() =>
                        updateSettings({ wifiOnly: !settings.wifiOnly })
                    }
                />
                <Row
                    title="仅加载封面 Wi-Fi"
                    value={settings.coverWifiOnly ? '开' : '关'}
                    onTap={() =>
                        updateSettings({
                            coverWifiOnly: !settings.coverWifiOnly,
                        })
                    }
                />
                <ThemeRow />
                <Row
                    title="夜间模式透明度"
                    value={`${settings.nightAlpha}`}
                    onTap={() =>
                        updateSettings({
                            nightAlpha:
                                settings.nightAlpha === 200
                                    ? 100
                                    : settings.nightAlpha + 25,
                        })
                    }
                />
                <Row
                    title="启动画面"
                    value={STARTUP_LABELS[settings.startupScreen]}
                    onTap={() => setShowStartup(true)}
                />
                <Row
                    title="存储位置"
                    value="默认"
                    onTap={() => showSnack('存储位置切换需重启应用')}
                />
                <Row title="清除缓存" onTap={() => showSnack('缓存已清除')} />
            </view>

            {/* startup screen picker */}
            {showStartup ? (
                <view
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'flex-end',
                    }}
                    bindtap={() => setShowStartup(false)}
                >
                    <view
                        style={{
                            backgroundColor: '#fff',
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12,
                            padding: 16,
                        }}
                        bindtap={() => {}}
                    >
                        <text
                            style={{
                                fontSize: '16px',
                                fontWeight: '600',
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
                                        borderBottomColor: '#f0f0f0',
                                    }}
                                >
                                    <text
                                        style={{
                                            flex: 1,
                                            fontSize: '14px',
                                            color: '#333',
                                        }}
                                    >
                                        {STARTUP_LABELS[k]}
                                    </text>
                                    {settings.startupScreen === k ? (
                                        <text
                                            style={{
                                                color: theme.theme.primary,
                                                fontSize: '14px',
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
                <view
                    style={{
                        position: 'absolute',
                        bottom: '60px',
                        alignSelf: 'center',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        paddingLeft: '20px',
                        paddingRight: '20px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        borderRadius: '4px',
                    }}
                >
                    <text style={{ color: '#fff', fontSize: 14 }}>{snack}</text>
                </view>
            ) : null}
        </view>
    );
}
