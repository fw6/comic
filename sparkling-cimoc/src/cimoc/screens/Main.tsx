import {
    SheetBackdrop,
    SheetContent,
    SheetRoot,
    screenWidth,
} from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';
import { ComicCover } from '../components/ComicCard.js';
import { Screen } from '../components/Screen.js';
import type { Comic } from '../data/models.js';
import { loadComic } from '../data/service.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT_SERIF } from '../theme/index.js';
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
          key: 'mode' | 'backup' | 'settings' | 'about';
          label: string;
          icon: string;
      };

const CONTENT_ITEMS: DrawerItem[] = [
    { kind: 'content', key: 'library', label: '漫画', icon: '📚' },
    { kind: 'content', key: 'sources', label: '图源', icon: '🗂' },
];

const SYSTEM_ITEMS: DrawerItem[] = [
    { kind: 'action', key: 'mode', label: '切换模式', icon: '☾' },
    { kind: 'action', key: 'backup', label: '备份', icon: '💾' },
    { kind: 'action', key: 'settings', label: '设置', icon: '⚙' },
    { kind: 'action', key: 'about', label: '关于', icon: 'ℹ' },
];

function DrawerHeader() {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
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
                backgroundColor: t.surface,
                backgroundImage:
                    theme.mode === 'ink'
                        ? 'radial-gradient(circle at 85% 20%, rgba(229,57,53,0.14), transparent 55%)'
                        : 'radial-gradient(circle at 85% 20%, rgba(214,54,44,0.10), transparent 55%)',
                padding: '16px',
                justifyContent: 'flex-end',
                borderBottomWidth: '1px',
                borderBottomColor: t.hairline,
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
                            boxShadow:
                                theme.mode === 'ink'
                                    ? '0 4px 12px rgba(0,0,0,0.45)'
                                    : '0 2px 8px rgba(60,40,20,0.16)',
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
                            color: t.text,
                            fontSize: '16px',
                            marginTop: '10px',
                            fontWeight: '500',
                            ...FONT_SERIF,
                            letterSpacing: '0.5px',
                        }}
                    >
                        {recent.title}
                    </text>
                </>
            ) : (
                <view style={{ flexDirection: 'column' }}>
                    <text
                        style={{
                            color: t.text,
                            fontSize: '22px',
                            fontWeight: '600',
                            ...FONT_SERIF,
                            letterSpacing: '3px',
                        }}
                    >
                        Cimoc
                    </text>
                    <text
                        style={{
                            color: t.textSub,
                            fontSize: '12px',
                            marginTop: '4px',
                            letterSpacing: '4px',
                        }}
                    >
                        漫画书房
                    </text>
                </view>
            )}
            <view
                style={{
                    height: '3px',
                    width: '36px',
                    borderRadius: '2px',
                    backgroundColor: t.accent,
                    marginTop: '12px',
                }}
            />
        </view>
    );
}

export function MainScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState<'library' | 'sources'>('library');

    const onItem = (item: DrawerItem) => {
        if (item.kind === 'content') {
            setContent(item.key);
            setOpen(false);
        } else if (item.key === 'mode') {
            // 墨色 ↔ 纸面：切换真正的暗色/亮色主题（不再叠加黑色蒙层）
            store.setMode(theme.mode === 'ink' ? 'paper' : 'ink');
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

    const modeItemLabel =
        theme.mode === 'ink' ? '日间·纸面' : '夜间·墨色';

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
                    backgroundColor: active ? t.accentSoft : 'transparent',
                }}
            >
                {active ? (
                    <view
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: '10px',
                            bottom: '10px',
                            width: '3px',
                            borderRadius: '2px',
                            backgroundColor: t.accent,
                        }}
                    />
                ) : null}
                <text style={{ fontSize: '18px', width: '32px', opacity: 0.9 }}>
                    {item.key === 'mode'
                        ? theme.mode === 'ink'
                            ? '☾'
                            : '☀'
                        : item.icon}
                </text>
                <text
                    style={{
                        fontSize: '15px',
                        color: active ? t.accent : t.text,
                        fontWeight: active ? '600' : '400',
                        marginLeft: '8px',
                    }}
                >
                    {item.kind === 'action' && item.key === 'mode'
                        ? modeItemLabel
                        : item.label}
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
        <Screen theme={theme}>
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
                        backgroundColor: t.surfaceRaised,
                        height: '100%',
                    }}
                >
                    <DrawerHeader />
                    <view>
                        {CONTENT_ITEMS.map(renderItem)}
                        <view
                            style={{
                                height: '1px',
                                backgroundColor: t.hairline,
                                marginTop: '8px',
                                marginBottom: '8px',
                            }}
                        />
                        {SYSTEM_ITEMS.map(renderItem)}
                    </view>
                </SheetContent>
            </SheetRoot>
        </Screen>
    );
}
