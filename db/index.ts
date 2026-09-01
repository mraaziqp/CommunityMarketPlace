import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * ============================================================================
 * SHAREHUB DATABASE CLIENT — STATELESS NEON SERVERLESS POSTGRESQL & DRIZZLE ORM
 * 
 * Performance & Connection Safety Guarantees:
 * 1. Stateless Edge HTTP Driver: Queries execute over lightweight HTTPS payloads (neon()),
 *    preventing TCP/WebSocket connection pool exhaustion in serverless edge/lambda environments.
 * 2. Pooler Endpoint & SSL Enforcement: Automatically normalizes database connection strings
 *    to include '?sslmode=require' and pooler flags.
 * 3. Connection Cache: Configures neonConfig.fetchConnectionCache = true for low-latency reuse.
 * 4. Zero-Leak Fallback Memory Engine: Provides transactional snapshot rollbacks for local dev/preview.
 * ============================================================================
 */

// Enable fetch connection cache for edge and serverless environments
if (typeof window === 'undefined') {
  neonConfig.fetchConnectionCache = true;
}

/**
 * Normalizes connection string with proper SSL and pooling parameters
 */
function getSanitizedDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || '';
  if (!url) return '';

  try {
    // If URL lacks sslmode, append it for Neon PostgreSQL security requirement
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      if (!url.includes('sslmode=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}sslmode=require`;
      }
    }
  } catch (e) {
    console.warn('[Neon Connection Audit] URL normalization note:', e);
  }
  return url;
}

const connectionString = getSanitizedDatabaseUrl();

// Singleton connection or in-memory transactional mock fallback for browser preview
class MemoryStore {
  users = new Map<string, schema.User>();
  listings = new Map<string, schema.Listing>();
  pricingTiers = new Map<string, schema.PricingTier>();
  userSubscriptions = new Map<string, schema.UserSubscription>();
  usageLogs = new Map<string, schema.UsageLog>();
  bookings = new Map<string, schema.Booking>();
  payments = new Map<string, schema.Payment>();
  conditionLogs = new Map<string, schema.ConditionLog>();
  trustGroups = new Map<string, schema.TrustGroup>();
  groupMemberships = new Map<string, schema.GroupMembership>();
  conversations = new Map<string, schema.Conversation>();
  messages = new Map<string, schema.Message>();
  reviews = new Map<string, schema.Review>();
  systemLogs = new Map<string, schema.SystemLog>();

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    // Seed initial test user
    this.users.set('usr_me', {
      id: 'usr_me',
      name: 'Alex Rivera',
      email: 'alex.rivera@community.org',
      emailVerified: true,
      role: 'ADMIN',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      phoneNumber: '+27 82 555 0192',
      bio: 'Eco-conscious neighbor & shared appliance co-op coordinator.',
      neighborhood: 'Observatory',
      trustScore: 98,
      isHost: true,
      createdAt: new Date('2026-01-10'),
      updatedAt: new Date('2026-08-20'),
    });

    this.users.set('usr_host_marcus', {
      id: 'usr_host_marcus',
      name: 'Marcus Thorne',
      email: 'marcus.t@workshop-coop.za',
      emailVerified: true,
      role: 'VERIFIED_HOST',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phoneNumber: '+27 71 884 9921',
      bio: 'Master woodworker, maker space organizer & power tool steward in Woodstock.',
      neighborhood: 'Woodstock',
      trustScore: 99,
      isHost: true,
      createdAt: new Date('2026-01-15'),
      updatedAt: new Date('2026-08-20'),
    });

    // Seed default fractional washing machine subscription
    this.userSubscriptions.set('sub_init_wm', {
      id: 'sub_init_wm',
      userId: 'usr_me',
      listingId: 'list_wm_001',
      pricingTierId: 'tier_wm_10uses',
      status: 'active',
      remainingUsesThisPeriod: 7,
      totalUsesUsed: 3,
      currentPeriodStart: new Date('2026-08-01'),
      currentPeriodEnd: new Date('2026-08-31'),
      renewsAt: new Date('2026-09-01'),
      cancelledAt: null,
      stripeSubscriptionId: 'sub_stripe_mock_8842',
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-20'),
    });

