import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, blob, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', {mode: 'timestamp_ms'}),
  image: text('image')
  
});

export const accounts = sqliteTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
},
(account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId]
    }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
},
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const files = sqliteTable('file', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  mimeType: text('mimeType').notNull(),
  uploadedAt: integer('uploadedAt', { mode: 'timestamp_ms' }).notNull(),
  expiredAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  scanned: integer('scanned', { mode: 'boolean' }).notNull().default(false),
  isMalicious: integer('isMalicious', { mode: 'boolean' }).notNull().default(false),
  downloadCount: integer('downloadCount').notNull().default(0),
  secret: text('secret').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  accounts: many(accounts),
}));

export const fileRealtions = relations(files, ({ one }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  })
}));

export const insertFileSchema = createInsertSchema(files, {
  name: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string().min(1),
  uploadedAt: z.date().transform(d => d.getTime()),
  expiredAt: z.date().transform(d => d.getTime()),
  userId: z.string().min(1),
  path: z.string().min(1),
  secret: z.string().min(8)
});

export const selectFileSchema = createSelectSchema(files);

export type Files = z.infer<typeof selectFileSchema>;
export type NewFile = z.infer<typeof insertFileSchema>;

export type DbTables = {
  users: typeof users,
  accounts: typeof accounts,
  sessions: typeof sessions,
  verificationTokens: typeof verificationTokens,
  files: typeof files,
};
