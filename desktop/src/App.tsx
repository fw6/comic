import { useEffect, useState, type ReactElement } from "react";
import {
    HashRouter,
    Routes,
    Route,
    NavLink,
    useLocation,
    useNavigate,
} from "react-router-dom";
import Sources from "./screens/Sources";
import Detail from "./screens/Detail";
import Reader from "./screens/Reader";
import Library from "./screens/Library";
import Settings from "./screens/Settings";
import Downloads from "./screens/Downloads";
import { getSettings, hydrateWebtoonsCache, initSources } from "./lib/storage";
import { applyTheme } from "./lib/theme";
import { cimocVersion } from "./api";
import {
    LogoIcon,
    BookIcon,
    LibraryIcon,
    DownloadIcon,
    SettingsIcon,
    BackIcon,
} from "./components/icons";

interface NavEntry {
    to: string;
    label: string;
    icon: (props: { width?: number; height?: number }) => ReactElement;
    end: boolean;
}

const NAV: NavEntry[] = [
    { to: "/", label: "书源", icon: BookIcon, end: true },
    { to: "/library", label: "书架", icon: LibraryIcon, end: false },
    { to: "/downloads", label: "下载", icon: DownloadIcon, end: false },
    { to: "/settings", label: "设置", icon: SettingsIcon, end: false },
];

function pageTitle(location: { pathname: string }): string {
    if (location.pathname === "/") return "书源";
    if (location.pathname.startsWith("/library")) return "书架";
    if (location.pathname.startsWith("/downloads")) return "下载";
    if (location.pathname.startsWith("/settings")) return "设置";
    if (location.pathname.startsWith("/comic/")) return "详情";
    return "Cimoc";
}

/** 阅读器/本地阅读：全屏沉浸，不渲染任何导航 chrome。 */
function isImmersive(pathname: string): boolean {
    return pathname.startsWith("/reader") || pathname.startsWith("/local");
}

function Shell() {
    const location = useLocation();
    const navigate = useNavigate();
    const [version, setVersion] = useState("");

    useEffect(() => {
        cimocVersion()
            .then(setVersion)
            .catch(() => {});
    }, []);

    const immersive = isImmersive(location.pathname);
    const isRootTab = NAV.some((n) =>
        n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
    );

    return (
        <div className="shell">
            {/* 桌面侧边栏（移动端隐藏，底部 tab 替代） */}
            {!immersive && (
                <aside className="sidebar">
                    <div className="sidebar__brand">
                        <span className="brand-mark">
                            <LogoIcon width={18} height={18} />
                        </span>
                        <div>
                            <div className="brand-word">Cimoc</div>
                            <div className="brand-sub">漫画阅读</div>
                        </div>
                    </div>
                    <nav className="sidebar__nav">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.end}
                                className={({ isActive }) =>
                                    `nav-item ${isActive ? "nav-item--active" : ""}`
                                }
                            >
                                <n.icon />
                                {n.label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="sidebar__footer">
                        <div className="sidebar__meta">
                            Rust core <code>{version || "…"}</code>
                        </div>
                        <a
                            className="deerflow"
                            href="https://deerflow.tech"
                            target="_blank"
                            rel="noreferrer"
                        >
                            ✦ Created by Deerflow
                        </a>
                    </div>
                </aside>
            )}

            <div className="shell__main">
                {/* 移动端顶部栏（桌面隐藏；根 tab 不显示返回键） */}
                {!immersive && (
                    <header className="topbar">
                        {!isRootTab && (
                            <button
                                className="icon-btn"
                                onClick={() => navigate(-1)}
                                aria-label="返回"
                            >
                                <BackIcon />
                            </button>
                        )}
                        <div className="topbar__title">{pageTitle(location)}</div>
                    </header>
                )}

                <main
                    className={
                        immersive ? "shell__content shell__content--reader" : "shell__content"
                    }
                >
                    <Routes>
                        <Route path="/" element={<Sources />} />
                        <Route path="/comic/:source/:comicId" element={<Detail />} />
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
                </main>

                {/* 移动端底部 tab 栏 */}
                {!immersive && (
                    <nav className="tabbar">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.end}
                                className={({ isActive }) =>
                                    `tabbar__item ${isActive ? "tabbar__item--active" : ""}`
                                }
                            >
                                <n.icon />
                                {n.label}
                            </NavLink>
                        ))}
                    </nav>
                )}
            </div>
        </div>
    );
}

export default function App() {
    useEffect(() => {
        void getSettings().then((s) => applyTheme(s.darkMode));
        // 源脚本注册（#16/#17：首启种子 / dev 磁盘覆盖 → 同步 Rust registry）
        void initSources();
        // Webtoons series URL 缓存持久化回灌（grilling #6 存储域）
        void hydrateWebtoonsCache();
    }, []);

    return (
        <HashRouter>
            <Shell />
        </HashRouter>
    );
}
