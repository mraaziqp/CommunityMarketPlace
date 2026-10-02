import { randomBytes } from 'node:crypto';
import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema';
import { memoryStore, type Collection } from '../db';
import { ClientError } from './http';

/**
 * Generic, schema-driven record access for the bot API.
 *
 * Writes are coerced and checked against the same Drizzle schema Postgres
 * uses (types, enums, required fields, defaults), so the in-memory copy and
 * the database row always agree. Foreign keys are enforced by Postgres at
 * commit; a violation rolls the whole request back.
 */

/** Collections the bot can see and change. Credentials and sessions are never exposed. */
export const BOT_COLLECTIONS = {
  users: schema.users,
  trustGroups: schema.trustGroups,
  groupMemberships: schema.groupMemberships,
  listings: schema.listings,
  pricingTiers: schema.pricingTiers,
  userSubscriptions: schema.userSubscriptions,
  bookings: schema.bookings,
  payments: schema.payments,
  usageLogs: schema.usageLogs,
  conditionLogs: schema.conditionLogs,
  reviews: schema.reviews,
  systemLogs: schema.systemLogs,
} satisfies Partial<Record<Collection, PgTable>>;

export type BotCollection = keyof typeof BOT_COLLECTIONS;

export function asBotCollection(name: string): BotCollection {
  if (!(name in BOT_COLLECTIONS)) {
    throw new ClientError(`Unknown collection "${name}". Available: ${Object.keys(BOT_COLLECTIONS).join(', ')}`, 404);
  }
  return name as BotCollection;
}

type ColumnInfo = { key: string; name: string; type: string; notNull: boolean; hasDefault: boolean; enumValues?: string[]; isArray: boolean };

export function describeColumns(collection: BotCollection): ColumnInfo[] {
  return Object.entries(getTableColumns(BOT_COLLECTIONS[collection])).map(([key, col]: [string, any]) => ({
    key,
    name: col.name,
    type: col.columnType,
    notNull: col.notNull,
    hasDefault: col.hasDefault,
    enumValues: col.enumValues,
    isArray: col.columnType === 'PgArray',
  }));
}

function coerceValue(col: ColumnInfo, value: unknown, key: string): unknown {
  if (value === null || value === undefined) return value;
  switch (col.type) {
    case 'PgTimestamp': {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) throw new ClientError(`"${key}" must be a date.`);
      return d;
    }
    case 'PgInteger': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(n)) throw new ClientError(`"${key}" must be a whole number.`);
      return n;
    }
    case 'PgBoolean':
      if (typeof value !== 'boolean') throw new ClientError(`"${key}" must be true or false.`);
      return value;
    case 'PgArray':
      if (!Array.isArray(value)) throw new ClientError(`"${key}" must be an array.`);
      return value.map(String);
    case 'PgJsonb':
      return value;
    default:
      if (typeof value === 'object') throw new ClientError(`"${key}" must be text.`);
      if (col.enumValues && !col.enumValues.includes(String(value))) {
        throw new ClientError(`"${key}" must be one of: ${col.enumValues.join(', ')}.`);
      }
      return String(value);
  }
}

function defaultFor(col: ColumnInfo, raw: any) {
  if (col.type === 'PgTimestamp') return new Date();
  const d = raw.default;
  // SQL expressions (e.g. now()) cannot be evaluated here; literal defaults can.
  const isSqlExpression = d && typeof d === 'object' && 'queryChunks' in d;
  if (d !== undefined && !isSqlExpression) return typeof d === 'object' ? structuredClone(d) : d;
  return col.notNull ? undefined : null;
}

/** Builds a full, schema-valid record from partial input (create) or a patch over an existing one. */
export function buildRecord(collection: BotCollection, input: Record<string, unknown>, existing?: Record<string, any>) {
  const table = BOT_COLLECTIONS[collection];
  const rawColumns = getTableColumns(table) as Record<string, any>;
  const out: Record<string, any> = existing ? { ...existing } : {};

  for (const key of Object.keys(input)) {
    if (!(key in rawColumns)) throw new ClientError(`Unknown field "${key}" on ${collection}.`);
  }
  if (existing && 'id' in input && input.id !== existing.id) throw new ClientError('The id of a record cannot be changed.');

  for (const col of describeColumns(collection)) {
    if (col.key in input) {
      out[col.key] = coerceValue(col, input[col.key], col.key);
    } else if (!existing) {
      out[col.key] = col.key === 'id' ? `${collection.slice(0, 4)}_${Date.now()}_${randomBytes(4).toString('hex')}` : defaultFor(col, rawColumns[col.key]);
    }
    if (out[col.key] === null && col.notNull) throw new ClientError(`"${col.key}" is required on ${collection}.`);
    if (out[col.key] === undefined) {
      if (col.notNull) throw new ClientError(`"${col.key}" is required on ${collection}.`);
      out[col.key] = null;
    }
  }
  if (existing && 'updatedAt' in rawColumns && !('updatedAt' in input)) out.updatedAt = new Date();
  return out;
}

export function listRecords(
  collection: BotCollection,
  opts: { limit: number; cursor?: string; updatedSince?: Date; filters: Record<string, string> }
) {
  const cols = describeColumns(collection);
  for (const key of Object.keys(opts.filters)) {
    if (!cols.some((c) => c.key === key)) throw new ClientError(`Unknown filter field "${key}".`);
  }
  const hasUpdated = cols.some((c) => c.key === 'updatedAt');
  const rows = Array.from(memoryStore.collection(collection).values())
    .filter((r: any) => {
      if (opts.updatedSince) {
        const stamp: Date = hasUpdated ? r.updatedAt : r.createdAt ?? r.joinedAt ?? r.startedAt;
        if (!stamp || stamp < opts.updatedSince) return false;
      }
      for (const [k, v] of Object.entries(opts.filters)) if (String(r[k]) !== v) return false;
      return true;
    })
    .sort((a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const start = opts.cursor ? rows.findIndex((r: any) => r.id > opts.cursor!) : 0;
  const page = start < 0 ? [] : rows.slice(start, start + opts.limit);
  const nextCursor = start >= 0 && start + opts.limit < rows.length ? page[page.length - 1]?.id : null;
  return { data: page, nextCursor, total: rows.length };
}

/** Upserts records into the store (the surrounding runExclusive commits or rolls back). */
export function writeRecords(collection: BotCollection, records: Record<string, unknown>[], mode: 'upsert' | 'insert') {
  const map = memoryStore.collection(collection);
  const written: string[] = [];
  records.forEach((input, index) => {
    try {
      const existing = typeof input.id === 'string' ? map.get(input.id) : undefined;
      if (existing && mode === 'insert') throw new ClientError(`A record with id "${input.id}" already exists.`, 409);
      const record = existing ? buildRecord(collection, input, existing) : buildRecord(collection, input);
      map.set(record.id, record);
      written.push(record.id);
    } catch (err) {
      if (err instanceof ClientError) throw new ClientError(`${collection}[${index}]: ${err.message}`, err.status);
      throw err;
    }
  });
  return written;
}
