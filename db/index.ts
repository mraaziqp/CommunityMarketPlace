import * as schema from './schema';
import { INITIAL_LISTINGS } from '../src/data/mockListings';

/**
 * ============================================================================
 * SHAREHUB DATA LAYER — SERVER STORE WITH POSTGRES WRITE-THROUGH
 *
 * The server keeps the working set in typed Maps (fast, synchronous business
 * logic) and Postgres is the system of record:
 *
 * 1. On boot, every table is loaded into memory (`hydrate`).
 * 2. Mutations mark records dirty. `runExclusive` wraps each write request:
 *    it runs the action, then `commit` writes every dirty record to Postgres
 *    in one database transaction. If the action or the commit fails, memory
 *    is restored to its pre-request snapshot, so memory and database never
 *    diverge.
 * 3. Write requests run one at a time (a single-writer mutex), which keeps
 *    the snapshot/commit sequence consistent.
 *
 * Consequence: run exactly ONE server instance against a database. Scaling
 * out horizontally requires moving the actions to direct SQL first.
 * ============================================================================
 */

export const COLLECTIONS = [
  'users',
  'accounts',
  'sessions',
  'trustGroups',
  'groupMemberships',
  'listings',
  'pricingTiers',
  'userSubscriptions',
  'bookings',
  'payments',
  'usageLogs',
  'conditionLogs',
  'conversations',
  'messages',
  'reviews',
  'systemLogs',
] as const;

/** Parent tables before children, so upserts satisfy foreign keys (deletes run in reverse). */
export type Collection = (typeof COLLECTIONS)[number];

export type PendingWrite = { collection: Collection; id: string; record: any | null };

export interface PersistenceAdapter {
  load(): Promise<Partial<Record<Collection, any[]>>>;
  /** Applies upserts (record set) and deletes (record null) atomically. */
  save(writes: PendingWrite[]): Promise<void>;
}

let trackingSuspended = 0;
const dirty = new Map<Collection, Set<string>>();

function markDirty(collection: Collection, id: string) {
  if (trackingSuspended > 0) return;
  let ids = dirty.get(collection);
  if (!ids) dirty.set(collection, (ids = new Set()));
  ids.add(id);
}

function untracked<T>(fn: () => T): T {
  trackingSuspended++;
  try {
    return fn();
  } finally {
    trackingSuspended--;
  }
}

/** A Map that records which ids changed so they can be written to Postgres. */
export class TrackedMap<V> extends Map<string, V> {
  collection!: Collection;

  static create<V>(collection: Collection, source?: Iterable<[string, V]>): TrackedMap<V> {
    const map = new TrackedMap<V>();
    map.collection = collection;
    if (source) untracked(() => { for (const [k, v] of source) map.set(k, v); });
    return map;
  }

  set(key: string, value: V): this {
    super.set(key, value);
    if (this.collection) markDirty(this.collection, key);
    return this;
  }

  delete(key: string): boolean {
    const removed = super.delete(key);
    if (removed && this.collection) markDirty(this.collection, key);
    return removed;
  }

  clear(): void {
    if (this.collection) for (const key of this.keys()) markDirty(this.collection, key);
    super.clear();
  }
}

class MemoryStore {
  users = TrackedMap.create<schema.User>('users');
  accounts = TrackedMap.create<typeof schema.accounts.$inferSelect>('accounts');
  sessions = TrackedMap.create<typeof schema.sessions.$inferSelect>('sessions');
  trustGroups = TrackedMap.create<schema.TrustGroup>('trustGroups');
  groupMemberships = TrackedMap.create<schema.GroupMembership>('groupMemberships');
  listings = TrackedMap.create<schema.Listing>('listings');
  pricingTiers = TrackedMap.create<schema.PricingTier>('pricingTiers');
  userSubscriptions = TrackedMap.create<schema.UserSubscription>('userSubscriptions');
  bookings = TrackedMap.create<schema.Booking>('bookings');
  payments = TrackedMap.create<schema.Payment>('payments');
  usageLogs = TrackedMap.create<schema.UsageLog>('usageLogs');
  conditionLogs = TrackedMap.create<schema.ConditionLog>('conditionLogs');
  conversations = TrackedMap.create<schema.Conversation>('conversations');
  messages = TrackedMap.create<schema.Message>('messages');
  reviews = TrackedMap.create<schema.Review>('reviews');
  systemLogs = TrackedMap.create<schema.SystemLog>('systemLogs');

