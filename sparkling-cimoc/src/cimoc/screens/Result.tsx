import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { EmptyState } from '../components/EmptyState.js';
import { Screen } from '../components/Screen.js';
import { TopBar } from '../components/TopBar.js';
import type { Comic } from '../data/models.js';
import { categoryComics, searchComics } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { shadow, FONT, FONT_SERIF, RADIUS } from '../theme/index.js';

export function ResultScreen({
    nav,
    keyword,
    sources,
    mode,
}: {
    nav: NavApi;
    keyword: string;
    sources: string[];
    mode: 'search' | 'category';
}) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const [results, setResults] = useState<Comic[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            // 分类浏览走指定图源的分类；搜索可跨多图源并发合并。
            const data =
                mode === 'category'
                    ? await categoryComics(keyword, sources[0])
                    : await searchComics(keyword, sources);
            if (!cancelled) {
                setResults(data);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [keyword, sources, mode]);

    const isCategory = mode === 'category';
    const title = isCategory
        ? `${keyword}（${sources.length} 个图源）`
        : `"${keyword}" 的搜索结果`;

    return (
        <Screen theme={theme}>
            <TopBar theme={theme} title={title} onBack={() => nav.pop()} />
            {loading ? (
                <EmptyState theme={theme} text="加载中…" glyph="🔍" />
            ) : (
                <List
                    listId={`result-${keyword}-${sources.join('-')}`}
                    listType="single"
                    spanCount={1}
                    scrollOrientation="vertical"
                    style={{ flexGrow: 1 }}
                >
                    {results.map((comic) => (
                        <list-item item-key={comic.id} key={comic.id}>
                            <view
                                style={{
                                    alignItems: 'stretch',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    padding: '12px',
                                    backgroundColor: t.surface,
                                    borderBottomWidth: '1px',
                                    borderBottomColor: t.hairline,
                                }}
                                bindtap={() =>
                                    nav.push({
                                        name: 'detail',
                                        comicId: comic.id,
                                    })
                                }
                            >
                                <view
                                    style={{
                                        width: '60px',
                                        height: '80px',
                                        boxShadow:
                                            shadow(theme.mode, 'coverSm'),
                                    }}
                                >
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
                                <view
                                    style={{
                                        alignItems: 'stretch',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexGrow: 1,
                                        marginLeft: '12px',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <text
                                        style={{
                                            fontSize: FONT.titleSm,
                                            color: t.text,
                                            fontWeight: '500',
                                            ...FONT_SERIF,
                                            letterSpacing: '0.3px',
                                        }}
                                    >
                                        {comic.title}
                                    </text>
                                    <text
                                        style={{
                                            fontSize: FONT.bodySm,
                                            color: t.textSub,
                                            marginTop: '4px',
                                        }}
                                    >
                                        {comic.sourceTitle}
                                        {comic.author
                                            ? ` · ${comic.author}`
                                            : ''}
                                    </text>
                                    <view
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginTop: '4px',
                                        }}
                                    >
                                        <view
                                            style={{
                                                width: '5px',
                                                height: '5px',
                                                borderRadius: '3px',
                                                backgroundColor:
                                                    comic.status === 'finish'
                                                        ? t.textMut
                                                        : t.accent,
                                                marginRight: '5px',
                                            }}
                                        />
                                        <text
                                            style={{
                                                fontSize: FONT.small,
                                                color: t.textMut,
                                            }}
                                        >
                                            {comic.status === 'finish'
                                                ? '完结'
                                                : '连载'}
                                        </text>
                                    </view>
                                </view>
                            </view>
                        </list-item>
                    ))}
                </List>
            )}
            {!loading && results.length === 0 ? (
                <EmptyState theme={theme} text="无结果" glyph="🌫" />
            ) : null}
        </Screen>
    );
}
