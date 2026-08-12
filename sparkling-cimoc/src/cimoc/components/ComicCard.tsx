import type { Comic } from '../data/models.js';
import { FONT_SERIF, RADIUS, type AppTheme } from '../theme/index.js';

export function ComicCover({
    color,
    title,
    image,
    radius = RADIUS.md,
}: {
    color: string;
    title: string;
    image?: string;
    radius?: string;
}) {
    // 真实图源封面：优先网络图片，否则占位色块
    return (
        <view
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                aspectRatio: 3 / 4,
                backgroundColor: color,
                borderRadius: radius,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {image ? (
                <image
                    src={image}
                    mode="aspectFill"
                    style={{ width: '100%', height: '100%' }}
                />
            ) : (
                <text
                    style={{
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center',
                        paddingLeft: '6px',
                        paddingRight: '6px',
                        lineHeight: '22px',
                    }}
                >
                    {title.slice(0, 4)}
                </text>
            )}
        </view>
    );
}

export function ComicCard({
    comic,
    onTap,
    onLongPress,
    badge,
    theme,
}: {
    comic: Comic;
    onTap: () => void;
    onLongPress?: () => void;
    /** 右上角角标，如「连载 / 完结」 */
    badge?: string;
    theme: AppTheme;
}) {
    const t = theme.tokens;
    const coverShadow =
        theme.mode === 'ink'
            ? '0 4px 12px rgba(0,0,0,0.45)'
            : '0 2px 8px rgba(60,40,20,0.16)';
    const badgeLive = badge === '连载';
    return (
        <view
            style={{ width: '100%' }}
            bindtap={onTap}
            {...(onLongPress ? { bindlongpress: onLongPress } : {})}
        >
            <view style={{ position: 'relative' }}>
                <view style={{ boxShadow: coverShadow, borderRadius: RADIUS.md }}>
                    <ComicCover
                        color={comic.cover}
                        title={comic.title}
                        image={
                            comic.cover.startsWith('http')
                                ? comic.cover
                                : undefined
                        }
                    />
                </view>
                {badge ? (
                    <view
                        style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            backgroundColor: badgeLive
                                ? t.accent
                                : t.surfaceSunken,
                            borderRadius: RADIUS.pill,
                            paddingLeft: '6px',
                            paddingRight: '6px',
                            paddingTop: '2px',
                            paddingBottom: '2px',
                        }}
                    >
                        <text
                            style={{
                                color: badgeLive ? t.onAccent : t.textSub,
                                fontSize: '10px',
                                lineHeight: '14px',
                            }}
                        >
                            {badge}
                        </text>
                    </view>
                ) : null}
            </view>
            <text
                style={{
                    marginTop: '6px',
                    fontSize: '13px',
                    color: t.text,
                    lineHeight: '18px',
                    ...FONT_SERIF,
                    letterSpacing: '0.3px',
                    textOverflow: 'ellipsis',
                }}
                text-maxline={'2'}
            >
                {comic.title}
            </text>
        </view>
    );
}
