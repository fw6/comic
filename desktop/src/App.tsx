import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import Sources from "./screens/Sources";
import Detail from "./screens/Detail";
import Reader from "./screens/Reader";
import Library from "./screens/Library";
import Settings from "./screens/Settings";
import Downloads from "./screens/Downloads";
import { hydrateWebtoonsCache, initSources } from "./lib/storage";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./components/toast";
import { AppShell } from "./components/shell";

export default function App() {
    useEffect(() => {
        // 源脚本注册（#16/#17：首启种子 / dev 磁盘覆盖 → 同步 Rust registry）
        void initSources();
        // Webtoons series URL 缓存持久化回灌（grilling #6 存储域）
        void hydrateWebtoonsCache();
    }, []);

    return (
        <ThemeProvider>
            <HashRouter>
                <ToastProvider>
                    <AppShell>
                        <Routes>
                            <Route path="/" element={<Sources />} />
                            <Route
                                path="/comic/:source/:comicId"
                                element={<Detail />}
                            />
                            <Route
                                path="/reader/:source/:comicId/:chapterIndex"
                                element={<Reader />}
                            />
                            <Route
                                path="/local/:source/:comicId/:chapterIndex"
                                element={<Reader local />}
                            />
                            <Route path="/library" element={<Library />} />
                            <Route path="/downloads" element={<Downloads />} />
                            <Route path="/settings" element={<Settings />} />
                        </Routes>
                    </AppShell>
                </ToastProvider>
            </HashRouter>
        </ThemeProvider>
    );
}
