import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
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

export class AIError extends Error {
    options?: ErrorOptions & { reason?: string, url?: string };
    constructor(message: string, options?: ErrorOptions & { reason?: string, url?: string }) {
        super(message, options);
        this.name = "AIError";
        this.options = options;
    }
}

export type OutputResponse = ScanResult | ScanError;

export const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});
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
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: url }] }],
        config
    });

    logger.debug(`AI response for URL ${url}:`, response.text);

    const data = parse(response.text!);
    if (data && !data?.error && addToDb) {
        addUrlToDatabase(data as ScanResult);
    }

    return data as OutputResponse | null;
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