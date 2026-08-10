import { TopBar } from '../components/TopBar.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

function Row({ title, value }: { title: string; value?: string }) {
    return (
        <view
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                paddingTop: '14px',
                paddingBottom: '14px',
                paddingLeft: '16px',
                paddingRight: '16px',
                borderBottomWidth: '1px',
                borderBottomColor: '#f0f0f0',
                backgroundColor: '#fff',
            }}
        >
            <text style={{ flexGrow: 1, fontSize: '15px', color: '#212121' }}>
                {title}
            </text>
            {value ? (
                <text style={{ fontSize: '14px', color: '#999' }}>{value}</text>
            ) : null}
        </view>
    );
}

export function AboutScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#f5f5f5',
            }}
        >
            <TopBar theme={theme} title="关于" onBack={() => nav.pop()} />
            <view
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '40px',
                }}
            >
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '72px',
                        height: '72px',
                        borderRadius: '16px',
                        backgroundColor: theme.theme.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <text style={{ color: '#fff', fontSize: '36px' }}>📖</text>
                </view>
                <text
                    style={{
                        fontSize: '22px',
                        fontWeight: '600',
                        marginTop: '16px',
                        color: '#212121',
                    }}
                >
                    Cimoc
                </text>
                <text
                    style={{
                        fontSize: '14px',
                        color: '#999',
                        marginTop: '4px',
                    }}
                >
                    v1.0.0
                </text>
                <text
                    style={{
                        fontSize: '13px',
                        color: '#666',
                        marginTop: '20px',
                        textAlign: 'center',
                        lineHeight: '20px',
                        paddingLeft: '32px',
                        paddingRight: '32px',
                    }}
                >
                    一款免费的在线漫画阅读器，集成多个图源，支持历史、收藏、下载与本地导入功能。本软件仅供学习交流，内容版权归原作者所有。
                </text>
            </view>
            <view>
                <Row title="开源许可" value="GPL-3.0" />
                <Row title="项目主页" value="GitHub" />
                <Row title="反馈与建议" />
            </view>
        </view>
    );
}
