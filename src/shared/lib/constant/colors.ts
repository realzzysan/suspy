const defaultColor = 0xFF6A4C; // #FF6A4C
const successColor = 0x24C361; // #24C361

export const colors: Record<ColorName, number> = {
    success: successColor,
    warning: defaultColor,
    error: defaultColor,
    info: defaultColor,
    setup: defaultColor,
} as const;

export type ColorName = 'success' | 'warning' | 'error' | 'info' | 'setup';
export default colors;