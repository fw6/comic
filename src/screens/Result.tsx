import { List } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { TopBar } from '../components/TopBar.js';
import type { Comic } from '../data/models.js';
import { categoryComics, searchComics } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';

export function ResultScreen({
    nav,
    keyword,
    sources,
}: {
    nav: NavApi;
    keyword: string;
    sources: string[];
}) {
    const store = useAppStore();
    const { theme } = store;
    const [results, setResults] = useState<Comic[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            // 分类浏览（sources 限定）走真实图源分类；否则走搜索。
            const data =
                sources.length > 0
                    ? await categoryComics(keyword)
                    : await searchComics(keyword);
            if (!cancelled) {
                setResults(data);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [keyword, sources]);

    const isCategory = sources.length > 0;
    const title = isCategory
        ? `${keyword}（${sources.length} 个图源）`
        : `"${keyword}" 的搜索结果`;

    return (
        <view style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <TopBar theme={theme} title={title} onBack={() => nav.pop()} />
            {loading ? (
                <view
                    style={{
                        position: 'absolute',
                        top: '45%',
                        width: '100%',
                        alignItems: 'center',
                    }}
                >
                    <text style={{ fontSize: 15, color: '#999' }}>
                        加载中...
                    </text>
                </view>
            ) : (
                <List
                    listId={`result-${keyword}-${sources.join('-')}`}
                    listType="single"
                    spanCount={1}
                    scrollOrientation="vertical"
                    style={{ flex: 1 }}
                >
                    {results.map((comic) => (
                        <list-item item-key={comic.id} key={comic.id}>
                            <view
                                style={{
                                    flexDirection: 'row',
                                    padding: 12,
                                    backgroundColor: '#fff',
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#eee',
                                }}
                                bindtap={() =>
                                    nav.push({
                                        name: 'detail',
                                        comicId: comic.id,
                                    })
                                }
                            >
                                <view style={{ width: 60, height: 80 }}>
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
                                        flex: 1,
                                        marginLeft: 12,
                                        justifyContent: 'center',
                                    }}
                                >
                                    <text
                                        style={{
                                            fontSize: 16,
                                            color: '#212121',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {comic.title}
                                    </text>
                                    <text
                                        style={{
                                            fontSize: 13,
                                            color: '#999',
                                            marginTop: 4,
                                        }}
                                    >
                                        {comic.sourceTitle}
                                        {comic.author
                                            ? ` · ${comic.author}`
                                            : ''}
                                    </text>
                                    <text
                                        style={{
                                            fontSize: 12,
                                            color: '#bbb',
                                            marginTop: 4,
                                        }}
                                    >
                                        {comic.status === 'finish'
                                            ? '完结'
                                            : '连载'}
                                    </text>
                                </view>
                            </view>
                        </list-item>
                    ))}
                </List>
            )}
            {!loading && results.length === 0 ? (
                <view
                    style={{
                        position: 'absolute',
                        top: '45%',
                        width: '100%',
                        alignItems: 'center',
                    }}
                >
                    <text style={{ fontSize: 16, color: '#999' }}>无结果</text>
                </view>
            ) : null}
        </view>
    );
}
