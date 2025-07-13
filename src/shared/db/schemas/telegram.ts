import {
  pgTable,
  bigint,
  boolean,
  timestamp,
  text,
  integer,
  index,
} from 'drizzle-orm/pg-core'
import { flaggedLinks } from '@/shared/db/schemas/base';

// Tables

export const telegramUserSettings = pgTable('telegram_user_settings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull(),
  enableDm: boolean('enable_dm'),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }),
  lastDmAt: timestamp('last_dm_at', { withTimezone: false }),
}, (table) => ({
  userIdIndex: index('telegram_user_settings_user_id_index').on(table.userId),
}));

export const telegramGroupSettings = pgTable('telegram_group_settings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: integer('group_id').notNull().unique(),
  enable: boolean('enable').notNull(),
  enableDm: boolean('enable_dm'),
  minimumConfidenceScore: integer('minimum_confidence_score'),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }),
  lastDetectAt: timestamp('last_detect_at', { withTimezone: false }),
}, (table) => ({
  groupIdIndex: index('telegram_group_settings_group_id_index').on(table.groupId),
}));

export const telegramGroupCustomBlocklist = pgTable('telegram_group_custom_blocklist', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: integer('group_id').notNull(),
  flagId: bigint('flag_id', { mode: 'number' }).references(() => flaggedLinks.id),
  url: text('url'),
  host: text('host'),
  ignore: boolean('ignore'),
  blockHost: boolean('block_host'),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }),
  lastDetectAt: timestamp('last_detect_at', { withTimezone: false }),
});