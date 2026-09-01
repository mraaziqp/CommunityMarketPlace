'use server';

import { db, memoryStore } from '../db';
import {
  reviews,
  bookings,
  users,
  listings,
  systemLogs,
  type Review,
  type SystemLog,
} from '../db/schema';
import type { ReviewModel } from '../src/types';
import { validateInput, SubmitReviewSchema } from '../lib/validations';

export interface CreateReviewInput {
  bookingId: string;
  reviewerId?: string;
  targetId: string;
  listingId?: string;
  rating: number; // 1-5
  comment: string;
  cleanlinessRating?: number;
  communicationRating?: number;
  accuracyRating?: number;
}

export interface CreateReviewResult {
  success: boolean;
  review: ReviewModel;
  newTrustScore: number;
  systemLog: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

/**
 * Server Action: Submit a Review & Rating
 * Validates booking and recalculates user reputation trust score.
 */
export async function createReview(
  input: CreateReviewInput
): Promise<CreateReviewResult> {
  const validated = validateInput(SubmitReviewSchema, input);

  const {
    bookingId,
    reviewerId = 'usr_me',
    targetId,
    listingId,
    rating,
    comment,
    cleanlinessRating = 5,
    communicationRating = 5,
    accuracyRating = 5,
  } = { ...input, ...validated };

  return await db.transaction(async (tx: any) => {
    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();

    const newReview: Review = {
      id: reviewId,
      bookingId,
      reviewerId,
      targetId,
      listingId: listingId || null,
      rating: Math.round(rating),
      comment: comment.trim(),
      cleanlinessRating: cleanlinessRating || 5,
      communicationRating: communicationRating || 5,
      accuracyRating: accuracyRating || 5,
      createdAt: now,
    };

    memoryStore.reviews.set(reviewId, newReview);

    // Calculate updated trust score for target user
    let totalScore = 0;
    let reviewCount = 0;

    for (const r of memoryStore.reviews.values()) {
      if (r.targetId === targetId) {
        totalScore += r.rating;
        reviewCount++;
      }
    }

    const averageRating = reviewCount > 0 ? totalScore / reviewCount : 5;
    // Map 1-5 rating into a 50-100 scale trust score
    const newTrustScore = Math.min(100, Math.max(50, Math.round(averageRating * 20)));

    const targetUser = memoryStore.users.get(targetId);
    if (targetUser) {
      targetUser.trustScore = newTrustScore;
      memoryStore.users.set(targetId, targetUser);
    }

    const reviewer = memoryStore.users.get(reviewerId);
    const listing = listingId ? memoryStore.listings.get(listingId) : null;

    // Log to immutable SystemLogs audit ledger
    const logId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogRecord: SystemLog = {
      id: logId,
      eventType: 'REVIEW_SUBMITTED',
      userId: reviewerId,
      targetId: reviewId,
      metadata: {
        action: 'TWO_WAY_TRUST_REVIEW_SUBMITTED',
        bookingId,
        reviewId,
        targetId,
        targetUserName: targetUser?.name || 'User',
        reviewerId,
        reviewerName: reviewer?.name || 'Alex Rivera',
        rating,
        cleanlinessRating,
        communicationRating,
        accuracyRating,
        newTrustScore,
        commentSnippet: comment.length > 80 ? `${comment.substring(0, 80)}...` : comment,
        timestamp: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(logId, systemLogRecord);

    return {
      success: true,
      review: {
        id: newReview.id,
        bookingId: newReview.bookingId,
        reviewerId: newReview.reviewerId,
        reviewerName: reviewer?.name || 'Alex Rivera',
        reviewerImage: reviewer?.image || '',
        targetId: newReview.targetId,
        targetName: targetUser?.name || 'Marcus Thorne',
        listingId: newReview.listingId,
        listingTitle: listing?.title || 'Shared Community Asset',
        rating: newReview.rating,
        comment: newReview.comment,
        cleanlinessRating: newReview.cleanlinessRating,
        communicationRating: newReview.communicationRating,
        accuracyRating: newReview.accuracyRating,
        createdAt: now.toISOString(),
      },
      newTrustScore,
      systemLog: {
        id: systemLogRecord.id,
        eventType: systemLogRecord.eventType,
        userId: systemLogRecord.userId,
        targetId: systemLogRecord.targetId,
        metadata: systemLogRecord.metadata,
        createdAt: systemLogRecord.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Get Reviews for a Listing
 */
export async function getReviewsForListing(listingId: string): Promise<ReviewModel[]> {
  const result: ReviewModel[] = [];

  for (const r of memoryStore.reviews.values()) {
    if (r.listingId === listingId) {
      const reviewer = memoryStore.users.get(r.reviewerId);
      const target = memoryStore.users.get(r.targetId);
      const listing = memoryStore.listings.get(r.listingId);

      result.push({
        id: r.id,
        bookingId: r.bookingId,
        reviewerId: r.reviewerId,
        reviewerName: reviewer?.name || 'Community Member',
        reviewerImage: reviewer?.image || '',
        targetId: r.targetId,
        targetName: target?.name || 'Host',
        listingId: r.listingId,
        listingTitle: listing?.title || '',
        rating: r.rating,
        comment: r.comment,
        cleanlinessRating: r.cleanlinessRating,
        communicationRating: r.communicationRating,
        accuracyRating: r.accuracyRating,
        createdAt: r.createdAt.toISOString(),
      });
    }
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Server Action: Check if User has already reviewed a booking
 */
export async function getReviewForBooking(
  bookingId: string,
  reviewerId: string = 'usr_me'
): Promise<ReviewModel | null> {
  for (const r of memoryStore.reviews.values()) {
    if (r.bookingId === bookingId && r.reviewerId === reviewerId) {
      const reviewer = memoryStore.users.get(r.reviewerId);
      const target = memoryStore.users.get(r.targetId);
      const listing = r.listingId ? memoryStore.listings.get(r.listingId) : null;

      return {
        id: r.id,
        bookingId: r.bookingId,
        reviewerId: r.reviewerId,
        reviewerName: reviewer?.name || 'Alex Rivera',
        reviewerImage: reviewer?.image || '',
        targetId: r.targetId,
        targetName: target?.name || 'Host',
        listingId: r.listingId,
        listingTitle: listing?.title || '',
        rating: r.rating,
        comment: r.comment,
        cleanlinessRating: r.cleanlinessRating,
        communicationRating: r.communicationRating,
        accuracyRating: r.accuracyRating,
        createdAt: r.createdAt.toISOString(),
      };
    }
  }
  return null;
}