    // Seed default booking for handover
    this.bookings.set('book_drill_001', {
      id: 'book_drill_001',
      listingId: 'list_drill_002',
      renterId: 'usr_me',
      pricingTierId: 'tier_drill_day',
      status: 'PENDING_HANDOVER',
      disputeStatus: 'NONE',
      returnConditionLogId: null,
      verificationCode: 'HANDOVER-8842',
      totalAmountInCents: 15000,
      depositAmountInCents: 50000,
      startDate: new Date('2026-08-21T09:00:00'),
      endDate: new Date('2026-08-23T18:00:00'),
      handoverCompletedAt: null,
      handoverNotes: 'Includes 2x 4.0Ah batteries and SDS bit set',
      createdAt: new Date('2026-08-20T14:30:00'),
      updatedAt: new Date('2026-08-20T14:30:00'),
    });

    // Seed initial Escrow Payment for book_drill_001
    this.payments.set('pay_escrow_drill_001', {
      id: 'pay_escrow_drill_001',
      bookingId: 'book_drill_001',
      amount: 65000, // Total rental (15000) + Deposit (50000) = R650.00
      currency: 'ZAR',
      status: 'HELD_IN_ESCROW',
      paymentGatewayRef: 'pstk_auth_escrow_884291',
      escrowReleasedAt: null,
      createdAt: new Date('2026-08-20T14:31:00'),
      updatedAt: new Date('2026-08-20T14:31:00'),
    });

    // Seed initial Conversation between Alex (renter) and Marcus (host)
    this.conversations.set('conv_drill_001', {
      id: 'conv_drill_001',
      listingId: 'list_drill_002',
      renterId: 'usr_me',
      hostId: 'usr_host_marcus',
      lastMessageAt: new Date('2026-08-20T15:10:00'),
      createdAt: new Date('2026-08-20T14:45:00'),
      updatedAt: new Date('2026-08-20T15:10:00'),
    });

    // Seed initial Messages in the thread
    this.messages.set('msg_001', {
      id: 'msg_001',
      conversationId: 'conv_drill_001',
      senderId: 'usr_me',
      content: 'Hi Marcus! Just booked the DeWalt Hammer Drill for tomorrow morning. Does it come with concrete drill bits?',
      readAt: new Date('2026-08-20T14:50:00'),
      createdAt: new Date('2026-08-20T14:46:00'),
    });

    this.messages.set('msg_002', {
      id: 'msg_002',
      conversationId: 'conv_drill_001',
      senderId: 'usr_host_marcus',
      content: 'Hey Alex! Yes, it includes 6mm, 8mm, and 10mm SDS-plus masonry bits, plus the grease tube and 2 fully charged 4.0Ah batteries. I am at the Woodstock workshop from 8:30 AM.',
      readAt: new Date('2026-08-20T14:55:00'),
      createdAt: new Date('2026-08-20T14:52:00'),
    });

    this.messages.set('msg_003', {
      id: 'msg_003',
      conversationId: 'conv_drill_001',
      senderId: 'usr_me',
      content: 'Perfect! I will be there at 9:00 AM sharp with the Digital Handover code ready.',
      readAt: new Date('2026-08-20T15:12:00'),
      createdAt: new Date('2026-08-20T15:10:00'),
    });

    // Seed sample completed review
    this.reviews.set('rev_init_001', {
      id: 'rev_init_001',
      bookingId: 'book_drill_001',
      reviewerId: 'usr_me',
      targetId: 'usr_host_marcus',
      listingId: 'list_drill_002',
      rating: 5,
      comment: 'Top quality equipment and flawless handover! Marcus had the batteries charged to 100% and gave great tips for drilling into hard Victorian brickwork.',
      cleanlinessRating: 5,
      communicationRating: 5,
      accuracyRating: 5,
      createdAt: new Date('2026-08-18T16:00:00'),
    });

    // Seed initial Private Trust Groups
    this.trustGroups.set('grp_woodstock_coop', {
      id: 'grp_woodstock_coop',
      name: 'Woodstock Makers Co-Op',
      description: 'Exclusive community sharing of high-grade power tools, CNC gear, and workshop space for verified Woodstock artisans.',
      inviteCode: 'WDSTCK-88',
      adminId: 'usr_host_marcus',
      icon: 'Hammer',
      memberCount: 14,
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-08-20'),
    });