  private adapter: PersistenceAdapter | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** Called with records created or changed by each successful commit (outbound webhooks). */
  onCommitted: ((writes: PendingWrite[]) => void) | null = null;

  collection(name: Collection): TrackedMap<any> {
    return (this as any)[name] as TrackedMap<any>;
  }

  /** Loads every table from Postgres into memory. */
  async hydrate(adapter: PersistenceAdapter) {
    this.adapter = adapter;
    const data = await adapter.load();
    untracked(() => {
      for (const name of COLLECTIONS) {
        const map = this.collection(name);
        map.clear();
        for (const row of data[name] ?? []) map.set(row.id, row);
      }
    });
    dirty.clear();
  }

  isEmpty() {
    return this.users.size === 0 && this.listings.size === 0;
  }

  /** Writes all dirty records to Postgres in one transaction. */
  async commit() {
    const writes: PendingWrite[] = [];
    for (const name of COLLECTIONS) {
      const ids = dirty.get(name);
      if (!ids) continue;
      const map = this.collection(name);
      for (const id of ids) writes.push({ collection: name, id, record: map.get(id) ?? null });
    }
    if (writes.length === 0) return;
    if (this.adapter) await this.adapter.save(writes);
    dirty.clear();
    this.onCommitted?.(writes);
  }

  private snapshot() {
    const copy = {} as Record<Collection, Map<string, any>>;
    for (const name of COLLECTIONS) copy[name] = new Map(this.collection(name));
    return { copy, dirty: new Map(Array.from(dirty, ([k, v]) => [k, new Set(v)])) };
  }

  private restore(snap: ReturnType<MemoryStore['snapshot']>) {
    untracked(() => {
      for (const name of COLLECTIONS) {
        const map = this.collection(name);
        Map.prototype.clear.call(map);
        for (const [k, v] of snap.copy[name]) Map.prototype.set.call(map, k, v);
      }
    });
    dirty.clear();
    for (const [k, v] of snap.dirty) dirty.set(k, v);
  }

