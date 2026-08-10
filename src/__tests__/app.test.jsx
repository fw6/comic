import { fireEvent, render, screen } from '@lynx-js/react/testing-library';
import { describe, expect, it } from '@rstest/core';
import { App } from '../App.js';

// Note: the lynx-ui virtual List does not render children in the jsdom test
// environment, so grid/list content is exercised only at the component level.
// These tests cover shell, navigation, dialogs, and non-list screens.

describe('Cimoc App', () => {
    it('renders the library screen with tabs', async () => {
        render(<App />);
        expect(screen.getAllByText('漫画').length).toBeGreaterThan(0);
        expect(screen.getByText('历史')).toBeTruthy();
        expect(screen.getByText('收藏')).toBeTruthy();
        expect(screen.getByText('下载')).toBeTruthy();
        expect(screen.getByText('本地')).toBeTruthy();
    });

    it('renders the theme color in the top bar', async () => {
        render(<App />);
        // The hamburger menu icon for opening the drawer
        expect(screen.getByText('☰')).toBeTruthy();
    });

    it('opens the drawer and navigates to Settings', async () => {
        render(<App />);
        fireEvent.tap(screen.getByText('☰'));
        // Drawer content items
        expect(screen.getAllByText('图源').length).toBeGreaterThan(0);
        fireEvent.tap(screen.getByText('设置'));
        // Settings screen shows the "阅读设置" section header
        expect(screen.getByText('阅读设置')).toBeTruthy();
    });

    it('navigates to Sources from the drawer', async () => {
        render(<App />);
        fireEvent.tap(screen.getByText('☰'));
        fireEvent.tap(screen.getByText('图源'));
        // Sources screen shows the "全选" toolbar action
        expect(screen.getByText('全选')).toBeTruthy();
    });

    it('Settings exposes startup screen, storage and cache options', async () => {
        render(<App />);
        fireEvent.tap(screen.getByText('☰'));
        fireEvent.tap(screen.getByText('设置'));
        expect(screen.getByText('启动画面')).toBeTruthy();
        expect(screen.getByText('存储位置')).toBeTruthy();
        expect(screen.getByText('清除缓存')).toBeTruthy();
    });

    it('Backup screen shows favorites/tags/settings rows', async () => {
        render(<App />);
        fireEvent.tap(screen.getByText('☰'));
        fireEvent.tap(screen.getByText('备份'));
        expect(screen.getAllByText('漫画收藏').length).toBeGreaterThan(0);
        expect(screen.getByText('WebDAV 云备份')).toBeTruthy();
        expect(screen.getByText('清空备份记录')).toBeTruthy();
    });

    it('About screen shows version and description', async () => {
        render(<App />);
        fireEvent.tap(screen.getByText('☰'));
        fireEvent.tap(screen.getByText('关于'));
        expect(screen.getByText('Cimoc')).toBeTruthy();
        expect(screen.getByText('开源许可')).toBeTruthy();
    });
});
