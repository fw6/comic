import { useNavigate } from "react-router-dom";
import { Compass, Moon, Sun } from "lucide-react";
import { NAV } from "../lib/nav";
import { SOURCES } from "../lib/sources";
import { useTheme } from "../lib/theme";
import { CommandPalette, type CommandItem } from "./beui/command-palette";

/** ⌘K 命令面板：页面跳转、书源直达、主题切换。 */
export function CommandMenu({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const navigate = useNavigate();
    const { isDark, setDark } = useTheme();

    const items: CommandItem[] = [
        ...NAV.map((entry) => ({
            id: `nav-${entry.to}`,
            label: entry.label,
            group: "页面",
            icon: entry.icon,
            keywords: ["跳转", "页面", entry.to],
            onSelect: () => navigate(entry.to),
        })),
        ...SOURCES.map((source) => ({
            id: `source-${source.id}`,
            label: `书源：${source.title}`,
            group: "书源",
            icon: Compass,
            keywords: [source.id, "漫画源"],
            onSelect: () => navigate(`/?source=${source.id}`),
        })),
        {
            id: "theme",
            label: isDark ? "切换到浅色主题" : "切换到深色主题",
            group: "外观",
            icon: isDark ? Sun : Moon,
            keywords: ["主题", "夜间", "dark", "light"],
            onSelect: () => setDark(!isDark),
        },
    ];

    return (
        <CommandPalette
            items={items}
            open={open}
            onOpenChange={onOpenChange}
            placeholder="搜索页面、书源或命令…"
            emptyMessage="没有匹配的结果"
        />
    );
}
