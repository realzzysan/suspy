import createLogger from "@/shared/lib/utils/logger";
const logger = createLogger('telegram');

export const run = async () => {
    // Make sure it has bot token set
    if (!process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN.length === 0) {
        logger.error("Please set telegram bot token first in env before running this script.");
        process.exit(1);
    }

    // Start the Telegram bot
    logger.info("Starting Telegram bot...");
}

// Detect if script runned directly
if (import.meta.path === Bun.main) await run();