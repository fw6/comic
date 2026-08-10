import { TopBar } from '../components/TopBar.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function SourceDetailScreen({
    nav,
    sourceId,
}: {
    nav: NavApi;
    sourceId: string;
}) {
    const store = useAppStore();
    const { theme } = store;
    const source = sourceList().find((s) => s.id === sourceId);

    return (
        <view style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <TopBar theme={theme} title="图源详情" onBack={() => nav.pop()} />
            <view style={{ padding: 20, alignItems: 'center' }}>
                <view
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: '12px',
                        backgroundColor: theme.theme.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <text style={{ color: '#fff', fontSize: 30 }}>🗂</text>
                </view>
                <text
                    style={{
                        fontSize: '22px',
                        fontWeight: '600',
                        marginTop: '12px',
                        color: '#212121',
                    }}
                >
                    {source?.title ?? sourceId}
                </text>
            </view>
            <view style={{ backgroundColor: '#fff' }}>
                <view
                    style={{
                        flexDirection: 'row',
                        padding: 16,
                        borderBottomWidth: '1px',
                        borderBottomColor: '#f0f0f0',
                    }}
                >
                    <text
                        style={{ width: 90, fontSize: '15px', color: '#999' }}
                    >
                        图源编号
                    </text>
                    <text style={{ fontSize: '15px', color: '#212121' }}>
                        {sourceId}
                    </text>
                </view>
                <view style={{ flexDirection: 'row', padding: 16 }}>
                    <text
                        style={{ width: 90, fontSize: '15px', color: '#999' }}
                    >
                        收藏数量
                    </text>
                    <text style={{ fontSize: '15px', color: '#212121' }}>
                        {source?.favoriteCount ?? 0}
                    </text>
                </view>
            </view>
        </view>
    );
}
