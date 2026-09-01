import { auth } from '../../../../lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

/**
 * ============================================================================
 * BETTER AUTH NEXT.JS CATCH-ALL ROUTE HANDLER
 * Handles:
 *  - /api/auth/sign-in/email
 *  - /api/auth/sign-up/email
 *  - /api/auth/sign-in/social (Google OAuth)
 *  - /api/auth/sign-out
 *  - /api/auth/session
 *  - /api/auth/callback/google
 * ============================================================================
 */

export const { GET, POST } = toNextJsHandler(auth.handler);
