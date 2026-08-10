import { Input } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function SearchScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const [keyword, setKeyword] = useState('');
    const [strict, setStrict] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [selSources, setSelSources] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(sourceList().map((s) => [s.id, s.enabled])),
    );

    const submit = () => {
        if (!keyword.trim()) return;
        const sources = Object.keys(selSources).filter((k) => selSources[k]);
        nav.push({ name: 'result', keyword: keyword.trim(), sources });
    };

    return (
        <view style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <TopBar
                theme={theme}
                title="搜索"
                onBack={() => nav.pop()}
                actions={
                    <ToolbarAction
                        label="图源"
                        onTap={() => setShowSourcePicker(!showSourcePicker)}
                    />
                }
            />
            <view style={{ padding: 16 }}>
                {/* Source multi-select (Cimoc 图源 dialog) */}
                {showSourcePicker ? (
                    <view
                        style={{
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            padding: 12,
                            marginBottom: '16px',
                            borderWidth: '1px',
                            borderColor: '#eee',
                        }}
                    >
                        <text
                            style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                marginBottom: '8px',
                                color: '#333',
                            }}
                        >
                            选择搜索图源
                        </text>
                        <view
                            style={{ flexDirection: 'row', flexWrap: 'wrap' }}
                        >
                            {sourceList().map((s) => {
                                const active = !!selSources[s.id];
                                return (
                                    <view
                                        key={s.id}
                                        bindtap={() =>
                                            setSelSources((prev) => ({
                                                ...prev,
                                                [s.id]: !prev[s.id],
                                            }))
                                        }
                                        style={{
                                            backgroundColor: active
                                                ? theme.theme.primary
                                                : '#f0f0f0',
                                            borderRadius: '12px',
                                            paddingLeft: '10px',
                                            paddingRight: '10px',
                                            paddingTop: '4px',
                                            paddingBottom: '4px',
                                            marginRight: '8px',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        <text
                                            style={{
                                                fontSize: '12px',
                                                color: active ? '#fff' : '#555',
                                            }}
                                        >
                                            {s.title}
                                        </text>
                                    </view>
                                );
                            })}
                        </view>
                    </view>
                ) : null}

                <view
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        borderWidth: '1px',
                        borderColor: '#ddd',
                        paddingLeft: '12px',
                        paddingRight: '12px',
                    }}
                >
                    <Input
                        value={keyword}
                        onInput={(value) => setKeyword(value)}
                        placeholder="输入漫画名称或作者"
                        style={{ flex: 1, height: 48, fontSize: 16 }}
                    />
                    <view
                        style={{
                            width: 44,
                            height: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        bindtap={submit}
                    >
                        <text
                            style={{ color: theme.theme.accent, fontSize: 22 }}
                        >
                            🔍
                        </text>
                    </view>
                </view>

                {/* strict search */}
                <view
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: '16px',
                        paddingLeft: '4px',
                        paddingRight: '4px',
                    }}
                    bindtap={() => setStrict(!strict)}
                >
                    <view
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: '3px',
                            borderWidth: '2px',
                            borderColor: theme.theme.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: strict
                                ? theme.theme.accent
                                : '#fff',
                        }}
                    >
                        {strict ? (
                            <text style={{ color: '#fff', fontSize: 12 }}>
                                ✓
                            </text>
                        ) : null}
                    </view>
                    <text
                        style={{
                            marginLeft: '10px',
                            fontSize: '15px',
                            color: '#333',
                        }}
                    >
                        严格搜索
                    </text>
                </view>

                {/* suggestions */}
                <view style={{ marginTop: 24 }}>
                    <text
                        style={{
                            fontSize: '14px',
                            color: '#999',
                            marginBottom: 8,
                        }}
                    >
                        热门搜索
                    </text>
                    <view style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {[
                            'Eleceed',
                            'unOrdinary',
                            'Tower of God',
                            'Solo Leveling',
                        ].map((s) => (
                            <view
                                key={s}
                                bindtap={() => {
                                    setKeyword(s);
                                    const sources = Object.keys(
                                        selSources,
                                    ).filter((k) => selSources[k]);
                                    nav.push({
                                        name: 'result',
                                        keyword: s,
                                        sources,
                                    });
                                }}
                                style={{
                                    backgroundColor: '#fff',
                                    borderRadius: '16px',
                                    paddingLeft: '14px',
                                    paddingRight: '14px',
                                    paddingTop: '6px',
                                    paddingBottom: '6px',
                                    marginRight: '8px',
                                    marginBottom: '8px',
                                    borderWidth: '1px',
                                    borderColor: '#eee',
                                }}
                            >
                                <text
                                    style={{ fontSize: '14px', color: '#555' }}
                                >
                                    {s}
                                </text>
                            </view>
                        ))}
                    </view>
                </view>
            </view>
        </view>
    );
}
