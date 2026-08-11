import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { TopBar } from '../components/TopBar.js';
import { categoriesForSource, sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function CategoryScreen({
    nav,
    sourceId,
}: {
    nav: NavApi;
    sourceId: string;
}) {
    const store = useAppStore();
    const { theme } = store;
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
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#fafafa',
            }}
        >
            <TopBar
                theme={theme}
                title={source ? `${source.title} · 分类` : '分类'}
                onBack={() => nav.pop()}
            />
            {loading ? (
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <text style={{ fontSize: '15px', color: '#999' }}>
                        加载中...
                    </text>
                </view>
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
                                    backgroundColor: '#fff',
                                    borderBottomWidth: '1px',
                                    borderBottomColor: '#f0f0f0',
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
                                        fontSize: '16px',
                                        color: '#212121',
                                    }}
                                >
                                    {c}
                                </text>
                                <text style={{ color: '#bbb', fontSize: '18px' }}>
                                    ›
                                </text>
                            </view>
                        </list-item>
                    ))}
                </List>
            )}
        </view>
    );
}
