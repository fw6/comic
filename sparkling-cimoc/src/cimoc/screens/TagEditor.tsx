import { Input } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { Chip } from '../components/Chip.js';
import { Screen } from '../components/Screen.js';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import type { Comic } from '../data/models.js';
import { loadComic } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT, FONT_SERIF, RADIUS } from '../theme/index.js';

const PRESET_TAGS = [
    '热血',
    '少年',
    '治愈',
    '悬疑',
    '冒险',
    '搞笑',
    '恋爱',
    '完结',
];

export function TagEditorScreen({
    nav,
    comicId,
}: {
    nav: NavApi;
    comicId: string;
}) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const [comic, setComic] = useState<Comic | null>(null);
    const [tags, setTags] = useState<string[]>(() => store.getTags(comicId));
    const [input, setInput] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const c = await loadComic(comicId);
            if (!cancelled) setComic(c);
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [comicId]);

    const toggle = (tag: string) => {
        setTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );
    };

    const addCustom = () => {
        const v = input.trim();
        if (!v || tags.includes(v)) return;
        setTags([...tags, v]);
        setInput('');
    };

    return (
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title={`编辑标签 · ${comic?.title ?? ''}`}
                onBack={() => nav.pop()}
                actions={
                    <ToolbarAction
                        theme={theme}
                        accent
                        label="保存"
                        onTap={() => {
                            store.setTags(comicId, tags);
                            nav.pop();
                        }}
                    />
                }
            />
            <view style={{ padding: '16px' }}>
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
                        value={input}
                        onInput={(v) => setInput(v)}
                        placeholder="添加自定义标签"
                        style={{
                            flexGrow: 1,
                            height: '44px',
                            fontSize: FONT.bodyLg,
                            color: t.text,
                        }}
                    />
                    <view
                        bindtap={addCustom}
                        style={{
                            paddingLeft: '8px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                        }}
                    >
                        <text
                            style={{
                                color: t.accent,
                                fontSize: FONT.titleLg,
                            }}
                        >
                            ＋
                        </text>
                    </view>
                </view>
            </view>
            <view style={{ paddingLeft: '16px', paddingRight: '16px' }}>
                <text
                    style={{
                        fontSize: FONT.bodySm,
                        color: t.textMut,
                        marginBottom: '8px',
                        ...FONT_SERIF,
                        letterSpacing: '1px',
                    }}
                >
                    常用标签
                </text>
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                    }}
                >
                    {PRESET_TAGS.map((tag) => {
                        const active = tags.includes(tag);
                        return (
                            <view
                                key={tag}
                                style={{ marginBottom: '8px' }}
                            >
                                <Chip
                                    theme={theme}
                                    label={tag}
                                    active={active}
                                    onTap={() => toggle(tag)}
                                />
                            </view>
                        );
                    })}
                </view>
            </view>
        </Screen>
    );
}
