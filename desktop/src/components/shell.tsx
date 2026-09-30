import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, BookMarked, PanelLeft, Search } from "lucide-react";
import { cimocVersion } from "../api";
import { cn } from "../lib/utils";
import { SPRING_LAYOUT } from "../lib/ease";
import { ScrollContainerContext } from "../lib/scroll-container";
import { NAV, type NavEntry } from "../lib/nav";
import { ThemeToggle } from "./beui/theme-toggle";
import { Button } from "./beui/button";
import {
    AnimatedSidebar,
    AnimatedSidebarContent,
    AnimatedSidebarFooter,
    AnimatedSidebarHeader,
    AnimatedSidebarInset,
    AnimatedSidebarMenu,
    AnimatedSidebarMenuButton,
    AnimatedSidebarMenuItem,
    AnimatedSidebarProvider,
    AnimatedSidebarTrigger,
    useAnimatedSidebar,
} from "./beui/animated-sidebar";
import { CommandMenu } from "./command-menu";

/** 阅读器/本地阅读：全屏沉浸，不渲染任何导航。 */
function isImmersive(pathname: string): boolean {
    return pathname.startsWith("/reader") || pathname.startsWith("/local");
}

function pageTitle(pathname: string): string {
    if (pathname === "/") return "书源";
    if (pathname.startsWith("/library")) return "书架";
    if (pathname.startsWith("/downloads")) return "下载";
    if (pathname.startsWith("/settings")) return "设置";
    if (pathname.startsWith("/comic/")) return "详情";
    return "Cimoc";
}

function isActivePath(pathname: string, entry: NavEntry): boolean {
    return entry.end ? pathname === entry.to : pathname.startsWith(entry.to);
}

export function AppShell({ children }: { children: ReactNode }) {
    const location = useLocation();
    const [version, setVersion] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        void cimocVersion()
            .then(setVersion)
            .catch(() => {});
    }, []);

    const immersive = isImmersive(location.pathname);
    const isRootTab = NAV.some((n) => isActivePath(location.pathname, n));

    if (immersive) {
        return (
            <div className="flex h-full flex-col">
                <ScrollContainerContext.Provider value={mainRef}>
                    <main ref={mainRef} className="flex min-h-0 flex-1 overflow-hidden">
                        {children}
                    </main>
                </ScrollContainerContext.Provider>
            </div>
        );
    }

    return (
        <AnimatedSidebarProvider className="h-full">
            <AnimatedSidebar ariaLabel="主导航">
                <SidebarContent
                    version={version}
                    pathname={location.pathname}
                    onOpenMenu={() => setMenuOpen(true)}
                />
            </AnimatedSidebar>

            <AnimatedSidebarInset className="h-full min-h-0">
                <TopBar
                    title={pageTitle(location.pathname)}
                    showBack={!isRootTab}
                    onOpenMenu={() => setMenuOpen(true)}
                />

                <ScrollContainerContext.Provider value={mainRef}>
                    <main
                        ref={mainRef}
                        className="min-h-0 flex-1 overflow-y-auto"
                    >
                        {children}
                    </main>
                </ScrollContainerContext.Provider>

                <MobileTabBar />
            </AnimatedSidebarInset>

            <CommandMenu open={menuOpen} onOpenChange={setMenuOpen} />
        </AnimatedSidebarProvider>
    );
}

/* ---------- 桌面侧边栏 ---------- */

