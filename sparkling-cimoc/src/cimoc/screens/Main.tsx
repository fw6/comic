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
import { shadow, FONT, FONT_SERIF, RADIUS } from '../theme/index.js';
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
                alignItems: 'center',
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
                                shadow(theme.mode, 'cover'),
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
                            fontSize: FONT.bodyLg,
                            marginTop: '10px',
                            fontWeight: '500',
                            ...FONT_SERIF,
                            letterSpacing: '0.5px',
                            textAlign: 'center',
                        }}
                        text-maxline={'1'}
                    >
                        {recent.title}
                    </text>
                </>
            ) : (
                <view
                    style={{
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <text
                        style={{
                            color: t.text,
                            fontSize: FONT.icon,
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
                            fontSize: FONT.small,
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
                    height: '56px',
                    marginLeft: '16px',
                    marginRight: '16px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    borderRadius: RADIUS.md,
                    backgroundColor: active ? t.accentSoft : 'transparent',
                }}
            >
                {active ? (
                    <view
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: '12px',
                            bottom: '12px',
                            width: '3px',
                            borderRadius: '2px',
                            backgroundColor: t.accent,
                        }}
                    />
                ) : null}
                <text
                    style={{
                        fontSize: FONT.titleLg,
                        width: '32px',
                        textAlign: 'center',
                        opacity: 0.9,
                    }}
                >
                    {item.key === 'mode'
                        ? theme.mode === 'ink'
                            ? '☾'
                            : '☀'
                        : item.icon}
                </text>
                <text
                    style={{
                        fontSize: FONT.bodyLg,
                        color: active ? t.accent : t.text,
                        fontWeight: active ? '600' : '400',
                        marginLeft: '12px',
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
                {/* 关闭即卸载：opacity:0 的遮罩与残留 surface 层都会拦截全部点击 */}
                {open ? <SheetBackdrop /> : null}
                {open ? (
                    <SheetContent
                        // 视觉样式挂 surface 层；抽屉宽度必须放 innerStyle，
                        // 否则覆盖掉 wrapper 的 150vw 定位，'fit' 无法按实测宽度解析
                        style={{ backgroundColor: t.surfaceRaised }}
                        innerStyle={{ width: '280px', height: '100%' }}
                    >
                        <DrawerHeader />
                        <view style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                            {CONTENT_ITEMS.map(renderItem)}
                            <view
                                style={{
                                    height: '1px',
                                    backgroundColor: t.hairline,
                                    marginTop: '12px',
                                    marginBottom: '12px',
                                    marginLeft: '16px',
                                    marginRight: '16px',
                                }}
                            />
                            {SYSTEM_ITEMS.map(renderItem)}
                        </view>
                    </SheetContent>
                ) : null}
            </SheetRoot>
        </Screen>
    );
}
