import { CategoryModel } from '../types';
export type { CategoryModel };

export const HIERARCHICAL_CATEGORIES: CategoryModel[] = [
  {
    id: 'cat_vehicles',
    name: 'Vehicles & Auto',
    slug: 'vehicles-auto',
    icon: 'Car',
    description: 'Car spare parts, OBD-II diagnostic tools, roof boxes, and EV charging points',
    itemCount: 4,
    subcategories: [
      {
        id: 'cat_car_parts',
        name: 'Car Parts & Spares',
        slug: 'car-parts',
        parentId: 'cat_vehicles',
        icon: 'Wrench',
        description: 'Brake pads, alternators, spare tires, and suspension kits',
        itemCount: 2,
      },
      {
        id: 'cat_auto_tools',
        name: 'Auto Diagnostics & Jacks',
        slug: 'auto-diagnostics',
        parentId: 'cat_vehicles',
        icon: 'Gauge',
        description: 'Engine hoists, OBD2 diagnostic scanners, torque wrenches, and hydraulic jacks',
        itemCount: 2,
      },
      {
        id: 'cat_roof_racks',
        name: 'Racks & Cargo Boxes',
        slug: 'roof-racks',
        parentId: 'cat_vehicles',
        icon: 'Boxes',
        description: 'Thule roof boxes, bike racks, and tow bar carriers',
        itemCount: 1,
      },
    ],
  },
  {
    id: 'cat_tools',
    name: 'Power Tools & Equipment',
    slug: 'tools-equipment',
    icon: 'Hammer',
    description: 'Contractor drills, circular saws, tile cutters, concrete mixers, and garden equipment',
    itemCount: 5,
    subcategories: [
      {
        id: 'cat_power_tools',
        name: 'Power Tools',
        slug: 'power-tools',
        parentId: 'cat_tools',
        icon: 'Zap',
        description: 'Cordless brushless drills, impact drivers, rotary hammers, and angle grinders',
        itemCount: 3,
      },
      {
        id: 'cat_construction',
        name: 'Construction & Renovation',
        slug: 'construction-tools',
        parentId: 'cat_tools',
        icon: 'Building2',
        description: 'Tile cutters, drywall sanders, scaffold towers, and laser levels',
        itemCount: 1,
      },
      {
        id: 'cat_gardening',
        name: 'Lawn & Landscaping',
        slug: 'lawn-gardening',
        parentId: 'cat_tools',
        icon: 'Trees',
        description: 'High-pressure washers, petrol chainsaws, and lawn aerators',
        itemCount: 1,
      },
    ],
  },
  {
    id: 'cat_appliances',
    name: 'Fractional Appliances',
    slug: 'fractional-appliances',
    icon: 'Shirt',
    description: 'Capped-membership shared washing machines, 3D printers, and commercial appliances',
    itemCount: 4,
    subcategories: [
      {
        id: 'cat_washers',
        name: 'Washers & Dryers',
        slug: 'washers-dryers',
        parentId: 'cat_appliances',
        icon: 'Waves',
        description: 'Shared 9kg eco front-loader washing machine co-ops with quota allocation',
        itemCount: 2,
      },
      {
        id: 'cat_3d_printers',
        name: '3D Printers & Makers',
        slug: '3d-printers',
        parentId: 'cat_appliances',
        icon: 'Printer',
        description: 'High-speed CoreXY 3D printers, laser engravers, and post-processing tools',
        itemCount: 1,
      },
      {
        id: 'cat_kitchen',
        name: 'Culinary & Espresso',
        slug: 'kitchen-culinary',
        parentId: 'cat_appliances',
        icon: 'Utensils',
        description: 'Dual boiler espresso machines, commercial dehydrators, and dough mixers',
        itemCount: 1,
      },
    ],
  },
  {
    id: 'cat_rooms',
    name: 'Rooms & Spaces',
    slug: 'rooms-spaces',
    icon: 'BedDouble',
    description: 'Verified en-suites, soundproof podcast studios, and creative workshop bays',
    itemCount: 3,
    subcategories: [
      {
        id: 'cat_guest_rooms',
        name: 'Guest Rooms & En-Suites',
        slug: 'guest-rooms',
        parentId: 'cat_rooms',
        icon: 'Bed',
        description: 'Private garden-facing en-suite rooms with fibre Wi-Fi and solar backup',
        itemCount: 2,
      },
      {
        id: 'cat_studios',
        name: 'Podcast & Audio Studios',
        slug: 'creative-studios',
        parentId: 'cat_rooms',
        icon: 'Sparkles',
        description: 'Acoustically treated podcast rooms with Shure SM7B mics and audio interfaces',
        itemCount: 1,
      },
    ],
  },
  {
    id: 'cat_energy',
    name: 'Clean Tech & Energy',
    slug: 'energy-tech',
    icon: 'BatteryCharging',
    description: 'Solar inverters, portable battery power stations, and solar gear',
    itemCount: 2,
    subcategories: [
      {
        id: 'cat_solar_batteries',
        name: 'Inverters & Solar Stations',
        slug: 'solar-batteries',
        parentId: 'cat_energy',
        icon: 'Sun',
        description: '5kW smart solar inverters and EcoFlow portable lithium power stations',
        itemCount: 2,
      },
    ],
  },
];

// Flat list of all categories including subcategories for fast ID / slug lookup
export const ALL_CATEGORIES_FLAT: CategoryModel[] = [
  ...HIERARCHICAL_CATEGORIES,
  ...HIERARCHICAL_CATEGORIES.flatMap((c) => c.subcategories || []),
];

export function getCategoryById(idOrSlug?: string): CategoryModel | null {
  if (!idOrSlug) return null;
  return (
    ALL_CATEGORIES_FLAT.find(
      (c) => c.id === idOrSlug || c.slug === idOrSlug
    ) || null
  );
}

export function getCategoryAndChildrenIds(idOrSlug?: string): string[] {
  if (!idOrSlug || idOrSlug === 'all') return [];
  const parent = getCategoryById(idOrSlug);
  if (!parent) return [idOrSlug];

  const ids = [parent.id, parent.slug];
  if (parent.subcategories) {
    for (const child of parent.subcategories) {
      ids.push(child.id, child.slug);
    }
  }
  return ids;
}
