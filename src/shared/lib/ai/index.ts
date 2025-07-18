import { ApiError, GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import system_prompts from '@/shared/lib/ai/prompt';

import type { ScanError, ScanResult } from '@/shared/types/result';
import { flaggedLinks } from '@/shared/db/schemas/base';
import { eq, gte, and } from 'drizzle-orm';
import db from '@/shared/db';
import { LRUCache } from 'lru-cache';
import logger from '@/shared/lib/utils/logger';
import moment from 'moment';

const flaggedLinksCache = new LRUCache<string, typeof flaggedLinks.$inferSelect>({
    max: 4000,
    ttl: 1000 * 60 * 60, // 60 minutes
});

// Feature for rotating api keys (if have multiple keys set)
const apiKeys: string[] = process.env.GEMINI_API_KEY.includes(',')
    ? process.env.GEMINI_API_KEY.split(',').map(key => key.trim())
    : [process.env.GEMINI_API_KEY];

let apiKeysLastPurge: moment.Moment | null = null;
const apiKeysLimitCache = new LRUCache<string, number>({
    max: 10,
    ttl: 1000 * 60 * 60 * 24, // a day
    updateAgeOnGet: false,
    updateAgeOnHas: false,
});

export class AIError extends Error {
    options?: ErrorOptions & { reason?: string, url?: string };
    constructor(message: string, options?: ErrorOptions & { reason?: string, url?: string }) {
        super(message, options);
        this.name = "AIError";
        this.options = options;
    }
}

export type OutputResponse = ScanResult | ScanError;

export const getAIInstance = () => {
    /** 
     * Purge api keys limit on midnight UTC-7
     * @see https://discuss.ai.google.dev/t/when-is-the-limit-of-requests-per-day-of-ai-studio-gemini-models-updated/1139/3
     */
    if (apiKeysLastPurge === null || apiKeysLastPurge.isBefore(moment().utcOffset(-7 * 60).startOf('day'))) {
        apiKeysLastPurge = moment().utcOffset(-7 * 60).startOf('day');
        apiKeysLimitCache.clear();
        logger.debug('API keys limit cache cleared for new day');
    }

    // Find unused API keys (not in cache) and prioritize them
    const unusedKeys = apiKeys.filter(key => !apiKeysLimitCache.has(key));

    // If we have unused keys, prioritize them and initialize with 0 usage
    if (unusedKeys.length > 0) {
        const selectedKey = unusedKeys[0];
        if (selectedKey) {
            apiKeysLimitCache.set(selectedKey, 0);
            logger.debug(`Using fresh API key: ${selectedKey.substring(0, 8)}...`);

            return {
                ai: new GoogleGenAI({
                    apiKey: selectedKey,
                }),
                apikey: selectedKey,
            };
        }
    }

    // Get available api keys that haven't exceeded the limit of 1500
    const availableKeys = apiKeys
        .map(key => ({
            key,
            usage: apiKeysLimitCache.get(key) || 0
        }))
        .filter(({ usage }) => usage < 1500)
        .sort((a, b) => a.usage - b.usage); // Sort by usage (lowest first)

    // if nothing available, throw ai error
    if (availableKeys.length === 0) {
        throw new AIError("Ratelimit exceeded for all API keys", {
            reason: "New scan is not available at the moment."
        });
    }

    const selectedKey = availableKeys[0]!.key;
    logger.debug(`Using API key: ${selectedKey.substring(0, 8)}... (usage: ${availableKeys[0]?.usage}/1500)`);

    return {
        ai: new GoogleGenAI({
            apiKey: selectedKey,
        }),
        apikey: selectedKey,
    };
};

export const config: GenerateContentConfig = {
    maxOutputTokens: 512,
    thinkingConfig: { thinkingBudget: 0 },
    tools: [{ urlContext: {} }],
    responseMimeType: 'text/plain',
    systemInstruction: [{ text: system_prompts }]
}

const parse = (input: string): Record<string, any> | null => {
    // check if input already parseable or not, return that instead.
    if (input.startsWith('{') || input.startsWith('[')) {
        try {
            return JSON.parse(input);
        } catch { }
    }

    // Match JSON content between ```json and ``` without escaped newlines
    const match = input.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match || match[1] === undefined) return null;

    let jsonString = match[1];
    // Try to fix invalid JSON: escape quotes inside string values using a simple regex
    jsonString = jsonString.replace(/: "(.*?[^\\])"(?=\s*[,\}])/g, (_, value) => {
        const fixed = value.replace(/"/g, '\\"');
        return `: "${fixed}"`;
    });

    try {
        const parsed = JSON.parse(jsonString);

        // reverify structure, there's a chance the AI might return wrong json structure.
        if (parsed !== null && typeof parsed === 'object' &&
            Object.keys(parsed).length > 0 &&
            parsed.url && typeof parsed.url === 'string' &&
            parsed.reason && typeof parsed.reason === 'string' &&
            parsed.error ? (parsed.error instanceof Boolean) : (
            typeof parsed.confidence_score === 'number' &&
            parsed.confidence_score >= 0 && parsed.confidence_score <= 1 &&

            (parsed.block_type ? typeof parsed.block_type === 'string' : true) &&
            (parsed.category ? typeof parsed.category === 'string' : true)
        )
        ) {
            // remove [<number>] at the very last sentence of reason
            if (parsed.reason.endsWith(']') && parsed.reason.length >= 3 && parsed.reason[parsed.reason.length - 3] === '[') {
                parsed.reason = parsed.reason.replace(/\s*\[\d+\]\s*$/, '');
            }
            return parsed;
        } else {
            throw new Error("Invalid JSON structure");
        }
    } catch (error) {
        console.error("Failed to parse JSON:", error);
        return null;
    }
}