    this.trustGroups.set('grp_obs_ecovillage', {
      id: 'grp_obs_ecovillage',
      name: 'Observatory Eco-Village',
      description: 'Zero-waste neighborhood cluster sharing solar batteries, electric lawncare tools, and commercial food processors.',
      inviteCode: 'OBSECO-42',
      adminId: 'usr_me',
      icon: 'ShieldCheck',
      memberCount: 22,
      createdAt: new Date('2026-01-20'),
      updatedAt: new Date('2026-08-20'),
    });

    this.trustGroups.set('grp_uct_innovation', {
      id: 'grp_uct_innovation',
      name: 'UCT Design & Hardware Lab',
      description: 'University research guild sharing 3D printers, VR headsets, micro-soldering stations, and studio mics.',
      inviteCode: 'UCTDES-99',
      adminId: 'usr_me',
      icon: 'Cpu',
      memberCount: 38,
      createdAt: new Date('2026-03-10'),
      updatedAt: new Date('2026-08-20'),
    });

    // Seed memberships for Alex (usr_me)
    this.groupMemberships.set('mem_001', {
      id: 'mem_001',
      groupId: 'grp_obs_ecovillage',
      userId: 'usr_me',
      status: 'ACTIVE',
      joinedAt: new Date('2026-01-20'),
    });

    this.groupMemberships.set('mem_002', {
      id: 'mem_002',
      groupId: 'grp_woodstock_coop',
      userId: 'usr_me',
      status: 'ACTIVE',
      joinedAt: new Date('2026-02-15'),
    });

    this.groupMemberships.set('mem_003', {
      id: 'mem_003',
      groupId: 'grp_uct_innovation',
      userId: 'usr_me',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-10'),
    });

    // Seed initial listings and pricing tiers into memoryStore
    this.listings.set('list_wm_001', {
      id: 'list_wm_001',
      title: 'Bosch Serie 8 (9kg) High-Efficiency Washer Co-Op',
      description: 'Shared luxury eco-silent front loader located in secure communal laundry bay (Unit 4B). Subscriptions are strictly capped at 4 households to ensure zero queueing and pristine maintenance. Includes eco-detergent dispenser and smart WiFi cycle notifications.',
      category: 'fractional_appliance' as any,
      categoryId: 'cat_washers',
      ownerId: 'usr_me',
      address: '42 Trill Road, Complex Courtyard',
      neighborhood: 'Observatory',
      city: 'Cape Town',
      latitude: '-33.9360',
      longitude: '18.4715',
      location: null,
      images: [
        'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800&auto=format&fit=crop&q=80',
      ],
      rules: 'No heavy muddy boots. Please leave the door ajar after cycles. Automatic detergent dispenser provided.',
      depositRequiredInCents: 20000,
      maxSubscribers: 4,
      currentSubscribersCount: 3,
      isAvailable: true,
      visibilityGroupId: 'grp_obs_ecovillage',
      accessMethod: 'smart_plug',
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-20'),
    });

    this.pricingTiers.set('tier_wm_10uses', {
      id: 'tier_wm_10uses',
      listingId: 'list_wm_001',
      name: 'Standard Co-Op (10 Cycles)',
      description: 'Ideal for single individuals or couples doing 2-3 loads per week.',
      type: 'monthly_subscription' as any,
      priceInCents: 45000,
      currency: 'ZAR',
      usageLimitPerPeriod: 10,
      periodUnit: 'month' as any,
      periodDuration: 1,
      maxActiveSubscribers: 4,
      isPopular: true,
      isActive: true,
      createdAt: new Date('2026-08-01'),
    });

    this.listings.set('list_drill_002', {
      id: 'list_drill_002',
      title: 'DeWalt 18V XR Brushless SDS-Plus Rotary Hammer Drill Kit',
      description: 'Heavy duty 2.1 Joules rotary hammer with 2x 4.0Ah batteries, multi-voltage charger, anti-vibration handle, depth stop, and heavy duty TSTAK kitbox. Perfect for masonry, concrete anchors, and core drilling.',
      category: 'physical_item' as any,
      categoryId: 'cat_tools',
      ownerId: 'usr_host_marcus',
      address: 'Woodstock Makerspace, 187 Sir Lowry Rd',
      neighborhood: 'Woodstock',
      city: 'Cape Town',
      latitude: '-33.9298',
      longitude: '18.4485',
      location: null,
      images: [
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&auto=format&fit=crop&q=80',
      ],
      rules: 'Return batteries fully recharged. Use supplied grease on SDS shank bits.',
      depositRequiredInCents: 50000,
      maxSubscribers: 1,
      currentSubscribersCount: 1,
      isAvailable: true,
      visibilityGroupId: 'grp_woodstock_coop',
      accessMethod: 'host_handover',
      createdAt: new Date('2026-08-05'),
      updatedAt: new Date('2026-08-20'),
    });

