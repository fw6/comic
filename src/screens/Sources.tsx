import { Checkbox, List } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import type { Source } from '../data/models.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function SourcesScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(sourceList().map((s) => [s.id, s.enabled])),
    );

    const toggle = (id: string) =>
        setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
    const setAll = (value: boolean) =>
        setEnabled((prev) =>
            Object.fromEntries(Object.keys(prev).map((k) => [k, value])),
        );

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
                                setEnabled((prev) => {
                                    const next: Record<string, boolean> = {};
                                    for (const k of Object.keys(prev))
                                        next[k] = !prev[k];
                                    return next;
                                });
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
                                checked={enabled[source.id]}
                                onChange={() => toggle(source.id)}
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
