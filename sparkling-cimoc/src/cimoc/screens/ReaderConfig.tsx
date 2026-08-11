import { useState } from '@lynx-js/react';
import { TopBar } from '../components/TopBar.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

function ToggleRow({
    title,
    value,
    onTap,
}: {
    title: string;
    value: boolean;
    onTap: () => void;
}) {
    return (
        <view
            bindtap={onTap}
            style={{
                display: 'flex',
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
            <text style={{ flexGrow: 1, fontSize: '15px', color: '#212121' }}>
                {title}
            </text>
            <view
                style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    backgroundColor: value ? '#4CAF50' : '#ccc',
                    padding: '3px',
                }}
            >
                <view
                    style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        marginLeft: value ? 22 : 0,
                    }}
                />
            </view>
        </view>
    );
}

export function ReaderConfigScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme, settings, updateSettings } = store;
    const [tab, setTab] = useState<'page' | 'stream'>('page');

    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#f5f5f5',
            }}
        >
            <TopBar theme={theme} title="阅读配置" onBack={() => nav.pop()} />
            <view
                style={{
                    alignItems: 'stretch',
                    display: 'flex',
                    flexDirection: 'row',
                    backgroundColor: theme.theme.primary,
                }}
            >
                {(['page', 'stream'] as const).map((t) => (
                    <view
                        key={t}
                        bindtap={() => setTab(t)}
                        style={{
                            flexGrow: 1,
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            alignItems: 'center',
                            borderBottomWidth: '2px',
                            borderBottomColor:
                                tab === t ? '#fff' : 'transparent',
                        }}
                    >
                        <text
                            style={{
                                color:
                                    tab === t
                                        ? '#fff'
                                        : 'rgba(255,255,255,0.7)',
                                fontSize: '15px',
                            }}
                        >
                            {t === 'page' ? '翻页模式' : '卷纸模式'}
                        </text>
                    </view>
                ))}
            </view>
            <view>
                <ToggleRow
                    title="默认使用此模式"
                    value={settings.defaultMode === tab}
                    onTap={() => updateSettings({ defaultMode: tab })}
                />
                <ToggleRow
                    title="自动加载上一话"
                    value={false}
                    onTap={() => {}}
                />
                <ToggleRow
                    title="自动加载下一话"
                    value={false}
                    onTap={() => {}}
                />
                <ToggleRow
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
                            backgroundColor: '#fff',
                        }}
                    >
                        <text
                            style={{
                                flexGrow: 1,
                                fontSize: '15px',
                                color: '#212121',
                            }}
                        >
                            自定义点击事件
                        </text>
                        <text style={{ fontSize: '14px', color: '#999' }}>
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
                            backgroundColor: '#fff',
                            borderTopWidth: '1px',
                            borderTopColor: '#f0f0f0',
                        }}
                    >
                        <text
                            style={{
                                flexGrow: 1,
                                fontSize: '15px',
                                color: '#212121',
                            }}
                        >
                            自定义长按事件
                        </text>
                        <text style={{ fontSize: '14px', color: '#999' }}>
                            配置 ›
                        </text>
                    </view>
                </view>
            </view>
        </view>
    );
}
