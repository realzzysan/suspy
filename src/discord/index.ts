import { Client, Collection, GatewayIntentBits } from "discord.js";
import { registerCommands, registerEvents } from "@/discord/lib/handlers/imports";
import logger from "@/shared/lib/utils/logger";
import type { CommandModule } from "@/discord/types";
import chalk from "chalk";

export let client: Client;

const listenProcessErrorEvents = ["uncaughtException", "unhandledRejection"] as const;
const handleError = (name: typeof listenProcessErrorEvents[number], error: Error) => {
    logger.error(chalk.yellow(`[${name}]`), error);
}

export const run = async () => {

    // Make sure it has bot token set
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.length === 0) {
        logger.error("Please set discord bot token first in env before running this script.");
        process.exit(1);
    }

    // Start the Discord bot
    logger.info("Initializing Discord bot...");

    try {

        // Initialize the Discord client
        client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ],
        });
        client.slashCommands = new Collection<string, CommandModule>();

        // Registering all commands and events
        await registerCommands();
        await registerEvents();

        // register anti-crash handlers
        listenProcessErrorEvents.forEach(event => {
            process.on(event, (error) => handleError(event, error as Error));
        });

        // Initialize bot
        logger.info("Starting Discord bot...");
        await client.login(process.env.DISCORD_TOKEN);

    } catch (err) {
        logger.error("Failed to start Discord bot:", err);
        process.exit(1);
    }
}

if (import.meta.path === Bun.main) await run();