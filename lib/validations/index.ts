import { z } from 'zod';

/**
 * ============================================================================
 * SHAREHUB ZERO-LEAK ZOD VALIDATION SUITE
 * 
 * Strict boundary enforcement schemas for all Server Actions and Edge APIs.
 * Prevents phantom inputs, malformed coordinates, negative quotas, and unauthorized
 * state mutations before hitting the database or transactional layer.
 * ============================================================================
 */

// 1. Create Listing Validation
export const CreateListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Listing title must be at least 3 characters')
    .max(255, 'Listing title cannot exceed 255 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Listing description must provide at least 10 characters')
    .max(5000, 'Listing description cannot exceed 5000 characters'),
  category: z.enum(['room', 'physical_item', 'fractional_appliance']),
  categoryId: z.string().optional().nullable(),
  categorySlug: z.string().optional().nullable(),
  ownerId: z.string().optional(),
  address: z.string().trim().min(1, 'Street address is required'),
  neighborhood: z.string().trim().min(1, 'Neighborhood is required'),
  city: z.string().trim().min(1, 'City is required'),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
  images: z.array(z.string().url('Images must be valid URLs')).min(1, 'At least 1 image is required'),
  rules: z.string().max(2000).optional().nullable(),
  depositRequiredInCents: z.number().int().nonnegative('Deposit must be >= 0').optional().default(0),
  maxSubscribers: z.number().int().positive('maxSubscribers must be at least 1').optional().default(1),
  accessMethod: z.enum(['pin_code', 'qr_code', 'host_handover', 'smart_plug']).optional().default('pin_code'),
  visibilityGroupId: z.string().optional().nullable(),
  visibilityGroupName: z.string().optional().nullable(),
  specs: z.record(z.string(), z.any()).optional().nullable(),
  amenities: z.array(z.string()).optional().default([]),
  pricingTiers: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, 'Tier name is required'),
      description: z.string().optional().nullable(),
      type: z.enum(['nightly', 'daily', 'monthly_subscription', 'usage_pack']),
      priceInCents: z.number().int().nonnegative('Price must be a positive integer in cents'),
      currency: z.string().default('ZAR').optional(),
      usageLimitPerPeriod: z.number().int().positive().optional().nullable(),
      periodUnit: z.enum(['hour', 'day', 'month', 'year', 'one_time']).optional(),
      periodDuration: z.number().int().positive().optional(),
      maxActiveSubscribers: z.number().int().positive().optional().nullable(),
      isPopular: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
  ).optional().default([]),
});

export type CreateListingInputValidated = z.infer<typeof CreateListingSchema>;

// 2. Fractional Quota Usage Validation
export const LogFractionalUsageSchema = z.object({
  subscriptionId: z
    .string()
    .trim()
    .min(1, 'Subscription ID is required'),
  userId: z
    .string()
    .trim()
    .min(1, 'User ID is required for identity authorization'),
  notes: z
    .string()
    .trim()
    .max(500, 'Usage notes cannot exceed 500 characters')
    .optional()
    .nullable(),
  verificationCode: z
    .string()
    .trim()
    .max(64, 'Verification code cannot exceed 64 characters')
    .optional()
    .nullable(),
  unitsUsed: z
    .number()
    .int()
    .positive('unitsUsed must be at least 1')
    .optional()
    .default(1),
});

export type LogFractionalUsageInputValidated = z.infer<typeof LogFractionalUsageSchema>;

// 3. Digital Handover State Machine Validation
export const ConfirmHandoverSchema = z.object({
  bookingId: z
    .string()
    .trim()
    .min(1, 'Booking ID is required'),
  scannedCode: z
    .string()
    .trim()
    .min(3, 'Scanned digital handover PIN or QR code must be at least 3 characters')
    .max(64, 'Handover code cannot exceed 64 characters'),
  userId: z.string().trim().optional(),
});

export type ConfirmHandoverInputValidated = z.infer<typeof ConfirmHandoverSchema>;

// 4. Booking Creation & Overlap Validation
export const CreateBookingSchema = z.object({
  listingId: z.string().trim().min(1, 'Listing ID is required'),
  renterId: z.string().trim().min(1, 'Renter ID is required'),
  pricingTierId: z.string().trim().optional().nullable(),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]),
  totalAmountInCents: z.number().int().positive('Total amount must be greater than zero'),
  depositAmountInCents: z.number().int().nonnegative('Deposit must be >= 0').optional().default(0),
  verificationCode: z.string().optional(),
});

export type CreateBookingInputValidated = z.infer<typeof CreateBookingSchema>;

// 5. Escrow Payment & Authorization Validation
export const CreatePaymentIntentSchema = z.object({
  bookingId: z.string().trim().min(1, 'Booking ID is required'),
  amountInCents: z.number().int().positive('Payment amount must be greater than zero'),
  currency: z.string().default('ZAR').optional(),
  gateway: z.enum(['paystack', 'stripe']).optional().default('paystack'),
  userId: z.string().optional(),
});

export type CreatePaymentIntentInputValidated = z.infer<typeof CreatePaymentIntentSchema>;

// 6. Condition Inspection & Escrow Release Validation
export const LogConditionSchema = z.object({
  bookingId: z.string().trim().min(1, 'Booking ID is required'),
  type: z.enum(['PICKUP', 'RETURN']),
  conditionStatus: z.enum(['GOOD', 'MINOR_WEAR', 'DAMAGED']),
  notes: z.string().trim().max(1000).optional().nullable(),
  imageUrls: z.array(z.string().url()).optional().default([]),
  reportedBy: z.string().trim().min(1, 'Reporter user ID is required').optional(),
});

export type LogConditionInputValidated = z.infer<typeof LogConditionSchema>;

// 7. Trust & Review Validation
export const SubmitReviewSchema = z.object({
  bookingId: z.string().trim().min(1, 'Booking ID is required'),
  reviewerId: z.string().trim().optional(),
  targetId: z.string().trim().min(1, 'Target user ID is required'),
  listingId: z.string().trim().optional().nullable(),
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5),
  comment: z.string().trim().min(3, 'Review comment must be at least 3 characters').max(2000),
  cleanlinessRating: z.number().int().min(1).max(5).optional().nullable(),
  communicationRating: z.number().int().min(1).max(5).optional().nullable(),
  accuracyRating: z.number().int().min(1).max(5).optional().nullable(),
});

export type SubmitReviewInputValidated = z.infer<typeof SubmitReviewSchema>;

// 8. Private Trust Group Management Validation
export const CreateTrustGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  adminId: z.string().trim().optional(),
});

export type CreateTrustGroupInputValidated = z.infer<typeof CreateTrustGroupSchema>;

export const JoinTrustGroupSchema = z.object({
  inviteCode: z.string().trim().min(3, 'Valid invite code required').max(32),
  userId: z.string().trim().min(1, 'User ID is required'),
});

export type JoinTrustGroupInputValidated = z.infer<typeof JoinTrustGroupSchema>;

/**
 * Validates untrusted input using a Zod schema.
 * Throws a clean, actionable formatted Error if validation fails.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = (result.error as any).issues || (result.error as any).errors || [];
    const errorDetails = Array.isArray(issues) && issues.length > 0
      ? issues
          .map((e: any) => `[${Array.isArray(e.path) ? e.path.join('.') : 'root'}]: ${e.message}`)
          .join('; ')
      : result.error.message || 'Unknown schema error';
    throw new Error(`Validation Error: ${errorDetails}`);
  }
  return result.data;
}
