import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amountInCents: number, currency: string = 'ZAR'): string {
  const symbol = currency === 'ZAR' ? 'R' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
  const amount = (amountInCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: amountInCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${amount}`;
}

export function formatTierRate(tier: {
  type: string;
  priceInCents: number;
  currency?: string;
  usageLimitPerPeriod?: number | null;
  periodUnit?: string;
}): string {
  const price = formatCurrency(tier.priceInCents, tier.currency || 'ZAR');
  
  if (tier.type === 'nightly') {
    return `${price} / night`;
  }
  if (tier.type === 'daily') {
    return `${price} / day`;
  }
  if (tier.type === 'hourly') {
    return `${price} / hr`;
  }
  if (tier.type === 'monthly_subscription') {
    const uses = tier.usageLimitPerPeriod ? ` · ${tier.usageLimitPerPeriod} uses` : '';
    return `${price}/mo${uses}`;
  }
  if (tier.type === 'usage_pack') {
    return `${price} · ${tier.usageLimitPerPeriod || 10} uses pack`;
  }
  return price;
}
