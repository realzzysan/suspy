import {
  pgTable,
  bigint,
  boolean,
  timestamp,
  text,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'

// ENUMs

export const statusEnum = pgEnum('status', [
  'waiting',
  'ignored',
  'resolved',
]);

// Tables

export const discordUserSettings = pgTable('discord_user_settings', {
  id: bigint('id', { mode: 'number' }).primaryKey().notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  enableDm: boolean('enable_dm'),
  createdAt: timestamp('created_at', { withTimezone: false }),
  updatedAt: timestamp('updated_at', { withTimezone: false }),
  lastDmAt: timestamp('last_dm_at', { withTimezone: false }),
}, (table) => ({
  userIdIndex: index('discord_user_settings_user_id_index').on(table.userId),
}));

export const discordServerSettings = pgTable('discord_server_settings', {
  id: bigint('id', { mode: 'number' }).primaryKey().notNull(),
  serverId: text('server_id').notNull(),
  enable: boolean('enable').notNull(),
  enableDm: boolean('enable_dm'),
  logChannel: text('log_channel').notNull(),
  createdAt: timestamp('created_at', { withTimezone: false }),
  updatedAt: timestamp('updated_at', { withTimezone: false }),
  lastDetectAt: timestamp('last_detect_at', { withTimezone: false }),
}, (table) => ({
  serverIdIndex: index('discord_server_settings_server_id_index').on(table.serverId),
}));

export const discordServerBlocklist = pgTable('discord_server_blocklist', {
  id: bigint('id', { mode: 'number' }).primaryKey().notNull(),
  serverId: text('server_id').notNull(),
  flagId: bigint('flag_id', { mode: 'number' }).notNull(),
  status: statusEnum('status').notNull(),
  referenceUrl: text('reference_url'),
  createdAt: timestamp('created_at', { withTimezone: false }),
  updatedAt: timestamp('updated_at', { withTimezone: false }),
  lastDetectAt: timestamp('last_detect_at', { withTimezone: false }),
});
