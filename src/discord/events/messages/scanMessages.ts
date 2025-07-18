import { defineEvent } from "@/discord/lib/utils/define";
import { checkURLForServer, getServerConfig, upsertServerBlocklist } from "@/discord/lib/actions/db";
import logger from "@/shared/lib/utils/logger";
import { dmReminderEmbed, serverNewLinkEmbed } from "../../lib/utils/embeds";
import { MessageFlags } from "discord.js";

export default defineEvent({
    name: "messageCreate",
    once: false,
    execute: async (message) => {
        if (message.author.bot || !message.guild) return;

        // Check if server is active
        const serverConfig = await getServerConfig(message.guild.id);
        if (!serverConfig || !serverConfig.enable) return;

        // Process the message and get each url
        const urls = message.content.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s,)\]}]+)/g);
        if (!urls) return;

        let messageDeleted = false;

        const processResult = async (result: Awaited<ReturnType<typeof checkURLForServer>>) => {
            if (!result || !message.guild) return;

            logger.info(`Flagged link found in message ${message.id} in server ${message.guild.id}: ${result.url}`);

            // Delete the message
            if (!messageDeleted) {
                message.delete()
                messageDeleted = true;
            }

            // Send dm to user if enabled
            if (serverConfig.enableDm) {
                try {
                    await message.author.send({
                        components: dmReminderEmbed(message),
                        flags: [MessageFlags.IsComponentsV2]
                    });
                } catch (error) {
                    logger.error(`Failed to send DM to user ${message.author.id} for flagged link:`, error);
                }
            }

            try {
                const blockResult = await upsertServerBlocklist(message.guild.id, {
                    flagId: result.id,
                    referenceUrl: undefined,
                });

                // Send a notification to the server log channel if configured
                if (serverConfig.logChannel) {
                    try {
                        let logChannel = message.guild.channels.cache.get(serverConfig.logChannel);
                        if (!logChannel) logChannel = await message.guild.channels.fetch(serverConfig.logChannel).catch(() => null) || undefined;

                        if (logChannel && logChannel.isTextBased()) {

                            let refUrl;
                            // validate reference URL if still exist the message
                            if (result.referenceUrl) {
                                const refMessage = await logChannel.messages.fetch(
                                    (result.referenceUrl
                                        .match(/channels\/\d+\/\d+\/(\d+)/)?.[1])!
                                ).catch(() => null);
                                refUrl = refMessage ? refMessage.url : undefined;
                            }

                            const msg = await logChannel.send({
                                components: serverNewLinkEmbed({
                                    id: result.id,
                                    url: result.url,
                                    category: result.category || 'malware',
                                    confidence_score: result.confidenceScore,
                                    first_seen: result.createdAt || new Date(),
                                    block_type: result.blockHost ? 'hostname' : 'url',
                                    reason: result.reason,
                                }, message, refUrl),
                                flags: [MessageFlags.IsComponentsV2]
                            });

                            // Add message url to reference url
                            if (!refUrl) {
                                await upsertServerBlocklist(message.guild.id, {
                                    flagId: result.id,
                                    referenceUrl: msg.url
                                });
                            }
                        }
                    } catch (error) {
                        logger.error(`Failed to send log message for flagged link in server ${message.guild.id}:`, error);
                    }
                }

            } catch (error) {
                logger.error(`Failed to upsert server blocklist for server ${message.guild.id}:`,
                    error
                );
            }
        };

        for (const url of urls) {
            checkURLForServer(message.guild.id, url)
                .then(processResult)
                .catch(e => logger.error(`Error checking URL ${url} in server ${message.guild!.id}:`, e));
        }
    }
});