export const generateUrlCheck = async (url: string, addToDb: boolean = false): Promise<OutputResponse | null> => {
    logger.debug(`Asking AI to check URL: ${url}`);

    const { ai, apikey } = getAIInstance();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: url }] }],
            config
        });

        // add to api keys limit cache
        const currentLimit = apiKeysLimitCache.get(apikey) || 0;
        apiKeysLimitCache.set(apikey, currentLimit + 1);

        logger.debug(`AI response for URL ${url}:`, response.text);

        const data = parse(response.text!);
        if (data && !data?.error && addToDb) {
            addUrlToDatabase(data as ScanResult);
        }

        return data as OutputResponse | null;
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
            logger.debug(`API key ${apikey} exceeded limit, switching to another key.`);
            apiKeysLimitCache.set(apikey, 1500); // Set to max limit to avoid using this key again
            return generateUrlCheck(url, addToDb); // Retry with a new key
        }
        throw error;
    }
}

export const getFlaggedLink = async (url: string): Promise<
    typeof flaggedLinks.$inferSelect | null
> => {

    const urlObj = new URL(url);
    urlObj.pathname = urlObj.pathname.replace(/\/{2,}/g, '/'); // Normalize multiple slashes

    // Check cache first
    const cachedLink = flaggedLinksCache.get(urlObj.toString());
    if (cachedLink) return cachedLink;

    // Query the database for flagged links not older than 7 days
    const sevenDaysAgo = moment().subtract(7, 'days').toDate();

    let result = await db.select()
        .from(flaggedLinks)
        .where(
            and(
                eq(flaggedLinks.url, urlObj.toString()),
                gte(flaggedLinks.createdAt, sevenDaysAgo)
            )
        )
        .limit(1);

    if (result.length === 0) {
        // If not found, generate it using AI
        const response = await generateUrlCheck(urlObj.toString(), true);
        if (!response) throw new Error("Error occurred while checking URL");
        if ('error' in response) throw new AIError("Error occurred while checking URL", response || undefined);

        // Create a mocked result based on the response
        result = [{
            id: 0, // Mock ID since it's not in DB yet
            url: response.url,
            host: new URL(response.url).host,
            category: response.category,
            confidenceScore: response.confidence_score * 100,
            blockHost: response.block_type === 'hostname',
            reason: response.reason,
            createdAt: new Date(),
            lastDetectAt: new Date(),
            updatedAt: new Date()
        }];

        if (result.length === 0) return null; // Still not found, something went wrong
    }

    if (result.length > 0) {
        // Update last detect time
        updateLastFlagDetect(urlObj.toString());
        flaggedLinksCache.set(urlObj.toString(), result[0]);
    }
    return result[0] || null;
}

const updateLastFlagDetect = async (url: string): Promise<void> => {
    await db.update(flaggedLinks)
        .set({ lastDetectAt: new Date() })
        .where(eq(flaggedLinks.url, url));
}

const addUrlToDatabase = async (data: ScanResult): Promise<void> => {
    await db.insert(flaggedLinks).values({
        url: data.url,
        host: new URL(data.url).host,
        category: data.category || undefined,
        confidenceScore: data.confidence_score * 100,
        blockHost: data.block_type === 'hostname',
        reason: data.reason,
        createdAt: new Date(),
        lastDetectAt: new Date(),
    });
}