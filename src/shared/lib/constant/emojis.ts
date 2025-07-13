export const emojis: Record<EmojiName, {
    discord: DiscordEmoji|string;
    telegram: string;
}> = {
    success: {
        discord: '<:success:1392477291841589248>',
        telegram: '✅'
    },
    warning: {
        discord: '<:warning:1392477360141631611>',
        telegram: '⚠️'
    },
    error: {
        discord: '<:error:1392477394329407558>',
        telegram: '❌'
    },
    info: {
        discord: '<:info:1392477421596446802>',
        telegram: 'ℹ️'
    },
    setup: {
        discord: '<:setup:1392477461077426347>',
        telegram: '⚙️'
    },
    previous: {
        discord: '<:prev:1394003871524978810>',
        telegram: '⬅️'
    },
    next: {
        discord: '<:next:1394003881545175162>',
        telegram: '➡️'
    }
};

export type EmojiName = 'success' | 'warning' | 'error' | 'info' | 'setup' | 'previous' | 'next';
export type DiscordEmoji = `<${"a" | ""}:${string}:${string}>`;
export default emojis;