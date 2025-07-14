import {
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    User, Team,
    ChannelSelectMenuBuilder,
    ChannelType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import type {
    MessageActionRowComponentBuilder,
    Message,
    Guild
} from 'discord.js';

import moment from 'moment';
import { client } from '@/discord';

import { emojis } from '@/shared/lib/constant/emojis';
import { colors } from '@/shared/lib/constant/colors';

import type { ScanResultExtended } from '@/shared/types/result';
import type { InteractionActionServerReportKey, InteractionActionSetupKey, InteractionActionSetupTakeoverKey } from '@/discord/types/interaction';
import type { SetupProcess } from '@/discord/events/interactions/setup';
import { randomUUIDv7 } from 'bun';
import { automodRuleName } from '../actions/automod';



export const setupEmbed = async (guild: Guild, process?: SetupProcess) => {
    const baseContainer = new ContainerBuilder()
        .setAccentColor(colors.setup);

    if (!process || process.step === 1) {
        return [
            baseContainer
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${emojis.setup.discord} \u200b Server Setup`),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("Welcome to Suspy, moderation bot that can automatically detect and moderate unsafe link!\n\nTo start setting up Suspy on this server, please click **Start**."),
                ),
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Primary)
                        .setLabel("Start Setup")
                        .setEmoji(emojis.next.discord.match(/\d{17,}/)?.[0]!)
                        .setCustomId(`1:${guild.id}:2:${randomId()}` satisfies InteractionActionSetupKey),
                )
        ];
    }
    
    const generatePageButton = (prev: number|boolean|null, next: number|boolean|null) => {
        let builder = new ActionRowBuilder<MessageActionRowComponentBuilder>()

        if (prev !== null) {
            let btn = new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("Previous")
                    .setEmoji(emojis.previous.discord.match(/\d{17,}/)?.[0]!)
                    .setCustomId(`1:${guild.id}:${prev}:${randomId()}` satisfies InteractionActionSetupKey);
            if (prev === false) btn = btn.setDisabled(true);
            builder = builder.addComponents(btn);
        }

        if (next !== null) {
            let btn = new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setLabel("Next")
                .setEmoji(emojis.next.discord.match(/\d{17,}/)?.[0]!)
                .setCustomId(`1:${guild.id}:${next}:${randomId()}` satisfies InteractionActionSetupKey);
            if (next === false) btn = btn.setDisabled(true);
            builder = builder.addComponents(btn);
        }

        return builder;
    }

    switch (process.step) {
        case 2:
            const selectedChannel = process.logChannel
                ? await guild.channels.fetch(process.logChannel)
                : undefined;

            return [
                baseContainer
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${emojis.setup.discord} \u200b Server Setup - Step 1`),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("To be able for admin to take action on unsafe link report, all report log must be forwarded to a log channel on your server.\n\nPlease select channel to use for sending report log from Suspy."),
                    ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ChannelSelectMenuBuilder()
                            .setChannelTypes([
                                ChannelType.GuildText,
                                ChannelType.GuildAnnouncement,
                                ChannelType.PublicThread,
                                ChannelType.PrivateThread
                            ])
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setDefaultChannels(selectedChannel ? [selectedChannel.id] : [])
                            .setPlaceholder("Select log channel")
                            .setCustomId(`1:${guild.id}:3:${randomId()}` satisfies InteractionActionSetupKey),
                    ),
                generatePageButton(process.setupDone ? false : 1, Boolean(selectedChannel) && 3)
            ];

        case 3:
            const selectedMinConfidence = process.minimumConfidenceScore;

            return [
                baseContainer
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${emojis.setup.discord} \u200b Server Setup - Step 2`),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("By default, Suspy will flag all links as unsafe/risky if score minimum level is reached, the _more it higher_, the _more unsafe/risky_ the link is.\n\nRecommended score is **80%** to prevent false flag/not get flagged."),
                    ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`1:${guild.id}:4:${randomId()}` satisfies InteractionActionSetupKey)
                            .setPlaceholder("Select minimum score")
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("50% - Link might be unsafe/risky")
                                    .setValue("50")
                                    .setDefault(selectedMinConfidence === 50),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("70% - Link can be unsafe/risky")
                                    .setValue("70")
                                    .setDefault(selectedMinConfidence === 70),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("80% - Link is unsafe/risky")
                                    .setValue("80")
                                    .setDefault(selectedMinConfidence === 80),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("90% - Link is very unsafe/risky")
                                    .setValue("90")
                                    .setDefault(selectedMinConfidence === 90),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("100% - Link is extremely unsafe/risky")
                                    .setValue("100")
                                    .setDefault(selectedMinConfidence === 100),
                            )
                    ),
                generatePageButton(2, typeof selectedMinConfidence === 'number' && 4)
            ];

        case 4:

            const selectedEnableDM = process.enableDm;

            return [
                baseContainer
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${emojis.setup.discord} \u200b Server Setup - Step 3`),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("In some case of the unsafe/risk link got sent, it might be caused by the sender account got hacked.\n\nTo help notify the user in case of this happen, Suspy can also help sending a DM for reminder to the user."),
                    ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(

                        new StringSelectMenuBuilder()
                            .setCustomId(`1:${guild.id}:5:${randomId()}` satisfies InteractionActionSetupKey)
                            .setPlaceholder("Select option")
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Enable User DM")
                                    .setValue("true")
                                    .setDefault(selectedEnableDM === true),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Disable User DM")
                                    .setValue("false")
                                    .setDefault(selectedEnableDM === false),
                            )
                    ),
                generatePageButton(3, typeof selectedEnableDM === 'boolean' && 5)
            ]
        case 5:
            return [
                baseContainer
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${emojis.setup.discord} \u200b Server Setup - Step 4`),
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${process.setupDone ? `**Currently enabled:** \`${process.enable ? "Yes" : "No"}\`\nAlso, h` : '**Almost done!**\nH'}ere's your configured server setup:\n\n- Log channel: <#${process.logChannel}> \n- Minimum score: \`${process.minimumConfidenceScore}%\` \n- Enable DM: \`${process.enableDm ? "Yes" : "No"}\` \n\n${process.setupDone ? 'Select to enable/disable suspy or use previous to change other settings.' : 'Enable now?'}`),
                    ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(

                        new StringSelectMenuBuilder()
                            .setCustomId(`1:${guild.id}:6:${randomId()}` satisfies InteractionActionSetupKey)
                            .setPlaceholder("Select option")
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel((process.setupDone && process.enable) ? "Keep suspy enabled!" : "Enable Suspy!")
                                    .setValue("true"),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(process.setupDone ? process.enable ? "Disable suspy" : "Keep suspy disabled" :"Not yet uhh...")
                                    .setValue("false")
                            )
                    ),
                generatePageButton(4, null)
            ]
        case 6:
            let cmds = await guild.commands.fetch().catch(() => null);
            const setupCommand = cmds?.find(cmd => cmd.name === 'setup' && cmd.applicationId === client.user!.id);

            let text;
            if (process.enable) {
                text = `**Suspy is now active and moderating unsafe/risk links!**\nTo reconfigure the settings, just rerun ${setupCommand ? `</setup:${setupCommand.id}>` : '`/setup`'} again.`;
            } else {
                text = `To enable/reconfigure the settings, just rerun ${setupCommand ? `</setup:${setupCommand.id}>` : '`/setup`'} again.\n**Make sure to enable Suspy later in order for Suspy to actually working.**`;
            }

            return [
                new ContainerBuilder()
                    .setAccentColor(colors.success)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${emojis.success.discord} \u200b Server Setup is done!`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(text)
                    )
            ]
    }
}

export const takeoverSetupEmbed = (guild: Guild) => {
    return [
        warningEmbed("Setup in Progress", "There is already an ongoing setup process by another user.\nIf you want to takeover, click button below.")
            .addActionRowComponents(
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Primary)
                            .setLabel("Takeover Setup")
                            .setEmoji(emojis.warning.discord.match(/\d{17,}/)?.[0]!)
                            .setCustomId(`3:${guild.id}:${randomId()}` satisfies InteractionActionSetupTakeoverKey),
                    ),
            )
    ]
};




export const serverNewLinkEmbed = (
    data: Required<ScanResultExtended>,
    message: Message,
    ref_url?: string
) => {

    const isNewLink = !ref_url;
    const contentText = "@here"

    // Build container components
    let container = warningEmbed(
        `${isNewLink ? 'New unsafe' : 'Unsafe'} link detected!`,
        `The bot has detected an unsafe link sent on your discord server.${ref_url ? '\nPlease look on previous report to take action on this link.' : ''}`
    );

    // Add link details only for new links
    if (isNewLink) {
        container = container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `Link: ${data.url}\nConfidence Score: \`${data.confidence_score}%\` (higher means more dangerous)\nCategory: \`${data.category}\`\nFirst Seen: <t:${moment(data.first_seen).unix()}:f>\nRecommended Action: \`${data.block_type === 'hostname' ? 'Block domain' : 'Block URL'}\`\nReason: \`\`\`${data.reason.replaceAll('```', '\\`\\`\\`')}\`\`\``
            )
        );
    }

    // Add message info and footer
    container = container
        .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Sent by: ${message.author}\nChannel: ${message.channel}\nMessage: \`\`\`\n${message.content.replaceAll('```', '\\`\\`\\`')}\n\`\`\``)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# By ${client.user?.globalName || 'Suspy'}・<t:${moment().unix()}:f>`)
        );

    // Create button
    const button = ref_url ?
        new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel("Previous Report")
                    .setURL(ref_url)
            )
        :
        new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Block URL")
                    .setCustomId(`2:${message.guild!.id}:${data.id}:1:${randomId()}` satisfies InteractionActionServerReportKey),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Block Domain")
                    .setCustomId(`2:${message.guild!.id}:${data.id}:2:${randomId()}` satisfies InteractionActionServerReportKey),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("Ignore")
                    .setEmoji(emojis.error.discord.match(/\d{17,}/)?.[0]!)
                    .setCustomId(`2:${message.guild!.id}:${data.id}:3:${randomId()}` satisfies InteractionActionServerReportKey),
            );

    return [
        new TextDisplayBuilder().setContent(contentText),
        container,
        button
    ];
};

