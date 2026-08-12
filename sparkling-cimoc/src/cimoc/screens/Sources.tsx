import { Checkbox, List } from '@lynx-js/lynx-ui';
import { Screen } from '../components/Screen.js';
import { ToolbarAction, TopBar } from '../components/TopBar.js';
import type { Source } from '../data/models.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF, RADIUS } from '../theme/index.js';

export function SourcesScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    // 图源开关与 Search 页共享，持久化在原生存储
    const enabled = store.sources;

    const setAll = (value: boolean) => {
        const next: Record<string, boolean> = {};
        for (const s of sourceList()) next[s.id] = value;
        store.updateSources(next);
    };

    return (
        <Screen theme={theme}>
            <TopBar
                theme={theme}
                title="图源"
                onBack={() => nav.pop()}
                actions={
                    <>
                        <ToolbarAction
                            theme={theme}
                            label="搜索"
                            onTap={() => nav.push({ name: 'search' })}
                        />
                        <ToolbarAction
                            theme={theme}
                            label="全选"
                            onTap={() => setAll(true)}
                        />
                        <ToolbarAction
                            theme={theme}
                            label="反选"
                            onTap={() => {
                                const next: Record<string, boolean> = {};
                                for (const s of sourceList())
                                    next[s.id] = !enabled[s.id];
                                store.updateSources(next);
                            }}
                        />
                        <ToolbarAction
                            theme={theme}
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
                                backgroundColor: t.surface,
                                borderRadius: RADIUS.md,
                                padding: '14px',
                                boxShadow:
                                    theme.mode === 'ink'
                                        ? '0 2px 8px rgba(0,0,0,0.35)'
                                        : '0 1px 3px rgba(60,40,20,0.12)',
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
                                        color: t.text,
                                        ...FONT_SERIF,
                                        letterSpacing: '0.3px',
                                    }}
                                >
                                    {source.title}
                                </text>
                            </view>
                        </view>
                    </list-item>
                ))}
            </List>
        </Screen>
    );
}
