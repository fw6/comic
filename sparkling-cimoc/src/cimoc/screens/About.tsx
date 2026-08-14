import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { shadow, FONT, FONT_SERIF, RADIUS } from '../theme/index.js';

function Row({ theme, title, value }: { theme: ReturnType<typeof useAppStore>['theme']; title: string; value?: string }) {
    const t = theme.tokens;
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
                borderBottomColor: t.hairline,
                backgroundColor: t.surface,
            }}
        >
            <text style={{ flexGrow: 1, fontSize: FONT.bodyLg, color: t.text }}>
                {title}
            </text>
            {value ? (
                <text style={{ fontSize: FONT.body, color: t.textSub }}>
                    {value}
                </text>
            ) : null}
        </view>
    );
}

export function AboutScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    return (
        <Screen theme={theme}>
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
                        borderRadius: RADIUS.xl,
                        backgroundColor: t.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow:
                            shadow(theme.mode, 'panel'),
                    }}
                >
                    <text style={{ color: t.onAccent, fontSize: FONT.glyphXl }}>
                        📖
                    </text>
                </view>
                <text
                    style={{
                        fontSize: FONT.icon,
                        fontWeight: '600',
                        marginTop: '16px',
                        color: t.text,
                        ...FONT_SERIF,
                        letterSpacing: '3px',
                    }}
                >
                    Cimoc
                </text>
                <text
                    style={{
                        fontSize: FONT.body,
                        color: t.textMut,
                        marginTop: '4px',
                    }}
                >
                    v1.0.0
                </text>
                <text
                    style={{
                        fontSize: FONT.bodySm,
                        color: t.textSub,
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
                <Row theme={theme} title="开源许可" value="GPL-3.0" />
                <Row theme={theme} title="项目主页" value="GitHub" />
                <Row theme={theme} title="反馈与建议" />
            </view>
            {/* Created By Deerflow 署名：低调页脚 */}
            <view
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingTop: '20px',
                    paddingBottom: '28px',
                }}
            >
                <text
                    style={{
                        fontSize: FONT.captionSm,
                        color: t.textMut,
                        letterSpacing: '1px',
                        opacity: 0.65,
                    }}
                >
                    ✦ Deerflow
                </text>
            </view>
        </Screen>
    );
}
