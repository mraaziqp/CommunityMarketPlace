import React, { useState } from 'react';
import {
  FileCode,
  Layers,
  Database,
  CheckCircle2,
  Copy,
  Check,
  X,
  Sparkles,
  Server,
  Code2,
  Compass,
  MapPin,
  Shield,
} from 'lucide-react';

export interface ArchitectureViewerProps {
  onClose: () => void;
}

export const ArchitectureViewer: React.FC<ArchitectureViewerProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'schema' | 'postgis' | 'design'>('postgis');
  const [copied, setCopied] = useState(false);

  const folderTree = `app-root/
├── Design.md                          # Phase 1, 2 & 3 Roadmap, Geospatial PostGIS & ERD
├── db/
│   ├── index.ts                       # Neon PostgreSQL serverless client + db.transaction engine
│   └── schema.ts                      # Drizzle ORM: Categories, Listings (PostGIS geometry), PricingTiers, Subscriptions, Bookings, SystemLogs
├── actions/                           # Next.js 15 Typesafe Server Actions ('use server')
│   ├── search.ts                      # searchListings(params) [PostGIS ST_DWithin & ST_Distance discovery]
│   ├── usage.ts                       # logFractionalUse(subscriptionId, userId) [Atomic db.transaction]
│   └── bookings.ts                    # confirmHandover(bookingId, scannedCode) [State machine liability transfer]
├── src/
│   ├── components/
│   │   ├── discovery/                 # CategoryNav.tsx, SearchHeader.tsx, ProximityFeed.tsx
│   │   ├── layout/                    # Navbar.tsx, Footer.tsx
│   │   ├── listings/                  # ListingCard.tsx, ListingDetailModal.tsx, CreateListingModal.tsx
│   │   ├── usage/                     # FractionalUsageLogger.tsx (Optimistic useTransition UI)
│   │   └── docs/                      # ArchitectureViewer.tsx
│   ├── data/
│   │   ├── mockCategories.ts          # Hierarchical multi-level categories & helpers
│   │   └── mockListings.ts            # Enriched listings with GPS coords, car parts, power tools
│   ├── lib/
│   │   └── utils.ts                   # cn() styling & formatCurrency helpers
│   └── types/
│       └── index.ts                   # Inferred Drizzle, CategoryModel & GeospatialSearchParams
└── drizzle.config.ts`;

  const schemaSnippet = `// db/schema.ts - Drizzle ORM Schema with PostGIS Point & Categories
import { pgTable, text, integer, boolean, timestamp, varchar, pgEnum, jsonb, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. PostGIS Geometry Custom Type for Point(Longitude, Latitude, 4326)
export const pointGeometry = customType<{
  data: { longitude: number; latitude: number } | string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value) {
    if (typeof value === 'string') return value;
    return \`SRID=4326;POINT(\${value.longitude} \${value.latitude})\`;
  },
  fromDriver(value: string) {
    const match = value?.match(/POINT\\(([-\\d\\.]+)\\s+([-\\d\\.]+)\\)/i);
    return match ? { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) } : { longitude: 0, latitude: 0 };
  },
});

// 2. Hierarchical Categories Table
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  parentId: text('parent_id'), // Self-referencing FK for subcategories
  icon: varchar('icon', { length: 50 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Listings Table with PostGIS Location
export const listings = pgTable('listings', {
  id: text('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),
  neighborhood: varchar('neighborhood', { length: 150 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  location: pointGeometry('location'), // PostGIS Point(4326)
  maxSubscribers: integer('max_subscribers').default(1).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});`;

  const postgisSnippet = `-- RAW SQL MIGRATION FOR NEON POSTGRESQL (POSTGIS EXTENSION & SPATIAL INDEXES)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Spatial GIST Index on Listings location column for O(log N) Proximity Searches
CREATE INDEX IF NOT EXISTS idx_listings_location_gist ON listings USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- 2. Server Action PostGIS Geospatial Query in actions/search.ts:
SELECT 
  listings.id,
  listings.title,
  listings.neighborhood,
  listings.city,
  ST_Distance(
    listings.location::geography, 
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
  ) / 1000.0 AS distance_km
FROM listings
WHERE 
  listings.is_available = true
  AND ($3::text IS NULL OR listings.category_id = $3)
  AND ST_DWithin(
    listings.location::geography, 
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
    $4 * 1000 -- Radius in meters (e.g. 10,000 for 10km)
  )
ORDER BY distance_km ASC
LIMIT $5 OFFSET $6;`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-white border border-slate-700">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Discovery Engine & Geospatial PostGIS</h2>
              <p className="text-xs text-slate-400">
                PostGIS spatial queries, hierarchical categories & privacy protection
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('postgis')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'postgis'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              1. PostGIS Spatial SQL
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'schema'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              2. Drizzle Schema (`db/schema.ts`)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tree')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'tree'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              3. Project Tree
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('design')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'design'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              4. Privacy & Architecture
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                activeTab === 'postgis'
                  ? postgisSnippet
                  : activeTab === 'schema'
                  ? schemaSnippet
                  : activeTab === 'tree'
                  ? folderTree
                  : 'See Design.md for full specs'
              )
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs cursor-pointer shrink-0 ml-2"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="overflow-y-auto p-6 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed flex-1">
          {activeTab === 'postgis' && (
            <div className="space-y-4">
              <div className="text-slate-400 text-xs font-sans pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>Neon PostgreSQL PostGIS Spatial Extension & Proximity Query:</span>
                <span className="text-emerald-400 font-mono">ST_DWithin + ST_Distance</span>
              </div>
              <pre className="text-emerald-400 overflow-x-auto selection:bg-slate-800 selection:text-white">
                {postgisSnippet}
              </pre>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-4">
              <div className="text-slate-400 text-xs font-sans pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>Categories Table & PostGIS Point Schema (`db/schema.ts`):</span>
                <span className="text-sky-400 font-mono">Drizzle ORM</span>
              </div>
              <pre className="text-sky-300 overflow-x-auto selection:bg-slate-800 selection:text-white">
                {schemaSnippet}
              </pre>
            </div>
          )}

          {activeTab === 'tree' && (
            <div className="space-y-4">
              <div className="text-slate-400 text-xs font-sans pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>Discovery Engine Module Directory Structure:</span>
                <span className="text-emerald-400 font-mono">100% Modular</span>
              </div>
              <pre className="text-emerald-400 overflow-x-auto selection:bg-slate-800 selection:text-white">
                {folderTree}
              </pre>
            </div>
          )}

          {activeTab === 'design' && (
            <div className="space-y-3 font-sans text-slate-300 text-xs leading-relaxed">
              <h3 className="text-sm font-bold text-white mb-2">Discovery & Privacy Architecture</h3>
              <p>
                <strong>1. Hierarchical Categories:</strong>
                <br />
                The <code>categories</code> table includes a <code>parent_id</code> self-referencing foreign key so parent categories (e.g. <em>Vehicles & Auto</em>) automatically match listings in child subcategories (<em>Car Parts & Spares</em>, <em>Auto Diagnostics</em>).
              </p>
              <p>
                <strong>2. Privacy & Location Shield:</strong>
                <br />
                - Public search feeds only return approximate rounded distances (e.g. <code>~2.4 km away</code>) to prevent scraping home addresses.
                <br />
                - Exact street addresses, unit numbers, and smart lock PIN codes remain locked until a reservation is paid and confirmed.
              </p>
              <p>
                <strong>3. Shareable URL Search State:</strong>
                <br />
                Search filters, selected categories, GPS coordinates, and proximity radiuses synchronize with URL search parameters (<code>?q=...&cat=...&lat=...&lng=...&radius=...</code>) so searches survive reloads and can be shared.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px] mt-3">
                Documentation: <code>/Design.md</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
