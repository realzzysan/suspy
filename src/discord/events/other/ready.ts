import { defineEvent } from "@/discord/lib/utils/define";
import logger from "@/shared/lib/utils/logger";
import { ActivityType } from "discord.js";
import { getServerCount } from "@/discord/lib/actions/db";
import { client } from "@/discord";

export default defineEvent({
    name: "ready",
    once: false,
    execute: async (client) => {
        logger.info(`Connected to Discord as ${client.user?.tag}`);
        updatePresence();
    }
});

export const updatePresence = async () => {
    // Get guild count that registered
    const guildCount = await getServerCount(true);

    // Set client presence
    // Watching x servers
    client.user?.setPresence({
        activities: [{
            name: `${guildCount} servers`,
            type: ActivityType.Watching
        }],
        status: "online"
    });
}