export const serverActionEmbed = (
    guild: Guild,
    data: Required<ScanResultExtended>,
    action: ScanResultExtended['block_type'],
    id: string,
) => {
    const urlObj = new URL(data.url);
    urlObj.pathname = urlObj.pathname.replace(/\/{2,}/g, '/'); // Normalize multiple slashes
    
    const text = action != null 
        ? `This will add \`${action === "hostname" ? urlObj.hostname : urlObj.toString()}\` to automod list on rule: \`${automodRuleName}\`. Continue?`
        : `This will ignore \`${urlObj.toString()}\` from being moderated by Suspy. Continue?`;

    return [
        warningEmbed("Are you sure?", text),
        new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Continue")
                    .setEmoji(emojis.success.discord.match(/\d{17,}/)?.[0]!)
                    .setCustomId(`2:${guild.id}:${data.id}:${id}:${action === 'url' ? 1 : action === 'hostname' ? 2 : 3}:1:${randomId()}` satisfies InteractionActionServerReportKey),
                // new ButtonBuilder()
                //     .setStyle(ButtonStyle.Secondary)
                //     .setLabel("Cancel")
                //     .setEmoji(emojis.error.discord.match(/\d{17,}/)?.[0]!)
                //     .setCustomId(`2:${guild.id}:${data.id}:${id}:3:2:${randomId()}` satisfies InteractionActionServerReportKey),
            )
    ]
}

