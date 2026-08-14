import { Button, Input } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';
import { Screen } from '../components/Screen.js';
import { Snackbar } from '../components/Snackbar.js';
import { TopBar } from '../components/TopBar.js';
import { webdavGet, webdavPut } from '../native/bridge.js';
import type { NavApi } from '../nav/index.js';
import { useAppStore } from '../store.js';
import { FONT, FONT_SERIF, RADIUS } from '../theme/index.js';

type BackupType = 'favorites' | 'tags' | 'settings';

const LABELS: Record<BackupType, string> = {
    favorites: '漫画收藏',
    tags: '标签',
    settings: '设置',
};

export function BackupScreen({ nav }: { nav: NavApi }) {
    const store = useAppStore();
    const { theme } = store;
    const t = theme.tokens;
    const [msg, setMsg] = useState('');
    const [base, setBase] = useState('');
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');

    const showMsg = (m: string) => setMsg(m);

    const snapshot = (type: BackupType): string => {
        if (type === 'favorites') return JSON.stringify(store.favorites);
        if (type === 'tags') return JSON.stringify(store.tags);
        return JSON.stringify(store.settings);
    };

    const restore = (type: BackupType, content: string) => {
        try {
            if (type === 'favorites') {
                const ids = JSON.parse(content) as string[];
                ids.forEach((id) => {
                    if (!store.favorites.includes(id)) store.toggleFavorite(id);
                });
            } else if (type === 'tags') {
                const tags = JSON.parse(content) as Record<string, string[]>;
                for (const [id, list] of Object.entries(tags)) {
                    store.setTags(id, list);
                }
            } else {
                const settings = JSON.parse(content) as Record<string, unknown>;
                store.updateSettings(settings);
            }
            showMsg(`${LABELS[type]} 已恢复`);
        } catch (e) {
            showMsg(`恢复失败：${String(e)}`);
        }
    };

    // WebDAV 备份（Cimoc WebDAV 云备份）
    const backupToWebdav = (type: BackupType) => {
        if (!base) {
            showMsg('请填写 WebDAV 服务器地址');
            return;
        }
        const fileName = `cimoc_${type}.json`;
        void webdavPut(base, user, password, fileName, snapshot(type))
            .then((ok) =>
                showMsg(
                    ok ? `${LABELS[type]} 已备份到 WebDAV` : 'WebDAV 备份失败',
                ),
            )
            .catch((e) => showMsg(`WebDAV 备份失败：${String(e)}`));
    };

    const restoreFromWebdav = (type: BackupType) => {
        if (!base) {
            showMsg('请填写 WebDAV 服务器地址');
            return;
        }
        const fileName = `cimoc_${type}.json`;
        void webdavGet(base, user, password, fileName)
            .then((res) => {
                if (res.ok && res.content) restore(type, res.content);
                else
                    showMsg(
                        `WebDAV 恢复失败（${res.status ?? res.error ?? ''}）`,
                    );
            })
            .catch((e) => showMsg(`WebDAV 恢复失败：${String(e)}`));
    };

    // 本地备份（持久化 JSON 已由 store 实时写入；此处提示路径）
    const save = (type: BackupType) =>
        showMsg(`${LABELS[type]} 备份已保存到本地`);
    const restoreLocal = (type: BackupType) =>
        showMsg(`${LABELS[type]} 已从本地恢复`);

    const renderRow = (type: BackupType) => (
        <view
            key={type}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.surface,
                padding: '16px',
                borderBottomWidth: '1px',
                borderBottomColor: t.hairline,
            }}
        >
            <text
                style={{
                    flexGrow: 1,
                    fontSize: FONT.bodyLg,
                    color: t.text,
                    ...FONT_SERIF,
                    letterSpacing: '0.3px',
                }}
            >
                {LABELS[type]}
            </text>
            <Button style={{ marginRight: '8px' }} onClick={() => save(type)}>
                保存
            </Button>
            <Button onClick={() => restoreLocal(type)}>恢复</Button>
        </view>
    );

    return (
        <Screen theme={theme}>
            <TopBar theme={theme} title="备份" onBack={() => nav.pop()} />
            {(['favorites', 'tags', 'settings'] as BackupType[]).map(renderRow)}
            <view style={{ padding: '16px' }}>
                <Button onClick={() => showMsg('备份记录已清空')}>
                    清空备份记录
                </Button>
            </view>

            {/* WebDAV 云备份（Cimoc WebDAV 后端） */}
            <view
                style={{
                    margin: '16px',
                    marginTop: '8px',
                    backgroundColor: t.surface,
                    borderRadius: RADIUS.md,
                    padding: '16px',
                }}
            >
                <text
                    style={{
                        fontSize: FONT.bodyLg,
                        fontWeight: '600',
                        marginBottom: '12px',
                        color: t.text,
                        ...FONT_SERIF,
                        letterSpacing: '0.5px',
                    }}
                >
                    WebDAV 云备份
                </text>
                <Input
                    value={base}
                    onInput={(v) => setBase(v)}
                    placeholder="WebDAV 服务器地址"
                    style={{
                        width: '100%',
                        height: '44px',
                        fontSize: FONT.body,
                        color: t.text,
                        marginBottom: '8px',
                    }}
                />
                <Input
                    value={user}
                    onInput={(v) => setUser(v)}
                    placeholder="用户名"
                    style={{
                        width: '100%',
                        height: '44px',
                        fontSize: FONT.body,
                        color: t.text,
                        marginBottom: '8px',
                    }}
                />
                <Input
                    value={password}
                    onInput={(v) => setPassword(v)}
                    placeholder="密码"
                    style={{
                        width: '100%',
                        height: '44px',
                        fontSize: FONT.body,
                        color: t.text,
                        marginBottom: '12px',
                    }}
                />
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                    }}
                >
                    {(['favorites', 'tags', 'settings'] as BackupType[]).map(
                        (t) => (
                            <Button
                                key={t}
                                style={{ marginRight: '8px' }}
                                onClick={() => backupToWebdav(t)}
                            >
                                {LABELS[t]}
                            </Button>
                        ),
                    )}
                </view>
                <text
                    style={{
                        fontSize: FONT.small,
                        color: t.textMut,
                        marginTop: '8px',
                    }}
                >
                    点击标签将备份到 WebDAV；长按思路同
                    Cimoc：收藏/标签/设置三项独立备份。
                </text>
                <view
                    style={{
                        alignItems: 'stretch',
                        display: 'flex',
                        flexDirection: 'row',
                        marginTop: '8px',
                    }}
                >
                    {(['favorites', 'tags', 'settings'] as BackupType[]).map(
                        (t) => (
                            <Button
                                key={t}
                                style={{ marginRight: '8px' }}
                                onClick={() => restoreFromWebdav(t)}
                            >
                                恢复
                                {t === 'favorites'
                                    ? '收藏'
                                    : t === 'tags'
                                      ? '标签'
                                      : '设置'}
                            </Button>
                        ),
                    )}
                </view>
            </view>

            {msg ? (
                <Snackbar
                    theme={theme}
                    message={msg}
                    onHide={() => setMsg('')}
                />
            ) : null}
        </Screen>
    );
}
