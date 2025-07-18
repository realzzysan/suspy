import { defineCommand } from "@/discord/lib/utils/define";
import { ApplicationCommand, ApplicationIntegrationType, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Collection } from "@discordjs/collection";
import { errorEmbed, helpEmbed } from "@/discord/lib/utils/embeds";

export default defineCommand({
    command: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Get help with Suspy commands.")
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]),
    execute: async (interaction) => {
        
        let commands: Collection<string, ApplicationCommand> = await interaction.client.application.commands.fetch();
        if (interaction.guild) {
            const cmds = await interaction.guild.commands.fetch();
            // add guild commands to the collection
            cmds.forEach(cmd => commands.set(cmd.name, cmd));
        }

        // if commands is empty, throw error
        if (commands.size === 0) {
            return interaction.reply({
                components: errorEmbed("Commands is currently not available. Did you magically call this command?"),
                flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            });
        }

        return interaction.reply({
            components: helpEmbed(Boolean(interaction.guild), commands.map(cmd => cmd)),
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
        });
    }
});