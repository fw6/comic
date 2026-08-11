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
    mode,
}: {
    nav: NavApi;
    keyword: string;
    sources: string[];
    mode: 'search' | 'category';
}) {
    const store = useAppStore();
    const { theme } = store;
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
            <TopBar theme={theme} title={title} onBack={() => nav.pop()} />
            {loading ? (
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        top: '45%',
                        width: '100%',
                        alignItems: 'center',
                    }}
                >
                    <text style={{ fontSize: '15px', color: '#999' }}>
                        加载中...
                    </text>
                </view>
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
                                    backgroundColor: '#fff',
                                    borderBottomWidth: '1px',
                                    borderBottomColor: '#eee',
                                }}
                                bindtap={() =>
                                    nav.push({
                                        name: 'detail',
                                        comicId: comic.id,
                                    })
                                }
                            >
                                <view style={{ width: '60px', height: '80px' }}>
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
                                            fontSize: '16px',
                                            color: '#212121',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {comic.title}
                                    </text>
                                    <text
                                        style={{
                                            fontSize: '13px',
                                            color: '#999',
                                            marginTop: '4px',
                                        }}
                                    >
                                        {comic.sourceTitle}
                                        {comic.author
                                            ? ` · ${comic.author}`
                                            : ''}
                                    </text>
                                    <text
                                        style={{
                                            fontSize: '12px',
                                            color: '#bbb',
                                            marginTop: '4px',
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
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        top: '45%',
                        width: '100%',
                        alignItems: 'center',
                    }}
                >
                    <text style={{ fontSize: '16px', color: '#999' }}>
                        无结果
                    </text>
                </view>
            ) : null}
        </view>
    );
}
