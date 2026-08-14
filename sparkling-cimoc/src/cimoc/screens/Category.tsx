import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { EmptyState } from '../components/EmptyState.js';
import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import { categoriesForSource, sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT, FONT_SERIF } from '../theme/index.js';

export function CategoryScreen({
    nav,
    sourceId,
}: {
    nav: NavApi;
    sourceId: string;
}) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const source = sourceList().find((s) => s.id === sourceId);
    // 分类列表按图源加载（MangaDex 的 tags 需要网络请求）
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        categoriesForSource(sourceId)
            .then((list) => {
                if (!cancelled) setCategories(list);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sourceId]);

    return (
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title={source ? `${source.title} · 分类` : '分类'}
                onBack={() => nav.pop()}
            />
            {loading ? (
                <EmptyState theme={theme} text="加载中…" glyph="🗂" />
            ) : (
                <List
                    listId={`category-${sourceId}`}
                    listType="single"
                    spanCount={1}
                    scrollOrientation="vertical"
                    style={{ flexGrow: 1 }}
                >
                    {categories.map((c) => (
                        <list-item item-key={c} key={c}>
                            <view
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: '16px',
                                    backgroundColor: t.surface,
                                    borderBottomWidth: '1px',
                                    borderBottomColor: t.hairline,
                                }}
                                bindtap={() =>
                                    nav.push({
                                        name: 'result',
                                        keyword: c,
                                        sources: [sourceId],
                                        mode: 'category',
                                    })
                                }
                            >
                                <text
                                    style={{
                                        flexGrow: 1,
                                        fontSize: FONT.titleSm,
                                        color: t.text,
                                        ...FONT_SERIF,
                                        letterSpacing: '0.3px',
                                    }}
                                >
                                    {c}
                                </text>
                                <text
                                    style={{ color: t.textMut, fontSize: FONT.titleLg }}
                                >
                                    ›
                                </text>
                            </view>
                        </list-item>
                    ))}
                </List>
            )}
        </Screen>
    );
}