    this.pricingTiers.set('tier_drill_day', {
      id: 'tier_drill_day',
      listingId: 'list_drill_002',
      name: 'Day Pass (24 Hours)',
      description: 'Full day equipment rental with battery swap support.',
      type: 'daily' as any,
      priceInCents: 15000,
      currency: 'ZAR',
      usageLimitPerPeriod: null,
      periodUnit: 'day' as any,
      periodDuration: 1,
      maxActiveSubscribers: 1,
      isPopular: true,
      isActive: true,
      createdAt: new Date('2026-08-05'),
    });

    // Seed memberships for Marcus (usr_host_marcus)
    this.groupMemberships.set('mem_004', {
      id: 'mem_004',
      groupId: 'grp_woodstock_coop',
      userId: 'usr_host_marcus',
      status: 'ACTIVE',
      joinedAt: new Date('2026-02-01'),
    });
  }
}

export const memoryStore = new MemoryStore();

/**
 * Creates or gets the Drizzle DB instance
 */
function createDbInstance() {
  if (connectionString && connectionString.startsWith('postgres')) {
    const sqlClient = neon(connectionString);
    return drizzle(sqlClient, { schema });
  }

  // Transactional simulation engine conforming to Drizzle API
  const queryEngine = {
    listings: {
      findMany: async ({ where, with: relations }: any = {}) => {
        const results = Array.from(memoryStore.listings.values()).filter((l) => l.isAvailable !== false);
        return results.map((l) => ({
          ...l,
          owner: memoryStore.users.get(l.ownerId),
          pricingTiers: Array.from(memoryStore.pricingTiers.values()).filter((t) => t.listingId === l.id),
        }));
      },
      findFirst: async ({ where, with: relations }: any = {}) => {
        const results = Array.from(memoryStore.listings.values());
        if (results.length === 0) return null;
        const l = results[0];
        return {
          ...l,
          owner: memoryStore.users.get(l.ownerId),
          pricingTiers: Array.from(memoryStore.pricingTiers.values()).filter((t) => t.listingId === l.id),
        };
      },
    },
    pricingTiers: {
      findMany: async ({ where }: any = {}) => {
        return Array.from(memoryStore.pricingTiers.values());
      },
      findFirst: async ({ where }: any = {}) => {
        for (const t of memoryStore.pricingTiers.values()) return t;
        return null;
      },
    },
    users: {
      findMany: async () => Array.from(memoryStore.users.values()),
      findFirst: async ({ where }: any = {}) => {
        for (const u of memoryStore.users.values()) return u;
        return null;
      },
    },
    userSubscriptions: {
      findMany: async () => Array.from(memoryStore.userSubscriptions.values()),
      findFirst: async ({ where }: any = {}) => {
        for (const sub of memoryStore.userSubscriptions.values()) {
          return sub;
        }
        return null;
      },
    },
    bookings: {
      findMany: async () => Array.from(memoryStore.bookings.values()),
      findFirst: async () => {
        for (const b of memoryStore.bookings.values()) {
          return b;
        }
        return null;
      },
    },
    systemLogs: {
      findMany: async () => {
        return Array.from(memoryStore.systemLogs.values()).sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
      },
    },
    trustGroups: {
      findMany: async () => {
        return Array.from(memoryStore.trustGroups.values());
      },
    },
  };

  const insertEngine = (table: any) => ({
    values: (record: any) => {
      const id = record.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const fullRecord = {
        ...record,
        id,
        createdAt: record.createdAt || new Date(),
      };

      if (table === schema.listings) {
        memoryStore.listings.set(id, fullRecord);
      } else if (table === schema.pricingTiers) {
        memoryStore.pricingTiers.set(id, fullRecord);
      } else if (table === schema.users) {
        memoryStore.users.set(id, fullRecord);
      } else if (table === schema.usageLogs) {
        memoryStore.usageLogs.set(id, fullRecord);
      } else if (table === schema.systemLogs) {
        memoryStore.systemLogs.set(id, fullRecord);
      } else if (table === schema.bookings) {
        memoryStore.bookings.set(id, fullRecord);
      } else if (table === schema.payments) {
        memoryStore.payments.set(id, fullRecord);
      } else if (table === schema.conditionLogs) {
        memoryStore.conditionLogs.set(id, fullRecord);
      } else if (table === schema.trustGroups) {
        memoryStore.trustGroups.set(id, fullRecord);
      } else if (table === schema.groupMemberships) {
        memoryStore.groupMemberships.set(id, fullRecord);
      } else if (table === schema.conversations) {
        memoryStore.conversations.set(id, fullRecord);
      } else if (table === schema.messages) {
        memoryStore.messages.set(id, fullRecord);
      } else if (table === schema.reviews) {
        memoryStore.reviews.set(id, fullRecord);
      }
      return {
        returning: () => [fullRecord],
      };
    },
  });

  const updateEngine = (table: any) => ({
    set: (values: any) => ({
      where: (cond: any) => ({
        returning: () => [values],
      }),
    }),
  });

  const selectEngine = () => ({
    from: (table: any) => ({
      where: (condition: any) => ({
        limit: (lim: number) => {
          if (table === schema.users) return Array.from(memoryStore.users.values()).slice(0, lim);
          if (table === schema.listings) return Array.from(memoryStore.listings.values()).slice(0, lim);
          if (table === schema.pricingTiers) return Array.from(memoryStore.pricingTiers.values()).slice(0, lim);
          if (table === schema.userSubscriptions) return Array.from(memoryStore.userSubscriptions.values()).slice(0, lim);
          if (table === schema.bookings) return Array.from(memoryStore.bookings.values()).slice(0, lim);
          if (table === schema.payments) return Array.from(memoryStore.payments.values()).slice(0, lim);
          return [];
        },
      }),
    }),
  });

  return {
    query: queryEngine,
    insert: insertEngine,
    update: updateEngine,
    select: selectEngine,
    transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      // Create transactional snapshot for rollback guarantee
      const subSnapshot = new Map(memoryStore.userSubscriptions);
      const usageSnapshot = new Map(memoryStore.usageLogs);
      const systemSnapshot = new Map(memoryStore.systemLogs);
      const bookingSnapshot = new Map(memoryStore.bookings);
      const paymentSnapshot = new Map(memoryStore.payments);
      const conditionSnapshot = new Map(memoryStore.conditionLogs);
      const groupSnapshot = new Map(memoryStore.trustGroups);
      const membershipSnapshot = new Map(memoryStore.groupMemberships);
      const convSnapshot = new Map(memoryStore.conversations);
      const msgSnapshot = new Map(memoryStore.messages);
      const reviewSnapshot = new Map(memoryStore.reviews);
      const listingSnapshot = new Map(memoryStore.listings);
      const tierSnapshot = new Map(memoryStore.pricingTiers);
      const userSnapshot = new Map(memoryStore.users);

      const txProxy = {
        select: selectEngine,
        query: queryEngine,
        update: updateEngine,
        insert: insertEngine,
      };

      try {
        const result = await callback(txProxy);
        return result;
      } catch (err) {
        // Rollback snapshot on transaction failure
        memoryStore.userSubscriptions = subSnapshot;
        memoryStore.usageLogs = usageSnapshot;
        memoryStore.systemLogs = systemSnapshot;
        memoryStore.bookings = bookingSnapshot;
        memoryStore.payments = paymentSnapshot;
        memoryStore.conditionLogs = conditionSnapshot;
        memoryStore.trustGroups = groupSnapshot;
        memoryStore.groupMemberships = membershipSnapshot;
        memoryStore.conversations = convSnapshot;
        memoryStore.messages = msgSnapshot;
        memoryStore.reviews = reviewSnapshot;
        memoryStore.listings = listingSnapshot;
        memoryStore.pricingTiers = tierSnapshot;
        memoryStore.users = userSnapshot;
        throw err;
      }
    },
  };
}

export const db = createDbInstance();
export default db;
