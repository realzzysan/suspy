import { defineCommand } from "@/discord/lib/utils/define";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { setupEmbed, takeoverSetupEmbed, warningEmbed } from "@/discord/lib/utils/embeds";
import { MessageFlags } from "discord.js";
import { setupProcessCache } from "@/discord/events/interactions/setupHandler";
import db from "@/shared/db";
import { discordServerSettings } from "@/shared/db/schemas/discord";
import { eq } from "drizzle-orm";

export default defineCommand({
    command: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup Suspy for your server."),
    guildOnly: true,
    execute: async (interaction) => {
        
        if (!interaction.memberPermissions?.has("ManageGuild")) {
            return interaction.reply({
                components: [
                    warningEmbed("Permission Denied", "You dont have permission to use this command.")
                ],
                flags: [
                    MessageFlags.IsComponentsV2,
                    MessageFlags.Ephemeral
                ]
            });
        }

        // Check if the server is already in setup
        let setup = setupProcessCache.get(interaction.guild!.id);
        if (setup && setup.authorId !== interaction.user.id) {
            return interaction.reply({
                components: takeoverSetupEmbed(interaction.guild!),
                flags: [
                    MessageFlags.IsComponentsV2,
                    MessageFlags.Ephemeral
                ]
            });
        }

        if (!setup) {
            const result = await db.select()
                .from(discordServerSettings)
                .where(eq(discordServerSettings.serverId, interaction.guild!.id))

            if (result && result[0]) {

                // waiting TODO
                //if (result[0].setupDone) return await handleEditSetup(interaction, result[0]);

                // get step from the result
                const step = result[0].logChannel == null 
                    ? 2 : result[0].enableDm == null
                    ? 4 : result[0].minimumConfidenceScore == null
                    ? 3 : 5;

                setup = {
                    ...result[0],
                    step,
                    authorId: interaction.user.id,
                };
            } else {
                setup = {
                    serverId: interaction.guild!.id,
                    step: 1, // Welcome screen
                    authorId: interaction.user.id,
                };
            }

            setupProcessCache.set(interaction.guild!.id, setup);
        }

        setup.step = setup.step === 6 ? 5 : setup.step;

        // Send the message
        return interaction.reply({
            components: await setupEmbed(interaction.guild!, setup),
            flags: [MessageFlags.IsComponentsV2]
        });
    }
});

async function handleEditSetup(interaction: ChatInputCommandInteraction, data: typeof discordServerSettings.$inferSelect) {
    // TODO
    return interaction.reply({
        content: "Coming soon!",
        flags: [MessageFlags.Ephemeral]
    });   
}