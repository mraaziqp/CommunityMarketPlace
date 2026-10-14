import path from 'node:path';
import { getTableColumns, inArray, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema';
import { COLLECTIONS, type Collection, type PendingWrite, type PersistenceAdapter } from '../db';
import type { ServerConfig } from './config';
import { HIERARCHICAL_CATEGORIES } from '../src/data/mockCategories';

const TABLES: Record<Collection, PgTable> = {
  users: schema.users,
  accounts: schema.accounts,
  sessions: schema.sessions,
  trustGroups: schema.trustGroups,
  groupMemberships: schema.groupMemberships,
  listings: schema.listings,
  pricingTiers: schema.pricingTiers,
  userSubscriptions: schema.userSubscriptions,
  bookings: schema.bookings,
  payments: schema.payments,
  usageLogs: schema.usageLogs,
  conditionLogs: schema.conditionLogs,
  conversations: schema.conversations,
  messages: schema.messages,
  reviews: schema.reviews,
  systemLogs: schema.systemLogs,
};

const BATCH = 500;

/** `SET col = excluded.col` for every non-key column, so an upsert overwrites the whole row. */
function excludedSet(table: PgTable) {
  const set: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (key === 'id') continue;
    set[key] = sql.raw(`excluded."${column.name}"`);
  }
  return set;
}

/** The category taxonomy is reference data owned by the code; keep the table in step with it. */
async function syncCategories(db: any) {
  const rows: (typeof schema.categories.$inferInsert)[] = [];
  const walk = (cats: typeof HIERARCHICAL_CATEGORIES, parentId: string | null) => {
    for (const cat of cats) {
      rows.push({ id: cat.id, name: cat.name, slug: cat.slug, parentId, icon: cat.icon ?? null, description: cat.description ?? null });
      if (cat.subcategories) walk(cat.subcategories, cat.id);
    }
  };
  walk(HIERARCHICAL_CATEGORIES, null);
  if (rows.length) await db.insert(schema.categories).values(rows).onConflictDoUpdate({ target: schema.categories.id, set: excludedSet(schema.categories) });
}

export interface Database {
  adapter: PersistenceAdapter;
  ping(): Promise<void>;
  close(): Promise<void>;
  kind: 'postgres' | 'embedded';
}

export async function connectDatabase(cfg: ServerConfig): Promise<Database> {
  const migrationsFolder = path.resolve(process.env.MIGRATIONS_DIR || 'db/migrations');
  let db: any;
  let close: () => Promise<void>;
  let kind: Database['kind'];

  if (cfg.databaseUrl) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const client = postgres(cfg.databaseUrl, { max: 5, onnotice: () => {} });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    await syncCategories(db);
    close = () => client.end();
    kind = 'postgres';
  } else {
    if (cfg.isProduction) throw new Error('DATABASE_URL is required in production.');
    // Local development and tests: embedded Postgres (PGlite), same SQL and migrations.
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    if (!cfg.localDataDir.startsWith('memory://')) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(cfg.localDataDir, { recursive: true });
    }
    const client = new PGlite(cfg.localDataDir);
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    await syncCategories(db);
    close = () => client.close();
    kind = 'embedded';
  }

  const adapter: PersistenceAdapter = {
    async load() {
      const out: Partial<Record<Collection, any[]>> = {};
      for (const name of COLLECTIONS) out[name] = await db.select().from(TABLES[name]);
      return out;
    },
    async save(writes: PendingWrite[]) {
      await db.transaction(async (tx: any) => {
        for (const name of COLLECTIONS) {
          const rows = writes.filter((w) => w.collection === name && w.record).map((w) => w.record);
          const table = TABLES[name];
          for (let i = 0; i < rows.length; i += BATCH) {
            await tx
              .insert(table)
              .values(rows.slice(i, i + BATCH))
              .onConflictDoUpdate({ target: (table as any).id, set: excludedSet(table) });
          }
        }
        for (const name of [...COLLECTIONS].reverse()) {
          const ids = writes.filter((w) => w.collection === name && !w.record).map((w) => w.id);
          if (ids.length) await tx.delete(TABLES[name]).where(inArray((TABLES[name] as any).id, ids));
        }
      });
    },
  };

  return {
    adapter,
    kind,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close,
  };
}
