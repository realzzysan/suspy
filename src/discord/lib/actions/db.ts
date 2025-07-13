import db from "@/shared/db";
import { flaggedLinks } from "@/shared/db/schemas/base";
import { discordServerBlocklist, discordServerSettings } from "@/shared/db/schemas/discord";
import { getFlaggedLink } from "@/shared/lib/ai";
import { eq, count } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { server } from "typescript";

type BlocklistItem = {
    discord_server_blocklist: typeof discordServerBlocklist.$inferSelect;
    flagged_links: typeof flaggedLinks.$inferSelect | null;
}

const serverConfigCache = new LRUCache<string, typeof discordServerSettings.$inferSelect>({
    max: 1000,
    ttl: 1000 * 60 * 15, // 15 minutes
});
const serverBlocklistCache = new LRUCache<string, BlocklistItem[]>({
    max: 1000,
    ttl: 1000 * 60 * 15, // 15 minutes
});

export async function getServerCount(): Promise<number> {
    const result = await db.select({ count: count() })
        .from(discordServerSettings);
    return result[0]?.count || 0;
}

export async function getServerConfig(serverId: string): Promise<
    typeof discordServerSettings.$inferSelect | null
> {
    // Check cache first
    const cachedConfig = serverConfigCache.get(serverId);
    if (cachedConfig) return cachedConfig;

    const server = await db.select()
        .from(discordServerSettings)
        .where(eq(discordServerSettings.serverId, serverId))
        .limit(1);

    if (server.length > 0) {
        serverConfigCache.set(serverId, server[0]);
    }
    return server?.[0] || null;
}

export async function getServerBlocklists(serverId: string): Promise<
    BlocklistItem[] | null
> {
    // Check cache first
    const cachedBlocklist = serverBlocklistCache.get(serverId);
    if (cachedBlocklist) return cachedBlocklist;

    const blocklist = await db.select()
        .from(discordServerBlocklist)
        .leftJoin(flaggedLinks, eq(discordServerBlocklist.flagId, flaggedLinks.id))
        .where(eq(discordServerBlocklist.serverId, serverId));

    if (blocklist.length > 0) {
        serverBlocklistCache.set(serverId, blocklist);
    }
    return blocklist || null;
}




export async function setServerConfig(serverId: string, data: Partial<typeof discordServerSettings.$inferInsert>) {
    // get existing config
    const existingConfig = await getServerConfig(serverId);

    // Filter out fields we don't want to overwrite
    const existingData = existingConfig ?
        { ...existingConfig, id: undefined, serverId: undefined, createdAt: undefined, updatedAt: undefined } :
        {};

    const newData = { ...data, id: undefined, serverId: undefined, createdAt: undefined, updatedAt: undefined };

    const finalData = {
        // for default values
        enable: false,

        ...existingData,
        ...newData,

        serverId,
        updatedAt: new Date(),
    };

    // For update operation, we need to exclude the primary key
    const updateData = { ...finalData, serverId: undefined };

    // do insert with updateonconflict
    await db.insert(discordServerSettings)
        .values(finalData)
        .onConflictDoUpdate({
            target: discordServerSettings.serverId,
            set: {
                ...updateData,
                updatedAt: new Date(),
            }
        });
}

// TODO: Fix query problem drizzle is crazy
export async function upsertServerBlocklist(serverId: string, data: Partial<typeof discordServerBlocklist.$inferInsert>) {
    const existingBlocklists = await getServerBlocklists(serverId);
    const existingBlocklist = existingBlocklists?.find(block => block.flagged_links?.id === data.flagId);

    const discordInitData = {
        flagId: 0
    }
    const discordAfterData = {
        ...data,

        serverId,
        updatedAt: new Date(),
    };

    const finalData = {
        ...discordInitData,
        ...existingBlocklist?.['discord_server_blocklist'] ?? {},
        ...discordAfterData,

        flagId: undefined,
        createdAt: undefined,
    };

    console.log(`Final data for upsert:`, finalData);

    // For update operation, we need to exclude the primary key
    // const updateData = { ...finalData, serverId: undefined };

    // Check if existing data
    if (existingBlocklist) {
        // Update existing entry
        return await db.update(discordServerBlocklist)
            .set({
                ...discordInitData,
                ...existingBlocklist['discord_server_blocklist'],
                ...discordAfterData,
            })
            .where(eq(discordServerBlocklist.id, existingBlocklist.discord_server_blocklist.id))
            .returning();
    } else {
        // Insert new entry
        return await db.insert(discordServerBlocklist)
            .values({
                ...discordInitData,
                ...discordAfterData,
            })
            .returning();
    }
}



export async function checkURL(url: string): Promise<
    typeof flaggedLinks.$inferSelect | null
> {
    const result = await getFlaggedLink(url);
    if (!result) return null;

    return result;
}

export async function checkURLForServer(serverId: string, url: string) {
    const serverConfig = await getServerConfig(serverId);
    if (!serverConfig || !serverConfig.enable) return null;

    const result = await checkURL(url);
    if (!result) return null;

    // check is confidence score
    if (result.confidenceScore < serverConfig?.minimumConfidenceScore!) {
        return null;
    }

    // Check if the link is ignored in the server blocklist
    const blocklists = await getServerBlocklists(serverId);
    if (!blocklists) return { ...result, referenceUrl: undefined };

    // Check if there's any matching URL that is ignored
    let urlObj = new URL(url);
    urlObj.pathname = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash for consistency
    const detected = blocklists.filter(block =>
        block.flagged_links?.url === urlObj.toString() &&
        block.discord_server_blocklist.status === 'ignored'
    );

    if (detected.length > 0) return null;

    const detected2 = blocklists.filter(block =>
        block.flagged_links?.url === urlObj.toString() &&
        block.discord_server_blocklist.status === null
    );

    const final = {
        ...result,
        referenceUrl: detected2.length > 0 ? detected2[0]!.discord_server_blocklist.referenceUrl : null
    }

    return final;
}

