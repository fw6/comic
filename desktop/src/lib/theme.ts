/** 夜间模式：html[data-theme] 驱动 index.css 的 CSS 变量。 */
export function applyTheme(dark: boolean): void {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
}
