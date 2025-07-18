import { defineCommand } from "@/discord/lib/utils/define";
import { ApplicationIntegrationType, SlashCommandBuilder } from "discord.js";
import { checkEmbed, errorEmbed, warningEmbed } from "@/discord/lib/utils/embeds";
import { checkURL } from "@/discord/lib/actions/db";
import { MessageFlags } from "discord.js";
import logger from "@/shared/lib/utils/logger";
import { AIError } from "@/shared/lib/ai";

export default defineCommand({
    command: new SlashCommandBuilder()
        .setName("check")
        .setDescription("Check if a link is safe or not.")
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addStringOption(option =>
            option.setName("url")
                .setDescription("The URL to check")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName("ephemeral")
                .setDescription("Whether to make the result only visible to you. (Default: true)")
                .setRequired(false)
        ),
    execute: async (interaction) => {

        // Validate the URL input
        const url = interaction.options.getString("url");
        if (!url || !/^https?:\/\/[^\s]+$/.test(url) ||
            /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/.*)?$/.test(url)) {
            return interaction.reply({
                components: [
                    warningEmbed("Invalid URL", "Please provide a valid URL to check.")
                ],
                flags: [
                    MessageFlags.IsComponentsV2,
                    MessageFlags.Ephemeral
                ]
            });
        }

        try {
            const urlObj = new URL(url);
            urlObj.pathname = urlObj.pathname.replace(/\/{2,}/g, '/'); // Normalize multiple slashes

            try {
                // defer the reply to give time for processing
                await interaction.deferReply({
                    flags: !(interaction.options.getBoolean("ephemeral") === false)
                        ? [MessageFlags.Ephemeral] : []
                });

                // Call the url check function with the server ID and URL
                const result = await checkURL(urlObj.toString());
                if (!result) throw new Error("No result found for the provided URL.");

                // If a flagged link is found, send the details
                return interaction.editReply({
                    components: checkEmbed({
                        id: result.id,
                        url: result.url,
                        category: result.category,
                        confidence_score: result.confidenceScore,
                        first_seen: result.createdAt!,
                        block_type: result.blockHost ? 'hostname' : 'url',
                        reason: result.reason,
                    }),
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (error) {

                if (error instanceof AIError) {
                    logger.warn("Error checking URL:", error);
                    return interaction.editReply({
                        components: [warningEmbed("URL check failed", error.options?.reason || "An error occurred while checking the URL.")],
                        flags: MessageFlags.IsComponentsV2
                    });
                }

                logger.error("Error checking URL:", error);
                return interaction.editReply({
                    components: errorEmbed(),
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
        } catch (error) {
            return interaction.reply({
                components: [
                    warningEmbed("Invalid URL", "Please provide a valid URL to check.")
                ],
                flags: [
                    MessageFlags.IsComponentsV2,
                    MessageFlags.Ephemeral
                ]
            });
        }
    }
});