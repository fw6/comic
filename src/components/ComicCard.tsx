import type { Comic } from '../data/models.js';

export function ComicCover({
    color,
    title,
    image,
}: {
    color: string;
    title: string;
    image?: string;
}) {
    // 真实图源封面：优先网络图片，否则占位色块
    return (
        <view
            style={{
                width: '100%',
                aspectRatio: 3 / 4,
                backgroundColor: color,
                borderRadius: '4px',
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
}: {
    comic: Comic;
    onTap: () => void;
    onLongPress?: () => void;
    badge?: string;
}) {
    return (
        <view
            style={{ width: '100%' }}
            bindtap={onTap}
            {...(onLongPress ? { bindlongpress: onLongPress } : {})}
        >
            <view style={{ position: 'relative' }}>
                <ComicCover
                    color={comic.cover}
                    title={comic.title}
                    image={
                        comic.cover.startsWith('http') ? comic.cover : undefined
                    }
                />
                {badge ? (
                    <view
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: '#E53935',
                            borderRadius: '8px',
                            paddingLeft: '5px',
                            paddingRight: '5px',
                            paddingTop: '1px',
                            paddingBottom: '1px',
                        }}
                    >
                        <text style={{ color: '#fff', fontSize: '10px' }}>
                            {badge}
                        </text>
                    </view>
                ) : null}
            </view>
            <text
                style={{
                    marginTop: '6px',
                    fontSize: '13px',
                    color: '#212121',
                    lineHeight: '18px',
                    textOverflow: 'ellipsis',
                }}
                text-maxline={'2'}
            >
                {comic.title}
            </text>
        </view>
    );
}
