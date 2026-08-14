import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import { sourceList } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { shadow, FONT, FONT_SERIF, RADIUS } from '../theme/index.js';

export function SourceDetailScreen({
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

    return (
        <Screen theme={theme}>
            <TopBar theme={theme} title="图源详情" onBack={() => nav.pop()} />
            <view
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px',
                    alignItems: 'center',
                }}
            >
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '64px',
                        height: '64px',
                        borderRadius: RADIUS.lg,
                        backgroundColor: t.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow:
                            shadow(theme.mode, 'panel'),
                    }}
                >
                    <text style={{ color: t.onAccent, fontSize: FONT.glyphLg }}>
                        🗂
                    </text>
                </view>
                <text
                    style={{
                        fontSize: FONT.icon,
                        fontWeight: '600',
                        marginTop: '12px',
                        color: t.text,
                        ...FONT_SERIF,
                        letterSpacing: '0.5px',
                    }}
                >
                    {source?.title ?? sourceId}
                </text>
            </view>
            <view style={{ backgroundColor: t.surface }}>
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        padding: '16px',
                        borderBottomWidth: '1px',
                        borderBottomColor: t.hairline,
                    }}
                >
                    <text
                        style={{
                            width: '90px',
                            fontSize: FONT.bodyLg,
                            color: t.textMut,
                        }}
                    >
                        图源编号
                    </text>
                    <text style={{ fontSize: FONT.bodyLg, color: t.text }}>
                        {sourceId}
                    </text>
                </view>
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        padding: '16px',
                    }}
                >
                    <text
                        style={{
                            width: '90px',
                            fontSize: FONT.bodyLg,
                            color: t.textMut,
                        }}
                    >
                        收藏数量
                    </text>
                    <text style={{ fontSize: FONT.bodyLg, color: t.text }}>
                        {source?.favoriteCount ?? 0}
                    </text>
                </view>
            </view>
        </Screen>
    );
}
