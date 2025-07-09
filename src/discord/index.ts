import logger from "@/shared/lib/utils/logger";

export const run = async () => {

    // Make sure it has bot token set
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.length === 0) {
        logger.error("Please set discord bot token first in env before running this script.");
        process.exit(1);
    }

    // Start the Discord bot
    logger.info("Starting Discord bot...");
}

// Detect if script runned directly
if (import.meta.path === Bun.main) await run();