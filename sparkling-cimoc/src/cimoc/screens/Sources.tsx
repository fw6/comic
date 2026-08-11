import { Checkbox, List } from '@lynx-js/lynx-ui';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import type { Source } from '../data/models.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function SourcesScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    // 图源开关与 Search 页共享，持久化在原生存储
    const enabled = store.sources;

    const setAll = (value: boolean) => {
        const next: Record<string, boolean> = {};
        for (const s of sourceList()) next[s.id] = value;
        store.updateSources(next);
    };

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
                title="图源"
                onBack={() => nav.pop()}
                actions={
                    <>
                        <ToolbarAction
                            label="搜索"
                            onTap={() => nav.push({ name: 'search' })}
                        />
                        <ToolbarAction
                            label="全选"
                            onTap={() => setAll(true)}
                        />
                        <ToolbarAction
                            label="反选"
                            onTap={() => {
                                const next: Record<string, boolean> = {};
                                for (const s of sourceList())
                                    next[s.id] = !enabled[s.id];
                                store.updateSources(next);
                            }}
                        />
                        <ToolbarAction
                            label="清空"
                            onTap={() => setAll(false)}
                        />
                    </>
                }
            />
            <List
                listId="sources"
                listType="flow"
                spanCount={2}
                mainAxisGap={12}
                crossAxisGap={12}
                scrollOrientation="vertical"
                style={{ flexGrow: 1, padding: '12px' }}
            >
                {sourceList().map((source: Source) => (
                    <list-item item-key={source.id} key={source.id}>
                        <view
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#fff',
                                borderRadius: '6px',
                                padding: '14px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            }}
                            bindtap={() =>
                                nav.push({
                                    name: 'category',
                                    sourceId: source.id,
                                    category: '',
                                })
                            }
                            bindlongpress={() =>
                                nav.push({
                                    name: 'sourceDetail',
                                    sourceId: source.id,
                                })
                            }
                        >
                            <Checkbox
                                checked={!!enabled[source.id]}
                                onChange={() => store.toggleSource(source.id)}
                            />
                            <view
                                style={{
                                    alignItems: 'stretch',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    marginLeft: '10px',
                                    flexGrow: 1,
                                }}
                            >
                                <text
                                    style={{
                                        fontSize: '16px',
                                        color: '#212121',
                                    }}
                                >
                                    {source.title}
                                </text>
                            </view>
                        </view>
                    </list-item>
                ))}
            </List>
        </view>
    );
}
