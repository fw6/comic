import { useEffect, type CSSProperties } from "react";
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
import { getSettings, hydrateWebtoonsCache } from "./lib/storage";
import { applyTheme } from "./lib/theme";

function TopBar() {
    const location = useLocation();
    const navigate = useNavigate();
    // 阅读器全屏沉浸：不显示顶栏
    if (location.pathname.startsWith("/reader")) return null;
    const linkStyle = (active: boolean): CSSProperties => ({
        textDecoration: "none",
        color: active ? "var(--fg)" : "var(--muted)",
        fontWeight: active ? 600 : 400,
    });
    return (
        <nav
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bar-bg)",
            }}
        >
            <button onClick={() => navigate(-1)} aria-label="返回">
                ←
            </button>
            <button onClick={() => navigate(1)} aria-label="前进">
                →
            </button>
            <strong style={{ marginRight: 8 }}>Cimoc</strong>
            <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>
                书源
            </NavLink>
            <NavLink to="/library" style={({ isActive }) => linkStyle(isActive)}>
                书架
            </NavLink>
            <NavLink to="/settings" style={({ isActive }) => linkStyle(isActive)}>
                设置
            </NavLink>
        </nav>
    );
}

export default function App() {
    useEffect(() => {
        void getSettings().then((s) => applyTheme(s.darkMode));
        // Webtoons series URL 缓存持久化回灌（grilling #6 存储域）
        void hydrateWebtoonsCache();
    }, []);

    return (
        <HashRouter>
            <TopBar />
            <main>
                <Routes>
                    <Route path="/" element={<Sources />} />
                    <Route path="/comic/:source/:comicId" element={<Detail />} />
                    <Route
                        path="/reader/:source/:comicId/:chapterIndex"
                        element={<Reader />}
                    />
                    <Route path="/library" element={<Library />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </main>
        </HashRouter>
    );
}