  /**
   * Runs a write as a unit of work: one writer at a time, committed to
   * Postgres on success, fully rolled back in memory on any failure.
   */
  runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = async () => {
      const snap = this.snapshot();
      try {
        const result = await fn();
        await this.commit();
        return result;
      } catch (err) {
        this.restore(snap);
        throw err;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Deletes everything (tests only). */
  resetForTests() {
    untracked(() => {
      for (const name of COLLECTIONS) this.collection(name).clear();
    });
    dirty.clear();
  }

  /** Demo neighbourhood for development and demos. Never seeded in production. */
  seedDemoData({ includeAdmin }: { includeAdmin: boolean }) {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const daysFromNow = (days: number, hour = 9) => {
      const d = new Date(now.getTime() + days * dayMs);
      d.setHours(hour, 0, 0, 0);
      return d;
    };
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Every host in the demo catalogue is a real user record, so a listing's
    // owner can be looked up, reviewed, and signed in as in development.
    for (const item of INITIAL_LISTINGS) {
      if (this.users.has(item.owner.id)) continue;
      const [first, ...rest] = item.owner.name.toLowerCase().split(' ');
      this.users.set(item.owner.id, {
        id: item.owner.id,
        name: item.owner.name,
        email: `${first}.${rest.join('') || 'host'}@sharehub.example`,
        emailVerified: true,
        role: item.owner.isSuperHost ? 'VERIFIED_HOST' : 'USER',
        image: item.owner.image,
        phoneNumber: null,
        bio: null,
        neighborhood: item.owner.neighborhood,
        trustScore: item.owner.trustScore,
        isHost: true,
        suspendedAt: null,
        createdAt: new Date('2026-01-10'),
        updatedAt: new Date('2026-01-10'),
      });
    }

    // The demo member whose activity (a co-op membership and two rentals) is
    // seeded below.
    this.users.set('usr_me', {
      id: 'usr_me',
      name: 'Alex Rivera',
      email: 'alex.rivera@sharehub.example',
      emailVerified: true,
      role: 'USER',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      phoneNumber: null,
      bio: 'Neighbour, weekend DIYer and laundry co-op member.',
      neighborhood: 'Observatory',
      trustScore: 97,
      isHost: false,
      suspendedAt: null,
      createdAt: new Date('2026-01-10'),
      updatedAt: new Date('2026-01-10'),
    });

    // Development-only operator account for exercising the admin dashboard.
    if (includeAdmin) {
      this.users.set('usr_admin_01', {
        id: 'usr_admin_01',
        name: 'ShareHub Team',
        email: 'admin@sharehub.example',
        emailVerified: true,
        role: 'ADMIN',
        image: null,
        phoneNumber: null,
        bio: null,
        neighborhood: 'City Bowl',
        trustScore: 100,
        isHost: false,
        suspendedAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });
    }

    for (const item of INITIAL_LISTINGS) {
      this.listings.set(item.id, {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category as any,
        categoryId: item.categoryId || null,
        ownerId: item.owner.id,
        address: item.address,
        neighborhood: item.neighborhood,
        city: item.city,
        latitude: item.latitude != null ? String(item.latitude) : null,
        longitude: item.longitude != null ? String(item.longitude) : null,
        images: item.images,
        rules: item.rules || null,
        depositRequiredInCents: item.depositRequiredInCents,
        maxSubscribers: item.maxSubscribers,
        currentSubscribersCount: item.currentSubscribersCount,
        isAvailable: item.isAvailable,
        visibilityGroupId: item.visibilityGroupId || null,
        accessMethod: item.accessMethod,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
      });

      for (const tier of item.pricingTiers) {
        this.pricingTiers.set(tier.id, {
          id: tier.id,
          listingId: item.id,
          name: tier.name,
          description: tier.description || null,
          type: tier.type as any,
          priceInCents: tier.priceInCents,
          currency: tier.currency,
          usageLimitPerPeriod: tier.usageLimitPerPeriod ?? null,
          periodUnit: tier.periodUnit as any,
          periodDuration: tier.periodDuration,
          maxActiveSubscribers: tier.maxActiveSubscribers ?? null,
          isPopular: tier.isPopular || false,
          isActive: tier.isActive,
          createdAt: new Date('2026-02-01'),
        });
      }
    }

    // Alex is one of the households in the Observatory washer co-op (the
    // listing's seeded subscriber count already includes them).
    const washer = INITIAL_LISTINGS.find((l) => l.id === 'list_wm_001')!;
    const washerTier = washer.pricingTiers[0];
    this.userSubscriptions.set('sub_demo_washer', {
      id: 'sub_demo_washer',
      userId: 'usr_me',
      listingId: washer.id,
      pricingTierId: washerTier.id,
      status: 'active',
      remainingUsesThisPeriod: (washerTier.usageLimitPerPeriod || 10) - 2,
      totalUsesUsed: 2,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      renewsAt: periodEnd,
      cancelledAt: null,
      stripeSubscriptionId: null,
      gatewayToken: null,
      createdAt: new Date('2026-06-01'),
      updatedAt: now,
    });

    const cycles = [
      { id: 'usage_demo_1', at: new Date(periodStart.getTime() + 8 * 3600000), notes: 'Cotton 40°C (60 min)' },
      { id: 'usage_demo_2', at: new Date(periodStart.getTime() + 18 * 3600000), notes: 'Quick wash 30°C (15 min)' },
    ];
    for (const cycle of cycles) {
      this.usageLogs.set(cycle.id, {
        id: cycle.id,
        subscriptionId: 'sub_demo_washer',
        listingId: washer.id,
        userId: 'usr_me',
        startedAt: cycle.at,
        endedAt: null,
        unitsUsed: 1,
        status: 'completed',
        notes: cycle.notes,
        verificationCode: null,
        createdAt: cycle.at,
      });
      this.systemLogs.set(`log_${cycle.id}`, {
        id: `log_${cycle.id}`,
        eventType: 'FRACTIONAL_USE_LOGGED',
        userId: 'usr_me',
        targetId: 'sub_demo_washer',
        metadata: { listingId: washer.id, listingTitle: washer.title, notes: cycle.notes },
        createdAt: cycle.at,
      });
    }

    // An upcoming, already-paid rental waiting for pickup.
    const scanner = INITIAL_LISTINGS.find((l) => l.id === 'list_obd_001')!;
    const scannerTier = scanner.pricingTiers[0];
    this.bookings.set('book_demo_scanner', {
      id: 'book_demo_scanner',
      listingId: scanner.id,
      renterId: 'usr_me',
      pricingTierId: scannerTier.id,
      status: 'PENDING_HANDOVER',
      disputeStatus: 'NONE',
      returnConditionLogId: null,
      verificationCode: 'PICKUP-4821',
      totalAmountInCents: scannerTier.priceInCents * 2,
      depositAmountInCents: scanner.depositRequiredInCents,
      startDate: daysFromNow(1, 9),
      endDate: daysFromNow(3, 9),
      handoverCompletedAt: null,
      handoverNotes: null,
      createdAt: daysFromNow(-1, 14),
      updatedAt: daysFromNow(-1, 14),
    });
    this.payments.set('pay_demo_scanner', {
      id: 'pay_demo_scanner',
      kind: 'booking',
      bookingId: 'book_demo_scanner',
      subscriptionId: null,
      payerId: 'usr_me',
      provider: 'demo',
      hostPayoutStatus: 'none',
      hostPayoutInCents: 0,
      depositRefundStatus: 'none',
      amount: scannerTier.priceInCents * 2 + scanner.depositRequiredInCents,
      currency: 'ZAR',
      status: 'HELD_IN_ESCROW',
      paymentGatewayRef: null,
      gatewayToken: null,
      escrowReleasedAt: null,
      createdAt: daysFromNow(-1, 14),
      updatedAt: daysFromNow(-1, 14),
    });
    this.systemLogs.set('log_demo_scanner_booked', {
      id: 'log_demo_scanner_booked',
      eventType: 'BOOKING_CREATED',
      userId: 'usr_me',
      targetId: 'book_demo_scanner',
      metadata: { listingId: scanner.id, listingTitle: scanner.title },
      createdAt: daysFromNow(-1, 14),
    });

    // A finished rental that has not been reviewed yet.
    const cargoBox = INITIAL_LISTINGS.find((l) => l.id === 'list_thule_001')!;
    const cargoTier = cargoBox.pricingTiers[0];
    this.bookings.set('book_demo_cargo', {
      id: 'book_demo_cargo',
      listingId: cargoBox.id,
      renterId: 'usr_me',
      pricingTierId: cargoTier.id,
      status: 'COMPLETED',
      disputeStatus: 'NONE',
      returnConditionLogId: null,
      verificationCode: 'PICKUP-1937',
      totalAmountInCents: cargoTier.priceInCents * 3,
      depositAmountInCents: cargoBox.depositRequiredInCents,
      startDate: daysFromNow(-12, 8),
      endDate: daysFromNow(-9, 8),
      handoverCompletedAt: daysFromNow(-12, 8),
      handoverNotes: null,
      createdAt: daysFromNow(-15, 11),
      updatedAt: daysFromNow(-9, 10),
    });
    this.payments.set('pay_demo_cargo', {
      id: 'pay_demo_cargo',
      kind: 'booking',
      bookingId: 'book_demo_cargo',
      subscriptionId: null,
      payerId: 'usr_me',
      provider: 'demo',
      hostPayoutStatus: 'done',
      hostPayoutInCents: Math.round(cargoTier.priceInCents * 3 * 0.9),
      depositRefundStatus: 'done',
      amount: cargoTier.priceInCents * 3 + cargoBox.depositRequiredInCents,
      currency: 'ZAR',
      status: 'CAPTURED',
      paymentGatewayRef: null,
      gatewayToken: null,
      escrowReleasedAt: daysFromNow(-9, 10),
      createdAt: daysFromNow(-15, 11),
      updatedAt: daysFromNow(-9, 10),
    });
    this.systemLogs.set('log_demo_cargo_returned', {
      id: 'log_demo_cargo_returned',
      eventType: 'HANDOVER_COMPLETED',
      userId: cargoBox.owner.id,
      targetId: 'book_demo_cargo',
      metadata: { listingId: cargoBox.id, listingTitle: cargoBox.title, stage: 'return', conditionStatus: 'GOOD' },
      createdAt: daysFromNow(-9, 10),
    });

    // Private circles. Member counts are derived from memberships at read
    // time; the stored figure is only a cache.
    const groups = [
      {
        id: 'grp_obs_ecovillage',
        name: 'Observatory Eco-Village',
        description: 'Neighbours in Observatory sharing laundry, solar power and garden tools.',
        inviteCode: 'OBSECO-42',
        adminId: 'usr_sarah',
        icon: 'ShieldCheck',
      },
      {
        id: 'grp_woodstock_coop',
        name: 'Woodstock Makers Co-Op',
        description: 'Makers and artisans sharing power tools, printers and workshop space.',
        inviteCode: 'WDSTCK-88',
        adminId: 'usr_elena',
        icon: 'Hammer',
      },
      {
        id: 'grp_uct_innovation',
        name: 'UCT Design & Hardware Lab',
        description: 'Students and researchers sharing 3D printers, soldering stations and studio mics.',
        inviteCode: 'UCTDES-99',
        adminId: 'usr_thandeka',
        icon: 'Cpu',
      },
    ];
    const memberships: [string, string][] = [
      ['grp_obs_ecovillage', 'usr_sarah'],
      ['grp_obs_ecovillage', 'usr_me'],
      ['grp_woodstock_coop', 'usr_elena'],
      ['grp_woodstock_coop', 'usr_johan'],
      ['grp_woodstock_coop', 'usr_me'],
      ['grp_uct_innovation', 'usr_thandeka'],
    ];
    for (const g of groups) {
      this.trustGroups.set(g.id, {
        ...g,
        memberCount: memberships.filter(([groupId]) => groupId === g.id).length,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
      });
    }
    memberships.forEach(([groupId, userId], i) => {
      this.groupMemberships.set(`mem_seed_${i}`, {
        id: `mem_seed_${i}`,
        groupId,
        userId,
        status: 'ACTIVE',
        joinedAt: new Date('2026-02-15'),
      });
    });
  }
}

export const memoryStore = new MemoryStore();

/**
 * Drizzle-shaped facade kept so action code reads like data access. Filtered
 * reads and updates cannot be evaluated against the Maps, so they fail loudly
 * instead of silently acting on whichever record happens to be first.
 * `transaction` is a pass-through: atomicity comes from `runExclusive`.
 */
function unsupportedWhere(operation: string): (...args: any[]) => never {
  return () => {
    throw new Error(`db.${operation} is not supported; read the record from memoryStore by id instead.`);
  };
}

function createDbInstance() {
  const query = {
    listings: {
      findMany: async () => Array.from(memoryStore.listings.values()).filter((l) => l.isAvailable !== false),
      findFirst: unsupportedWhere('listings.findFirst'),
    },
    users: { findMany: async () => Array.from(memoryStore.users.values()), findFirst: unsupportedWhere('users.findFirst') },
    userSubscriptions: { findFirst: unsupportedWhere('userSubscriptions.findFirst') },
    bookings: { findFirst: unsupportedWhere('bookings.findFirst') },
  };
  return {
    query,
    select: () => ({ from: () => ({ where: unsupportedWhere('select().where') }) }),
    update: () => ({ set: () => ({ where: unsupportedWhere('update().where') }) }),
    transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => callback({ query }),
  };
}

export const db = createDbInstance();
export default db;
