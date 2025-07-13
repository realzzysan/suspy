import { getServerBlocklists, getServerConfig, upsertServerBlocklist } from "@/discord/lib/actions/db";
import { defineEvent } from "@/discord/lib/utils/define";
import { errorEmbed, randomId, serverActionConfirmedEmbed, serverActionEmbed, warningEmbed } from "@/discord/lib/utils/embeds";
import logger from "@/shared/lib/utils/logger";
import { MessageFlags } from "discord.js";
import { LRUCache } from "lru-cache";
import type { ScanResultExtended } from "@/shared/types/result";
import { addURLToAutomod } from "@/discord/lib/actions/automod";

export const actionCache = new LRUCache<string, Required<ScanResultExtended>>({
    max: 50,
    ttl: 1000 * 30, // 30 seconds
});

export default defineEvent({
    name: "interactionCreate",
    once: false,
    execute: async (interaction) => {
        if (!interaction.isButton()) return;
        try {

            
            // match regex for interaction action key response
            // 2:<server id>:<data id>:<id>:(1-3):(1-2):<random string>
            const match = interaction.customId.match(/^2:(\d+):(\d+):([a-zA-Z0-9_-]+):([1-3]):([1-2]):([a-zA-Z0-9_-]+)$/);
            if (match) {

                // process confirmation
                const { 1: guildId, 2: dataId, 3: blockId, 4: actionId, 5: confirmation, 6: randomId } = match;
                if (!guildId || !dataId || !blockId || !actionId || !confirmation || !randomId || guildId !== interaction.guild?.id) {
                    return interaction.update({
                        components: [warningEmbed("Error occurred", "Invalid action data. Please try again.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                const actionData = actionCache.get(`${guildId}:${dataId}:${blockId}`);
                if (!actionData) {
                    return interaction.update({
                        components: [warningEmbed("Error occurred", "The action has expired. Please try again.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                // if (confirmation == "2") {
                //     // Delete the interaction message
                //     try {
                //         await interaction.message.delete();
                //     } catch (error) {
                //         logger.error(`Failed to delete interaction message:,`, error);
                //     }
                //     return;
                // }

                // Update blocklist
                upsertServerBlocklist(interaction.guild!.id, {
                    flagId: actionData.id,
                    status: actionId === "3" ? "ignored" : "resolved",
                });

                if (actionId !== "3") {
                    const serverConfig = await getServerConfig(interaction.guild!.id);
                    await addURLToAutomod(
                        interaction.guild!,
                        actionData.url,
                        actionId === "2",
                        serverConfig?.logChannel || undefined
                    );
                }

                await interaction.update({
                    components: serverActionConfirmedEmbed(),
                    flags: [MessageFlags.IsComponentsV2]
                });
            }

            // match regex for interaction action key
            // 2:<server id>:<data id>:(1-3):<random string>
            const match2 = interaction.customId.match(/^2:(\d+):(\d+):([1-3]):([a-zA-Z0-9]+)$/);
            if (match2) {
                const { 1: guildId, 2: dataId, 3: actionId } = match2;
                if (!guildId || !dataId || !actionId || guildId !== interaction.guild?.id) {
                    return interaction.reply({
                        components: [warningEmbed("Error occurred", "Invalid action data. Please try again.")],
                        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
                    });
                }

                const action: ScanResultExtended['block_type'] = actionId === "1"
                    ? "url" : actionId === "2" ? "hostname" : null;

                // get blocklist
                const blocklists = await getServerBlocklists(interaction.guild!.id);
                const blocklist = blocklists?.find(block => block.discord_server_blocklist?.id === parseInt(dataId));
                const scanResult = blocklist?.flagged_links;

                if (!blocklist || !scanResult) {
                    return interaction.reply({
                        components: [warningEmbed("Error occurred", "The link is not found in the blocklist.")],
                        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
                    });
                }

                // Add to action cache
                const final = {
                    ...scanResult,
                    guildId: interaction.guild!.id,
                    confidence_score: scanResult.confidenceScore,
                    block_type: scanResult.blockHost ? 'hostname' : 'url',
                    first_seen: scanResult.createdAt || new Date(),
                };

                const id = randomId();
                actionCache.set(`${guildId}:${dataId}:${id}`, final as Required<ScanResultExtended>);

                await interaction.reply({
                    components: serverActionEmbed(
                        interaction.guild!,
                        { ...final, id: dataId } as unknown as Required<ScanResultExtended>,
                        action, id
                    ),
                    flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
                });
            }

        } catch (error) {
            logger.error("Error in setup interaction:", error);

            await interaction.update({
                components: errorEmbed(),
                flags: [MessageFlags.IsComponentsV2]
            });
        }
    }
});