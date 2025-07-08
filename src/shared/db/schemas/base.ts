import {
  pgTable,
  bigint,
  boolean,
  timestamp,
  text,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'

// ENUMs

export const categoryEnum = pgEnum('category', [
  'phishing',
  'pornography',
  'scam',
  'malware',
]);

// Tables

export const flaggedLinks = pgTable('flagged_links', {
  id: bigint('id', { mode: 'number' }).primaryKey().notNull(),
  url: text('url').notNull(),
  host: text('host').notNull(),
  category: categoryEnum('category').notNull(),
  confidenceScore: integer('confidence_score').notNull(),
  reason: text('reason').notNull(),
  blockHost: boolean('block_host').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  lastDetectAt: timestamp('last_detect_at'),
}, (table) => ({
  compoundIndex: index('flagged_links_url_host_category_created_at_index').on(
    table.url,
    table.host,
    table.category,
    table.createdAt
  ),
}));
