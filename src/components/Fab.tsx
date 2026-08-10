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
                display: 'flex',
                flexDirection: 'column',
                position: 'absolute',
                right: '16px',
                bottom: '24px',
                width: '56px',
                height: '56px',
                borderRadius: '28px',
                backgroundColor: theme.theme.accent,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.35)',
            }}
        >
            <text style={{ color: '#fff', fontSize: '22px' }}>{label}</text>
        </view>
    );
}
