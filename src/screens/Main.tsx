import {
    SheetBackdrop,
    SheetContent,
    SheetRoot,
    screenWidth,
} from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import type { Comic } from '../data/models.js';
import { loadComic } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { LibraryScreen } from './Library.js';
import { SourcesScreen } from './Sources.js';

type DrawerItem =
    | {
          kind: 'content';
          key: 'library' | 'sources';
          label: string;
          icon: string;
      }
    | {
          kind: 'action';
          key: 'night' | 'backup' | 'settings' | 'about';
          label: string;
          icon: string;
      };

const CONTENT_ITEMS: DrawerItem[] = [
    { kind: 'content', key: 'library', label: '漫画', icon: '📚' },
    { kind: 'content', key: 'sources', label: '图源', icon: '🗂' },
];

const SYSTEM_ITEMS: DrawerItem[] = [
    { kind: 'action', key: 'night', label: '日间/夜间模式', icon: '🌙' },
    { kind: 'action', key: 'backup', label: '备份', icon: '💾' },
    { kind: 'action', key: 'settings', label: '设置', icon: '⚙' },
    { kind: 'action', key: 'about', label: '关于', icon: 'ℹ' },
];

function DrawerHeader() {
    const store = useAppStore();
    const { theme } = store;
    const [recent, setRecent] = useState<Comic | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const first = store.history[0];
            if (!first) return;
            const c = await loadComic(first);
            if (!cancelled) setRecent(c);
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [store.history]);

    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                height: '250px',
                backgroundColor: theme.theme.primary,
                padding: '16px',
                justifyContent: 'flex-end',
            }}
        >
            {recent ? (
                <>
                    <view
                        style={{
                            width: '56px',
                            height: '74px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                        }}
                    >
                        <ComicCover
                            color={recent.cover}
                            title={recent.title}
                            image={
                                recent.cover.startsWith('http')
                                    ? recent.cover
                                    : undefined
                            }
                        />
                    </view>
                    <text
                        style={{
                            color: '#fff',
                            fontSize: '16px',
                            marginTop: '10px',
                            fontWeight: '500',
                        }}
                    >
                        {recent.title}
                    </text>
                </>
            ) : (
                <text
                    style={{
                        color: '#fff',
                        fontSize: '18px',
                        fontWeight: '600',
                    }}
                >
                    Cimoc
                </text>
            )}
        </view>
    );
}

export function MainScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState<'library' | 'sources'>('library');

    const onItem = (item: DrawerItem) => {
        if (item.kind === 'content') {
            setContent(item.key);
            setOpen(false);
        } else if (item.key === 'night') {
            store.setNight(!theme.night);
            setOpen(false);
        } else if (item.key === 'backup') {
            setOpen(false);
            nav.push({ name: 'backup' });
        } else if (item.key === 'settings') {
            setOpen(false);
            nav.push({ name: 'settings' });
        } else if (item.key === 'about') {
            setOpen(false);
            nav.push({ name: 'about' });
        }
    };

    const renderItem = (item: DrawerItem) => {
        const active = item.kind === 'content' && item.key === content;
        return (
            <view
                key={item.key}
                bindtap={() => onItem(item)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: '48px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    backgroundColor: active
                        ? 'rgba(33,150,243,0.08)'
                        : 'transparent',
                }}
            >
                <text style={{ fontSize: '18px', width: '32px' }}>
                    {item.icon}
                </text>
                <text
                    style={{
                        fontSize: '15px',
                        color: active ? theme.theme.primary : '#212121',
                        fontWeight: active ? '600' : '400',
                        marginLeft: '8px',
                    }}
                >
                    {item.label}
                </text>
            </view>
        );
    };

    const contentEl =
        content === 'library' ? (
            <LibraryScreen nav={nav} onOpenDrawer={() => setOpen(true)} />
        ) : (
            <SourcesScreen nav={nav} />
        );

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
            {contentEl}
            <SheetRoot
                show={open}
                onShowChange={setOpen}
                side="left"
                screenWidth={screenWidth}
            >
                {/* 关闭时 backdrop 不可挂载：opacity:0 的遮罩仍会拦截全部点击 */}
                {open ? <SheetBackdrop /> : null}
                <SheetContent
                    style={{
                        width: '280px',
                        backgroundColor: '#fff',
                        height: '100%',
                    }}
                >
                    <DrawerHeader />
                    <view>
                        {CONTENT_ITEMS.map(renderItem)}
                        <view
                            style={{
                                height: '1px',
                                backgroundColor: '#eee',
                                marginTop: '8px',
                                marginBottom: '8px',
                            }}
                        />
                        {SYSTEM_ITEMS.map(renderItem)}
                    </view>
                </SheetContent>
            </SheetRoot>
        </view>
    );
}
