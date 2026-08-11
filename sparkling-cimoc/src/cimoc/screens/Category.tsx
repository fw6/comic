import { List } from '@lynx-js/lynx-ui';
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
    const categories = categoriesForSource(sourceId);

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
        </view>
    );
}
