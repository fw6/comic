import { useState } from '@lynx-js/react';
import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF, RADIUS } from '../theme/index.js';

// Cimoc 的可配置阅读事件
const EVENTS = [
    '无动作',
    '上一页',
    '下一页',
    '保存图片',
    '加载上一话',
    '加载下一话',
    '退出阅读',
    '跳到首页',
    '跳到末页',
    '切换屏幕方向',
    '切换阅读模式',
    '显示/隐藏进度',
    '重新加载图片',
    '切换夜间模式',
] as const;

type EventName = (typeof EVENTS)[number];

const ZONES = [
    { key: 'tl', label: '左上' },
    { key: 'tc', label: '上中' },
    { key: 'tr', label: '右上' },
    { key: 'ml', label: '中左' },
    { key: 'mc', label: '中中' },
    { key: 'mr', label: '中右' },
    { key: 'bl', label: '左下' },
    { key: 'bc', label: '下中' },
    { key: 'br', label: '右下' },
] as const;

export function EventSettingsScreen({
    nav,
    mode,
}: {
    nav: NavApi;
    mode: 'page' | 'stream';
}) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    // key: click zone -> event; longPress separate map
    const [clickMap, setClickMap] = useState<Record<string, EventName>>({
        tl: '上一页',
        tc: '无动作',
        tr: '下一页',
        ml: '无动作',
        mc: '显示/隐藏进度',
        mr: '无动作',
        bl: '上一页',
        bc: '无动作',
        br: '下一页',
    });
    const [longMap, setLongMap] = useState<Record<string, EventName>>({
        mc: '切换阅读模式',
    });
    const [editing, setEditing] = useState<{
        map: 'click' | 'long';
        zone: string;
    } | null>(null);

    const currentMap = editing?.map === 'long' ? longMap : clickMap;

    return (
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title={`点击事件 · ${mode === 'page' ? '翻页模式' : '卷纸模式'}`}
                onBack={() => nav.pop()}
            />
            <view style={{ padding: '16px' }}>
                <text
                    style={{
                        fontSize: '14px',
                        color: t.textMut,
                        marginBottom: '12px',
                        ...FONT_SERIF,
                        letterSpacing: '0.5px',
                    }}
                >
                    点击屏幕 3×3 区域的触发事件（长按区域单独配置）
                </text>
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                    }}
                >
                    {ZONES.map((z) => (
                        <view
                            key={z.key}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                width: '31%',
                                backgroundColor: t.surface,
                                borderRadius: RADIUS.md,
                                marginBottom: '10px',
                                padding: '10px',
                                alignItems: 'center',
                                borderWidth: '1px',
                                borderColor: t.hairline,
                            }}
                        >
                            <text style={{ fontSize: '12px', color: t.textMut }}>
                                {z.label}
                            </text>
                            <text
                                bindtap={() =>
                                    setEditing({ map: 'click', zone: z.key })
                                }
                                style={{
                                    fontSize: '14px',
                                    color: t.accent,
                                    marginTop: '6px',
                                    textAlign: 'center',
                                }}
                            >
                                {clickMap[z.key]}
                            </text>
                            <text
                                style={{
                                    fontSize: '10px',
                                    color: t.textMut,
                                    marginTop: '4px',
                                }}
                            >
                                长按: {longMap[z.key] ?? '无动作'}
                            </text>
                            <text
                                bindtap={() =>
                                    setEditing({ map: 'long', zone: z.key })
                                }
                                style={{
                                    fontSize: '11px',
                                    color: t.textSub,
                                    marginTop: '2px',
                                    textDecorationLine: 'underline',
                                }}
                            >
                                设置长按
                            </text>
                        </view>
                    ))}
                </view>
            </view>

            {/* event picker */}
            {editing ? (
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
                    bindtap={() => setEditing(null)}
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
                                fontSize: '16px',
                                fontWeight: '600',
                                color: t.text,
                                ...FONT_SERIF,
                                letterSpacing: '0.5px',
                                marginBottom: '10px',
                            }}
                        >
                            选择事件
                        </text>
                        {EVENTS.map((ev) => (
                            <view
                                key={ev}
                                bindtap={() => {
                                    if (editing.map === 'long') {
                                        setLongMap((prev) => ({
                                            ...prev,
                                            [editing.zone]: ev,
                                        }));
                                    } else {
                                        setClickMap((prev) => ({
                                            ...prev,
                                            [editing.zone]: ev,
                                        }));
                                    }
                                    setEditing(null);
                                }}
                                style={{
                                    paddingTop: '10px',
                                    paddingBottom: '10px',
                                    borderBottomWidth: '1px',
                                    borderBottomColor: t.hairline,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <text
                                    style={{
                                        flexGrow: 1,
                                        fontSize: '14px',
                                        color: t.text,
                                    }}
                                >
                                    {ev}
                                </text>
                                {currentMap[editing.zone] === ev ? (
                                    <text
                                        style={{
                                            color: t.accent,
                                            fontSize: '14px',
                                        }}
                                    >
                                        ✓
                                    </text>
                                ) : null}
                            </view>
                        ))}
                    </view>
                </view>
            ) : null}
        </Screen>
    );
}
