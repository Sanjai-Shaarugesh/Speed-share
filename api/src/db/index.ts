import { createClient } from "@libsql/client";
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const tursoUrl = process.env.DATABASE_URL || 'file:./db.sqlite';
const tursoToken = process.env.DATABASE_TOKEN;

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

export const db = drizzle(client, { schema });


export * from './schema'