function SidebarContent({
    version,
    pathname,
    onOpenMenu,
}: {
    version: string;
    pathname: string;
    onOpenMenu: () => void;
}) {
    const { open } = useAnimatedSidebar();
    return (
        <>
            <AnimatedSidebarHeader className="flex-row items-center gap-2 p-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <BookMarked className="size-4.5" />
                </span>
                <div
                    className={cn(
                        "min-w-0 flex-1 overflow-hidden transition-opacity duration-200",
                        open ? "opacity-100" : "opacity-0",
                    )}
                >
                    <div className="truncate text-sm font-semibold leading-tight">
                        Cimoc
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                        漫画阅读器
                    </div>
                </div>
                <AnimatedSidebarTrigger
                    aria-label="收起/展开侧边栏"
                    className="ml-auto text-muted-foreground hover:text-foreground"
                >
                    <PanelLeft className="size-4" />
                </AnimatedSidebarTrigger>
            </AnimatedSidebarHeader>

            <AnimatedSidebarContent>
                <AnimatedSidebarMenu>
                    {NAV.map((entry) => (
                        <AnimatedSidebarMenuItem key={entry.to}>
                            <AnimatedSidebarMenuButton
                                icon={<entry.icon />}
                                href={`#${entry.to}`}
                                isActive={isActivePath(pathname, entry)}
                            >
                                {entry.label}
                            </AnimatedSidebarMenuButton>
                        </AnimatedSidebarMenuItem>
                    ))}
                </AnimatedSidebarMenu>
            </AnimatedSidebarContent>

            <AnimatedSidebarFooter>
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className={cn(
                        "flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground",
                        open ? "justify-between" : "justify-center",
                    )}
                >
                    <Search className="size-3.5 shrink-0" />
                    {open && (
                        <Fragment>
                            <span className="flex-1 text-left">搜索与命令</span>
                            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                                ⌘K
                            </kbd>
                        </Fragment>
                    )}
                </button>

                <div
                    className={cn(
                        "flex items-center gap-2",
                        open ? "justify-between" : "justify-center",
                    )}
                >
                    {open && (
                        <span className="truncate text-[11px] text-muted-foreground">
                            Rust core{" "}
                            <code className="font-mono">{version || "…"}</code>
                        </span>
                    )}
                    <ThemeToggle
                        variant="circle"
                        start="center"
                        className="size-8 rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                        iconClassName="size-4"
                        aria-label="切换主题"
                    />
                </div>
            </AnimatedSidebarFooter>
        </>
    );
}

/* ---------- 移动端顶部栏 ---------- */

function TopBar({
    title,
    showBack,
    onOpenMenu,
}: {
    title: string;
    showBack: boolean;
    onOpenMenu: () => void;
}) {
    const navigate = useNavigate();
    return (
        <header
            className="flex items-center gap-1.5 border-b border-border bg-background px-2 md:hidden"
            style={{
                paddingTop: "max(0.375rem, env(safe-area-inset-top))",
                paddingBottom: "0.375rem",
            }}
        >
            {showBack && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="返回"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="size-4" />
                </Button>
            )}
            <div className="min-w-0 flex-1 truncate px-1 text-sm font-medium">
                {title}
            </div>
            <Button
                variant="ghost"
                size="icon"
                aria-label="搜索与命令"
                onClick={onOpenMenu}
            >
                <Search className="size-4" />
            </Button>
            <ThemeToggle
                variant="circle-blur"
                start="center"
                className="size-8 rounded-lg text-muted-foreground"
                iconClassName="size-4"
                aria-label="切换主题"
            />
        </header>
    );
}

/* ---------- 移动端底部导航 ---------- */

function MobileTabBar() {
    return (
        <nav
            className="flex items-stretch justify-around border-t border-border bg-background px-1 md:hidden"
            style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
        >
            {NAV.map((entry) => (
                <MobileTabItem key={entry.to} entry={entry} />
            ))}
        </nav>
    );
}

function MobileTabItem({ entry }: { entry: NavEntry }) {
    const Icon = entry.icon;
    return (
        <NavLink
            to={entry.to}
            end={entry.end}
            className="relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 pb-1 pt-2.5 text-[11px] text-muted-foreground"
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.span
                            layoutId="tabbar-active"
                            transition={SPRING_LAYOUT}
                            className="absolute inset-x-1 inset-y-0.5 rounded-xl bg-secondary"
                        />
                    )}
                    <Icon
                        className={cn(
                            "relative z-10 size-5",
                            isActive && "text-primary",
                        )}
                    />
                    <span
                        className={cn(
                            "relative z-10",
                            isActive && "font-medium text-foreground",
                        )}
                    >
                        {entry.label}
                    </span>
                </>
            )}
        </NavLink>
    );
}
