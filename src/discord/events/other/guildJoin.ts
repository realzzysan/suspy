import { defineEvent } from "@/discord/lib/utils/define";
import logger from "@/shared/lib/utils/logger";

export default defineEvent({
    name: "guildCreate",
    once: false,
    execute: async (guild) => {
        logger.info(`Joined a new guild: ${guild.name} (ID: ${guild.id})`);
    }
});