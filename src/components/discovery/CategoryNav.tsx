import React from 'react';
import {
  Layers,
  Car,
  Hammer,
  Shirt,
  BedDouble,
  BatteryCharging,
  Wrench,
  Gauge,
  Boxes,
  Zap,
  Building2,
  Trees,
  Waves,
  Printer,
  Utensils,
  Bed,
  Sparkles,
  Sun,
  Camera,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  HIERARCHICAL_CATEGORIES,
  CategoryModel,
} from '../../data/mockCategories';
import { cn } from '../../lib/utils';

// Icon resolver for dynamic category icons
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Layers,
  Car,
  Hammer,
  Shirt,
  BedDouble,
  BatteryCharging,
  Wrench,
  Gauge,
  Boxes,
  Zap,
  Building2,
  Trees,
  Waves,
  Printer,
  Utensils,
  Bed,
  Sparkles,
  Sun,
  Camera,
};

export interface CategoryNavProps {
  selectedCategorySlug: string; // 'all' or specific slug
  selectedSubcategorySlug?: string | null;
  onSelectCategory: (categorySlug: string, subcategorySlug?: string | null) => void;
  totalListingsCount?: number;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategorySlug,
  selectedSubcategorySlug,
  onSelectCategory,
  totalListingsCount,
}) => {
  // Find current top category
  const activeTopCategory = HIERARCHICAL_CATEGORIES.find(
    (c) => c.slug === selectedCategorySlug || c.id === selectedCategorySlug
  );

  const hasSubcategories =
    activeTopCategory &&
    activeTopCategory.subcategories &&
    activeTopCategory.subcategories.length > 0;

  return (
    <div className="w-full bg-white border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top-Level Categories Horizontal Scroll */}
        <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-none">
          {/* "All" Option */}
          <button
            id="cat-pill-all"
            type="button"
            onClick={() => onSelectCategory('all', null)}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer',
              selectedCategorySlug === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200/70'
            )}
          >
            <Layers className="w-4 h-4" />
            <span>All Categories</span>
            {totalListingsCount !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold ml-0.5',
                  selectedCategorySlug === 'all'
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-slate-200 text-slate-600'
                )}
              >
                {totalListingsCount}
              </span>
            )}
          </button>

          {/* Top-Level Categories */}
          {HIERARCHICAL_CATEGORIES.map((cat) => {
            const IconComponent =
              (cat.icon && CATEGORY_ICON_MAP[cat.icon]) || Layers;
            const isSelected =
              selectedCategorySlug === cat.slug ||
              selectedCategorySlug === cat.id;

            return (
              <button
                key={cat.id}
                id={`cat-pill-${cat.slug}`}
                type="button"
                onClick={() => onSelectCategory(cat.slug, null)}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer',
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200/70'
                )}
              >
                <IconComponent
                  className={cn(
                    'w-4 h-4',
                    isSelected ? 'text-amber-400' : 'text-slate-500'
                  )}
                />
                <span>{cat.name}</span>
                {cat.itemCount !== undefined && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-bold ml-0.5',
                      isSelected
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {cat.itemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Subcategories Secondary Pill Row (when a parent category is selected) */}
        {hasSubcategories && (
          <div className="flex items-center gap-2 pt-1 pb-3 overflow-x-auto scrollbar-none border-t border-slate-100/80 animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 pl-1 mr-1">
              <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
              Sub-Types:
            </span>

            {/* "All in this category" chip */}
            <button
              id="subcat-pill-all"
              type="button"
              onClick={() => onSelectCategory(selectedCategorySlug, null)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer',
                !selectedSubcategorySlug
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              )}
            >
              <span>All {activeTopCategory?.name}</span>
            </button>

            {activeTopCategory?.subcategories?.map((sub) => {
              const SubIcon =
                (sub.icon && CATEGORY_ICON_MAP[sub.icon]) || Layers;
              const isSubSelected = selectedSubcategorySlug === sub.slug;

              return (
                <button
                  key={sub.id}
                  id={`subcat-pill-${sub.slug}`}
                  type="button"
                  onClick={() => onSelectCategory(selectedCategorySlug, sub.slug)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer',
                    isSubSelected
                      ? 'bg-indigo-600 text-white border border-indigo-700 font-semibold shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                  )}
                >
                  <SubIcon
                    className={cn(
                      'w-3.5 h-3.5',
                      isSubSelected ? 'text-amber-300' : 'text-slate-400'
                    )}
                  />
                  <span>{sub.name}</span>
                  {sub.itemCount !== undefined && (
                    <span
                      className={cn(
                        'text-[10px] px-1 rounded',
                        isSubSelected ? 'bg-indigo-700 text-indigo-100' : 'text-slate-400'
                      )}
                    >
                      {sub.itemCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
