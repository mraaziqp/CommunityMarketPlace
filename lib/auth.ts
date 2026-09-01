import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';
import * as schema from '../db/schema';

/**
 * ============================================================================
 * BETTER AUTH SERVER CONFIGURATION (ShareHub Marketplace)
 * Supports Email/Password, Google OAuth, and Role-Based Access Control (RBAC).
 * Maps custom User table fields: role ('USER' | 'VERIFIED_HOST' | 'ADMIN'),
 * neighborhood, trustScore, and host credentials.
 * ============================================================================
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET || 'sharehub-community-production-secret-key-2026',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'sharehub-google-client-id.apps.googleusercontent.com',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'sharehub-google-client-secret',
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
        input: true,
      },
      isHost: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,
      },
      trustScore: {
        type: 'number',
        required: false,
        defaultValue: 100,
      },
      phoneNumber: {
        type: 'string',
        required: false,
      },
      bio: {
        type: 'string',
        required: false,
      },
      neighborhood: {
        type: 'string',
        required: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export type Auth = typeof auth;
