import { useState } from '@lynx-js/react';
import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF } from '../theme/index.js';

function ToggleRow({
    theme,
    title,
    value,
    onTap,
}: {
    theme: ReturnType<typeof useAppStore>['theme'];
    title: string;
    value: boolean;
    onTap: () => void;
}) {
    const t = theme.tokens;
    return (
        <view
            bindtap={onTap}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.surface,
                paddingTop: '14px',
                paddingBottom: '14px',
                paddingLeft: '16px',
                paddingRight: '16px',
                borderBottomWidth: '1px',
                borderBottomColor: t.hairline,
            }}
        >
            <text style={{ flexGrow: 1, fontSize: '15px', color: t.text }}>
                {title}
            </text>
            <view
                style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    backgroundColor: value ? t.accent : t.border,
                    padding: '3px',
                }}
            >
                <view
                    style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        backgroundColor: t.surfaceRaised,
                        marginLeft: value ? 22 : 0,
                        transitionProperty: 'margin-left',
                        transitionDuration: '160ms',
                        transitionTimingFunction: 'ease-out',
                    }}
                />
            </view>
        </view>
    );
}

export function ReaderConfigScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme, settings, updateSettings } = store;
    const t = theme.tokens;
    const [tab, setTab] = useState<'page' | 'stream'>('page');

    return (
        <Screen theme={theme}>
            <TopBar theme={theme} title="阅读配置" onBack={() => nav.pop()} />
            <view
                style={{
                    alignItems: 'stretch',
                    display: 'flex',
                    flexDirection: 'row',
                    backgroundColor: t.surface,
                    borderBottomWidth: '1px',
                    borderBottomColor: t.hairline,
                }}
            >
                {(['page', 'stream'] as const).map((m) => (
                    <view
                        key={m}
                        bindtap={() => setTab(m)}
                        style={{
                            flexGrow: 1,
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            alignItems: 'center',
                            borderBottomWidth: '2px',
                            borderBottomColor:
                                tab === m ? t.accent : 'transparent',
                        }}
                    >
                        <text
                            style={{
                                color: tab === m ? t.accent : t.textSub,
                                fontSize: '15px',
                                fontWeight: tab === m ? '600' : '400',
                            }}
                        >
                            {m === 'page' ? '翻页模式' : '卷纸模式'}
                        </text>
                    </view>
                ))}
            </view>
            <view>
                <ToggleRow
                    theme={theme}
                    title="默认使用此模式"
                    value={settings.defaultMode === tab}
                    onTap={() => updateSettings({ defaultMode: tab })}
                />
                <ToggleRow
                    theme={theme}
                    title="自动加载上一话"
                    value={false}
                    onTap={() => {}}
                />
                <ToggleRow
                    theme={theme}
                    title="自动加载下一话"
                    value={false}
                    onTap={() => {}}
                />
                <ToggleRow
                    theme={theme}
                    title="快速翻页（无动画）"
                    value={false}
                    onTap={() => {}}
                />
                <view style={{ marginTop: '8px' }}>
                    <view
                        bindtap={() =>
                            nav.push({ name: 'eventSettings', mode: tab })
                        }
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingTop: '14px',
                            paddingBottom: '14px',
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            backgroundColor: t.surface,
                        }}
                    >
                        <text
                            style={{
                                flexGrow: 1,
                                fontSize: '15px',
                                color: t.text,
                            }}
                        >
                            自定义点击事件
                        </text>
                        <text
                            style={{
                                fontSize: '14px',
                                color: t.textSub,
                                ...FONT_SERIF,
                                letterSpacing: '0.3px',
                            }}
                        >
                            配置 ›
                        </text>
                    </view>
                    <view
                        bindtap={() =>
                            nav.push({ name: 'eventSettings', mode: tab })
                        }
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingTop: '14px',
                            paddingBottom: '14px',
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            backgroundColor: t.surface,
                            borderTopWidth: '1px',
                            borderTopColor: t.hairline,
                        }}
                    >
                        <text
                            style={{
                                flexGrow: 1,
                                fontSize: '15px',
                                color: t.text,
                            }}
                        >
                            自定义长按事件
                        </text>
                        <text
                            style={{
                                fontSize: '14px',
                                color: t.textSub,
                                ...FONT_SERIF,
                                letterSpacing: '0.3px',
                            }}
                        >
                            配置 ›
                        </text>
                    </view>
                </view>
            </view>
        </Screen>
    );
}