export const serverActionConfirmedEmbed = () => {
    return [
        new ContainerBuilder()
            .setAccentColor(colors.success)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${emojis.success.discord} \u200b Action Confirmed`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("The action has been confirmed.")
            )
    ]
}

export const dmReminderEmbed = (message: Message) => {
    return [
        warningEmbed("Hey there!", "Suspy detected suspicious link sent from you.\nJust to make sure your account is safe.. (probably from a hack?)\n\nPlease keep an eye on your Discord activity.\nIf you notice anything unusual, reset your password immediately. :)")
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Content:**\n\`\`\`\n${message.content.replaceAll('```', '\\`\\`\\`')}\n\`\`\``),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# By ${client.user?.globalName || 'Suspy'}・<t:${moment().unix()}:f>`)
            ),
        new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel("More Info")
                    .setURL("https://support.discord.com/hc/en-us/articles/24160905919511-My-Discord-Account-was-Hacked-or-Compromised")
            )
    ]
}




export const checkEmbed = (data: Required<ScanResultExtended>) => {
    const safe = data.confidence_score < 50;
    return [
        new ContainerBuilder()
            .setAccentColor(safe ? colors.success : colors.warning)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${safe ? emojis.success.discord : emojis.warning.discord} ${safe ? 'This link is safe!' : data.confidence_score < 80 ? 'This link might be unsafe!' : 'Unsafe link detected!'}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Link: ${data.url}\nConfidence Score: \`${data.confidence_score / 100}\` (higher means more dangerous)${(!safe && data.category) ? `\nCategory: \`${data.category}\`` : ''}\nFirst Seen: <t:${moment(data.first_seen).unix()}:f>${(!safe && data.block_type) ? `\nRecommended Action: \`${data.block_type === 'hostname' ? 'Block domain' : 'Block URL'}\`` : ''}\nReason: \`\`\`${data.reason.replaceAll('```', '\\`\\`\\`')}\`\`\``
                )
            )
    ]
}

export const errorEmbed = (error?: string) => {

    const ownerId = client.application?.owner instanceof User
        ? client.application?.owner.id
        : client.application?.owner instanceof Team
            ? client.application?.owner.owner?.id
            : undefined;

    let container = warningEmbed("Error occured",
        `There's something wrong with the bot, whoops!
Try the command/action again. If issue persist, contact the bot owner.`
    )
    if (error) {
        container = container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Error: \`${error}\``)
        );
    }

    if (ownerId) {
        container = container.addActionRowComponents(
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel("Contact Owner")
                        .setURL(`https://discord.com/users/${ownerId}`),
                ),
        );
    }

    return [container];
}

export const warningEmbed = (title: string, message: string) => {
    return new ContainerBuilder()
        .setAccentColor(colors.warning)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emojis.warning.discord} \u200b ${title}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(message)
        )
}

export const randomId = () => randomUUIDv7().replaceAll('-', ''); // Remove dashes for compatibility with Discord IDs