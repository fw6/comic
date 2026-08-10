import { Input } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { TopBar } from '../components/TopBar.js';
import type { Comic } from '../data/models.js';
import { loadComic } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

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
        <view style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <TopBar
                theme={theme}
                title={`编辑标签 · ${comic?.title ?? ''}`}
                onBack={() => nav.pop()}
                actions={
                    <view
                        bindtap={() => {
                            store.setTags(comicId, tags);
                            nav.pop();
                        }}
                        style={{
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                        }}
                    >
                        <text style={{ color: '#fff', fontSize: 15 }}>
                            保存
                        </text>
                    </view>
                }
            />
            <view style={{ padding: 16 }}>
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
                        value={input}
                        onInput={(v) => setInput(v)}
                        placeholder="添加自定义标签"
                        style={{ flex: 1, height: 44, fontSize: 15 }}
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
                            style={{ color: theme.theme.accent, fontSize: 18 }}
                        >
                            ＋
                        </text>
                    </view>
                </view>
            </view>
            <view style={{ paddingLeft: '16px', paddingRight: 16 }}>
                <text
                    style={{ fontSize: '13px', color: '#999', marginBottom: 8 }}
                >
                    常用标签
                </text>
                <view style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {PRESET_TAGS.map((t) => {
                        const active = tags.includes(t);
                        return (
                            <view
                                key={t}
                                bindtap={() => toggle(t)}
                                style={{
                                    backgroundColor: active
                                        ? theme.theme.primary
                                        : '#fff',
                                    borderRadius: '16px',
                                    paddingLeft: '14px',
                                    paddingRight: '14px',
                                    paddingTop: '6px',
                                    paddingBottom: '6px',
                                    marginRight: '8px',
                                    marginBottom: '8px',
                                    borderWidth: '1px',
                                    borderColor: active
                                        ? theme.theme.primary
                                        : '#ddd',
                                }}
                            >
                                <text
                                    style={{
                                        fontSize: '14px',
                                        color: active ? '#fff' : '#555',
                                    }}
                                >
                                    {t}
                                </text>
                            </view>
                        );
                    })}
                </view>
            </view>
        </view>
    );
}
