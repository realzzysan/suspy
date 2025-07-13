import {
  AutoModerationActionType,
  AutoModerationRuleTriggerType,
  AutoModerationRuleEventType,
  Guild,
  type AutoModerationActionOptions,
} from 'discord.js';

export const automodRuleName = 'Suspy: Block unsafe/risk links';
export async function addURLToAutomod(
  guild: Guild,
  url: string,
  blockHost: boolean = false,
  channelId?: string
) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  // 1. Escape and normalize the pattern
  const newPattern = blockHost
    ? parsedUrl.hostname.replace(/\./g, '\\.')
    : parsedUrl.href.replace(/\./g, '\\.');

  // 2. Try to fetch the existing rule
  const rules = await guild.autoModerationRules.fetch();
  let rule = rules.find(r => r.name === automodRuleName);

  // 3. Prepare default actions
  const actions: AutoModerationActionOptions[] = [
    {
      type: AutoModerationActionType.BlockMessage
    },
    {
      type: AutoModerationActionType.Timeout,
      metadata: {
        durationSeconds: 60
      }
    }
  ];

  if (channelId) {
    actions.push({
      type: AutoModerationActionType.SendAlertMessage,
      metadata: {
        channel: channelId,
      }
    });
  }

  // 4. If rule doesn't exist, create it
  if (!rule) {
    rule = await guild.autoModerationRules.create({
      name: automodRuleName,
      enabled: true,
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: {
        regexPatterns: [newPattern]
      },
      actions,
    });

    return newPattern;
  }

  // 5. If rule exists, add pattern if not already present
  const existingPatterns = rule.triggerMetadata.regexPatterns ?? [];
  const regexSet = new Set(existingPatterns);

  if (!regexSet.has(newPattern)) {
    regexSet.add(newPattern);

    await rule.edit({
      triggerMetadata: {
        regexPatterns: Array.from(regexSet)
      }
    });
  }

  return newPattern;
}
