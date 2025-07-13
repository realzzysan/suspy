import { defineEvent } from "@/discord/lib/utils/define";
import logger from "@/shared/lib/utils/logger";
import { errorEmbed } from "@/discord/lib/utils/embeds";
import { MessageFlags } from "discord.js";

export default defineEvent({
    name: "interactionCreate",
    once: false,
    execute: async (interaction) => {
        
        // check if interaction is a chatinputcommand
        if (interaction.isChatInputCommand()) {
            // Get the command module from the client
            const command = interaction.client.slashCommands.get(interaction.commandName);
            if (!command) {
                logger.warn(`Command ${interaction.commandName} not found.`);
                return;
            }

            // Execute the command
            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing command ${interaction.commandName}:`, error);
                const components = errorEmbed();

                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ components, flags: [
                        MessageFlags.IsComponentsV2
                    ] });
                } else {
                    await interaction.reply({ components, flags: [
                        MessageFlags.IsComponentsV2,
                        MessageFlags.Ephemeral
                    ] });
                }
            }
        };
    }
});