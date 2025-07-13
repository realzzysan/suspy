import { defineEvent } from "@/discord/lib/utils/define";
import logger from "@/shared/lib/utils/logger";
import { client } from "@/discord/index";
import { registerGuildCommands } from "../lib/handlers/imports";
import emojis from "@/shared/lib/constant/emojis";

export default defineEvent({
    name: "guildCreate",
    once: false,
    execute: async (guild) => {
        logger.info(`Joined a new guild: ${guild.name} (ID: ${guild.id})`);
        
        // Register guild commands if the client is ready
        const guildCommands = client.slashCommands.filter(cmd => cmd.guildOnly).map(cmd => cmd.command.toJSON());
        await registerGuildCommands(guildCommands, [guild.id]);

        const channel = guild.safetyAlertsChannel || guild.publicUpdatesChannel
        if (channel) {
            try {
                // get command id for /setup from api
                let cmds = await guild.commands.fetch().catch(() => null);
                const setupCommand = cmds?.find(cmd => cmd.name === 'setup' && cmd.applicationId === client.user!.id);

                await channel.send(`## ${emojis.success.discord} \u200b Thanks for adding Suspy!\n\nTo get started, please run the ${setupCommand ? `</setup:${setupCommand.id}>` : '`/setup`'} command to configure the bot for your server.`);
            } catch {}
        }

    }
});