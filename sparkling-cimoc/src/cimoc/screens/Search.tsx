import { Input } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';
import { Chip } from '../components/Chip.js';
import { Screen } from '../components/Screen.js';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF, RADIUS } from '../theme/index.js';

export function SearchScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const [keyword, setKeyword] = useState('');
    const [strict, setStrict] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    // 与 Sources 页共享的图源开关（持久化），默认全选已启用的图源
    const [selSources, setSelSources] = useState<Record<string, boolean>>(() => ({
        ...store.sources,
    }));

    const submit = () => {
        if (!keyword.trim()) return;
        const sources = Object.keys(selSources).filter((k) => selSources[k]);
        nav.push({ name: 'result', keyword: keyword.trim(), sources, mode: 'search' });
    };

    return (
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title="搜索"
                onBack={() => nav.pop()}
                actions={
                    <ToolbarAction
                        theme={theme}
                        label="图源"
                        onTap={() => setShowSourcePicker(!showSourcePicker)}
                    />
                }
            />
            <view style={{ padding: '16px' }}>
                {/* Source multi-select (Cimoc 图源 dialog) */}
                {showSourcePicker ? (
                    <view
                        style={{
                            backgroundColor: t.surface,
                            borderRadius: RADIUS.md,
                            padding: '12px',
                            marginBottom: '16px',
                            borderWidth: '1px',
                            borderColor: t.hairline,
                        }}
                    >
                        <text
                            style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                marginBottom: '8px',
                                color: t.text,
                                ...FONT_SERIF,
                                letterSpacing: '0.5px',
                            }}
                        >
                            选择搜索图源
                        </text>
                        <view
                            style={{
                                alignItems: 'stretch',
                                display: 'flex',
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                            }}
                        >
                            {sourceList().map((s) => {
                                const active = !!selSources[s.id];
                                return (
                                    <view
                                        key={s.id}
                                        bindtap={() => {
                                            setSelSources((prev) => ({
                                                ...prev,
                                                [s.id]: !prev[s.id],
                                            }));
                                            // 与 Sources 页共享并持久化
                                            store.toggleSource(s.id);
                                        }}
                                        style={{
                                            backgroundColor: active
                                                ? t.accent
                                                : t.surfaceSunken,
                                            borderRadius: RADIUS.pill,
                                            paddingLeft: '12px',
                                            paddingRight: '12px',
                                            paddingTop: '5px',
                                            paddingBottom: '5px',
                                            marginRight: '8px',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        <text
                                            style={{
                                                fontSize: '12px',
                                                color: active
                                                    ? t.onAccent
                                                    : t.textSub,
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
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: t.surface,
                        borderRadius: RADIUS.md,
                        borderWidth: '1px',
                        borderColor: t.border,
                        paddingLeft: '12px',
                        paddingRight: '12px',
                    }}
                >
                    <Input
                        value={keyword}
                        onInput={(value) => setKeyword(value)}
                        placeholder="输入漫画名称或作者"
                        style={{
                            flexGrow: 1,
                            height: '48px',
                            fontSize: '16px',
                            color: t.text,
                        }}
                    />
                    <view
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '44px',
                            height: '44px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        bindtap={submit}
                    >
                        <text
                            style={{
                                color: t.accent,
                                fontSize: '22px',
                            }}
                        >
                            🔍
                        </text>
                    </view>
                </view>

                {/* strict search */}
                <view
                    style={{
                        display: 'flex',
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
                            display: 'flex',
                            flexDirection: 'column',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            borderWidth: '2px',
                            borderColor: t.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: strict ? t.accent : t.surface,
                        }}
                    >
                        {strict ? (
                            <text style={{ color: t.onAccent, fontSize: '12px' }}>
                                ✓
                            </text>
                        ) : null}
                    </view>
                    <text
                        style={{
                            marginLeft: '10px',
                            fontSize: '15px',
                            color: t.text,
                        }}
                    >
                        严格搜索
                    </text>
                </view>

                {/* suggestions */}
                <view style={{ marginTop: '24px' }}>
                    <text
                        style={{
                            fontSize: '14px',
                            color: t.textMut,
                            marginBottom: '8px',
                            ...FONT_SERIF,
                            letterSpacing: '1px',
                        }}
                    >
                        热门搜索
                    </text>
                    <view
                        style={{
                            alignItems: 'stretch',
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                        }}
                    >
                        {[
                            'Eleceed',
                            'unOrdinary',
                            'Tower of God',
                            'Solo Leveling',
                        ].map((s) => (
                            <view
                                key={s}
                                style={{ marginBottom: '8px' }}
                            >
                                <Chip
                                    theme={theme}
                                    label={s}
                                    active={false}
                                    onTap={() => {
                                        setKeyword(s);
                                        const sources = Object.keys(
                                            selSources,
                                        ).filter((k) => selSources[k]);
                                        nav.push({
                                            name: 'result',
                                            keyword: s,
                                            sources,
                                            mode: 'search',
                                        });
                                    }}
                                />
                            </view>
                        ))}
                    </view>
                </view>
            </view>
        </Screen>
    );
}
