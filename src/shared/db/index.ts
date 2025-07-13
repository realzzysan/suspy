import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as baseSchema from "@/shared/db/schemas/base"; 
import * as discordSchema from "@/shared/db/schemas/discord";
import * as telegramSchema from "@/shared/db/schemas/telegram";

export const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema: {
    ...baseSchema,
    ...discordSchema,
    ...telegramSchema
} });
export default db;