import { setServerConfig } from "@/discord/lib/actions/db";
import { defineEvent } from "@/discord/lib/utils/define";
import { errorEmbed, setupEmbed, warningEmbed } from "@/discord/lib/utils/embeds";
import type { discordServerSettings } from "@/shared/db/schemas/discord";
import logger from "@/shared/lib/utils/logger";
import { ButtonInteraction, MessageFlags, type AnySelectMenuInteraction } from "discord.js";
import { LRUCache } from "lru-cache";
import { updatePresence } from "@/discord/events/ready";

export type SetupProcess = Partial<typeof discordServerSettings.$inferSelect> & {
    step:
    1 | // Welcome screen
    2 | // Log channel selection
    3 | // Configure minimum confidence score
    4 | // Also enable user DM notify
    5 | // Confirmation screen & enable
    6; // Finished setup screen
    authorId: string;
    deleteFunction?: () => Promise<void>;
}

export const setupProcessCache = new LRUCache<string, SetupProcess>({
    max: 50,
    ttl: 1000 * 60 * 15, // 5 minutes
});

export default defineEvent({
    name: "interactionCreate",
    once: false,
    execute: async (interaction) => {
        if (!interaction.isButton() && !interaction.isAnySelectMenu()) return;
        try {

            // Specific handling for takeover
            const takeoverMatch = interaction.customId.match(/^3:([0-9]+):([a-z0-9]+)$/);
            if (takeoverMatch && takeoverMatch[1]) {
                const serverId = takeoverMatch[1];
                const setupProcess = setupProcessCache.get(serverId);

                if (!setupProcess) {
                    return interaction.update({
                        components: [warningEmbed("Error occurred", "The setup process has expired. Please rerun the setup command.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                // Change author id
                setupProcess.authorId = interaction.user.id;
                setupProcessCache.set(serverId, setupProcess);

                // delete the old one
                try { setupProcess.deleteFunction?.(); } catch {}

                // continue
                return await handleSetup(interaction, setupProcess, setupProcess.step, true);
            }

            // match regex for interaction action key
            // 1:<server id>:(0-6):<random string>
            const actionKey = interaction.customId.match(/^1:([0-9]+):([0-6]):([a-z0-9]+)$/);
            if (!actionKey || !actionKey[1] || !actionKey[2] || actionKey[1] !== interaction.guild!.id) return;

            // get step data
            const { 1: serverId, 2: step } = actionKey;
            const setupProcess = setupProcessCache.get(serverId);

            if (!setupProcess || !([1, 2, 3, 4, 5, 6].includes(parseInt(step)))) {
                return interaction.update({
                    components: [warningEmbed("Error occurred", "This setup process has expired.")],
                    flags: [MessageFlags.IsComponentsV2]
                });
            }

            // If author ID mismatch
            if (setupProcess.authorId !== interaction.user.id) {
                return interaction.update({
                    components: [warningEmbed("Error occurred", "You are not the author of this setup process.")],
                    flags: [MessageFlags.IsComponentsV2]
                });
            }

            return await handleSetup(interaction, setupProcess, parseInt(step));

        } catch (error) {
            logger.error("Error in setup interaction:", error);

            await interaction.update({
                components: errorEmbed(),
                flags: [MessageFlags.IsComponentsV2]
            });
        }
    }
});

async function handleSetup(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    process: SetupProcess, toStep: number, followup: boolean = false
) {
    if (followup) {
        // return the embed
        return interaction.followUp({
            components: await setupEmbed(interaction.guild!, {
                ...process, step: toStep as SetupProcess["step"]
            }),
            flags: [MessageFlags.IsComponentsV2]
        });
    }

    switch (process.step) {
        case 2:
            // Get the selected channel from channel select menu interaction
            if (interaction.isChannelSelectMenu()) {
                const selectedChannel = interaction.values[0];
                if (!selectedChannel) {
                    return interaction.update({
                        components: [warningEmbed("Invalid channel", "Please select a valid channel.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                // Update the process with the selected channel
                process.logChannel = selectedChannel;
            }
            break;

        case 3:
            // Get the minimum confidence score from stringselectmenu interaction
            if (interaction.isStringSelectMenu()) {
                const selectedScore = interaction.values[0];
                if (!selectedScore || isNaN(parseInt(selectedScore))) {
                    return interaction.update({
                        components: [warningEmbed("Invalid score", "Please select a valid minimum confidence score.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                // Update the process with the selected score
                process.minimumConfidenceScore = parseInt(selectedScore);
            }
            break;

        case 4:
            // Get the enable DM option from stringselectmenu interaction
            if (interaction.isStringSelectMenu()) {
                const selectedEnableDM = interaction.values[0];
                if (!selectedEnableDM || !["true", "false"].includes(selectedEnableDM)) {
                    return interaction.update({
                        components: [warningEmbed("Invalid option", "Please select a valid option for enabling DM notifications.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                // Update the process with the selected enable DM option
                process.enableDm = selectedEnableDM === "true";
            }
            break;

        case 5:
            // Handle confirmation step
            if (interaction.isStringSelectMenu()) {
                const selectedEnable = interaction.values[0];
                if (!selectedEnable || !["true", "false"].includes(selectedEnable)) {
                    return interaction.update({
                        components: [warningEmbed("Invalid option", "Please select a valid option to enable.")],
                        flags: [MessageFlags.IsComponentsV2]
                    });
                }

                // Update the process with the selected enable option
                process.enable = selectedEnable === "true";

                // Also set setup done
                process.setupDone = true;

                // Also update client setpresence
                updatePresence();

                // Also set the cache
                setupProcessCache.set(interaction.guild!.id, process);
            }
            break;
    }

    // save current process to cache and database
    process.step = toStep as SetupProcess["step"];
    setupProcessCache.set(interaction.guild!.id, process);

    const { 
        id: _1,
        step: _2, 
        authorId: _3, 
        deleteFunction: _4,
        ...updateData } = process;
    
    await setServerConfig(interaction.guild!.id, {
        serverId: interaction.guild!.id,
        enable: updateData.enable ?? false,
        ...updateData
    } satisfies typeof discordServerSettings.$inferInsert);

    return interaction.update({
        components: await setupEmbed(interaction.guild!, {
            ...process, step: toStep as SetupProcess["step"]
        }),
        flags: [MessageFlags.IsComponentsV2]
    });
}