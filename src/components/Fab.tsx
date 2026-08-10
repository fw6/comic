import type { AppTheme } from '../theme/index.js';

export function Fab({
    theme,
    onTap,
    label,
}: {
    theme: AppTheme;
    onTap: () => void;
    label: string;
}) {
    return (
        <view
            bindtap={onTap}
            style={{
                position: 'absolute',
                right: '16px',
                bottom: '24px',
                width: 56,
                height: 56,
                borderRadius: '28px',
                backgroundColor: theme.theme.accent,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.35)',
            }}
        >
            <text style={{ color: '#fff', fontSize: 22 }}>{label}</text>
        </view>
    );
}
