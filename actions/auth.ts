import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { memoryStore } from '../db';
import * as schema from '../db/schema';
import type { UserModel, UserRole, AuthSession } from '../src/types';
import { config } from '../server/config';

/**
 * ============================================================================
 * ACCOUNTS & SESSIONS (server only)
 *
 * - Everyone signs up as a USER. ADMIN comes only from the server-side
 *   ADMIN_EMAILS allowlist; the role is re-derived on every request.
 * - Passwords are hashed with scrypt and stored in the `account` table.
 * - Session tokens are random 256-bit values. Only their SHA-256 hash is
 *   stored, so a database leak does not leak live sessions.
 * - One-tap demo accounts exist only when DEMO_MODE is on.
 * ============================================================================
 */

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export interface SignUpParams {
  name: string;
  email: string;
  password: string;
  neighborhood?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type AuthResult = { success: true; session: AuthSession & { token: string } } | { success: false; error: string };

const MIN_PASSWORD_LENGTH = 8;
const CREDENTIAL_PROVIDER = 'credential';

/** Seeded users behind the one-tap demo accounts (demo mode only). */
export const DEMO_ACCOUNT_IDS: Record<UserRole, string> = {
  USER: 'usr_me',
  VERIFIED_HOST: 'usr_tariq',
  ADMIN: 'usr_admin_01',
};

// --- Helpers ---

const newId = (prefix: string) => `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

function findUserByEmail(email: string): schema.User | undefined {
  const clean = normalizeEmail(email);
  for (const user of memoryStore.users.values()) {
    if (user.email.toLowerCase() === clean) return user;
  }
  return undefined;
}

function credentialFor(userId: string) {
  for (const account of memoryStore.accounts.values()) {
    if (account.userId === userId && account.providerId === CREDENTIAL_PROVIDER) return account;
  }
  return undefined;
}

/** Allowlisted emails are admins; outside demo mode nobody else can hold ADMIN. */
function resolveRole(email: string, storedRole: UserRole): UserRole {
  if (config().adminEmails.has(normalizeEmail(email))) return 'ADMIN';
  if (storedRole === 'ADMIN' && !config().demoMode) return 'USER';
  return storedRole;
}

export function toUserModel(user: schema.User): UserModel {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    role: resolveRole(user.email, user.role as UserRole),
    image: user.image,
    phoneNumber: user.phoneNumber,
    bio: user.bio,
    neighborhood: user.neighborhood,
    trustScore: user.trustScore,
    isHost: user.isHost,
    suspended: !!user.suspendedAt,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function logAuthEvent(eventType: 'AUTH_SIGNIN' | 'AUTH_SIGNUP', user: schema.User, method: string) {
  const id = newId('sys_auth');
  memoryStore.systemLogs.set(id, {
    id,
    eventType,
    userId: user.id,
    targetId: user.id,
    metadata: { method },
    createdAt: new Date(),
  });
}

function startSession(user: schema.User, method: string, eventType: 'AUTH_SIGNIN' | 'AUTH_SIGNUP', meta: RequestMeta): AuthResult {
  const now = new Date();
  const expires = new Date(now.getTime() + config().sessionTtlDays * 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString('base64url');
  const id = newId('sess');
  memoryStore.sessions.set(id, {
    id,
    token: hashToken(token),
    userId: user.id,
    expiresAt: expires,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    createdAt: now,
    updatedAt: now,
  });
  logAuthEvent(eventType, user, method);
  return { success: true, session: { user: toUserModel(user), token, expiresAt: expires.toISOString() } };
}

// --- Public API ---

export async function signUpWithEmailPassword(params: SignUpParams, meta: RequestMeta = {}): Promise<AuthResult> {
  const name = params.name?.trim() ?? '';
  const email = normalizeEmail(params.email ?? '');
  const password = params.password ?? '';

  if (name.length < 2 || name.length > 80) return { success: false, error: 'Please tell us your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return { success: false, error: `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (findUserByEmail(email)) {
    return { success: false, error: 'There is already an account with that email. Try signing in instead.' };
  }

  const now = new Date();
  const user: schema.User = {
    id: newId('usr'),
    name,
    email,
    emailVerified: false,
    role: config().adminEmails.has(email) ? 'ADMIN' : 'USER',
    image: null,
    phoneNumber: null,
    bio: null,
    neighborhood: params.neighborhood?.trim().slice(0, 150) || null,
    trustScore: 90,
    isHost: false,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.users.set(user.id, user);

  const accountId = newId('acct');
  memoryStore.accounts.set(accountId, {
    id: accountId,
    accountId: user.id,
    providerId: CREDENTIAL_PROVIDER,
    userId: user.id,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });

  return startSession(user, 'EMAIL_PASSWORD', 'AUTH_SIGNUP', meta);
}

export async function signInWithEmailPassword(params: SignInParams, meta: RequestMeta = {}): Promise<AuthResult> {
  const user = findUserByEmail(params.email ?? '');
  const credential = user ? credentialFor(user.id) : undefined;
  const fail: AuthResult = { success: false, error: 'Incorrect email or password.' };

  if (!user) return fail;
  if (user.suspendedAt) return { success: false, error: 'This account has been suspended. Please contact support.' };
  if (!credential?.password) {
    // Seeded demo users have no password and are only reachable in demo mode.
    return config().demoMode ? startSession(user, 'DEMO', 'AUTH_SIGNIN', meta) : fail;
  }
  if (!(await verifyPassword(params.password ?? '', credential.password))) return fail;
  return startSession(user, 'EMAIL_PASSWORD', 'AUTH_SIGNIN', meta);
}

/** One-tap sign-in as a seeded demo user (demo mode only). */
export async function signInAsDemoUser(role: UserRole, meta: RequestMeta = {}): Promise<AuthResult> {
  if (!config().demoMode) return { success: false, error: 'Demo accounts are not available.' };
  const user = memoryStore.users.get(DEMO_ACCOUNT_IDS[role]);
  if (!user) return { success: false, error: 'That demo account is not available.' };
  return startSession(user, 'DEMO', 'AUTH_SIGNIN', meta);
}

/** The signed-in user for a session token, or null if missing or expired. */
export function getSessionUser(token: string | undefined | null): UserModel | null {
  if (!token) return null;
  const hashed = hashToken(token);
  for (const session of memoryStore.sessions.values()) {
    if (session.token !== hashed) continue;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    const user = memoryStore.users.get(session.userId);
    return user && !user.suspendedAt ? toUserModel(user) : null;
  }
  return null;
}

export function signOut(token: string | undefined | null) {
  if (!token) return;
  const hashed = hashToken(token);
  for (const [id, session] of memoryStore.sessions) {
    if (session.token === hashed) memoryStore.sessions.delete(id);
  }
}

/** Removes expired sessions (called periodically). */
export function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of memoryStore.sessions) {
    if (session.expiresAt.getTime() <= now) memoryStore.sessions.delete(id);
  }
}

/** Current profile for a user id, with the effective role applied. */
export function getUserById(userId: string): UserModel | null {
  const user = memoryStore.users.get(userId);
  return user ? toUserModel(user) : null;
}

// --- Profile & account management ---

export interface ProfileUpdate {
  name?: string;
  bio?: string | null;
  neighborhood?: string | null;
  phoneNumber?: string | null;
  image?: string | null;
}

export function updateProfile(userId: string, patch: ProfileUpdate): UserModel {
  const user = memoryStore.users.get(userId);
  if (!user) throw new Error('Account not found.');
  const clean = (v: string | null | undefined, max: number) => (v == null ? null : v.trim().slice(0, max) || null);
  const next = { ...user, updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2 || name.length > 80) throw new Error('Please enter your name (2–80 characters).');
    next.name = name;
  }
  if (patch.bio !== undefined) next.bio = clean(patch.bio, 500);
  if (patch.neighborhood !== undefined) next.neighborhood = clean(patch.neighborhood, 150);
  if (patch.phoneNumber !== undefined) {
    const phone = clean(patch.phoneNumber, 30);
    if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) throw new Error('Please enter a valid phone number.');
    next.phoneNumber = phone;
  }
  if (patch.image !== undefined) {
    const image = patch.image?.trim() || null;
    if (image && !/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(image)) throw new Error('That profile photo is not valid.');
    if (image && image.length > 1_500_000) throw new Error('That profile photo is too large.');
    next.image = image;
  }
  memoryStore.users.set(userId, next);
  return toUserModel(next);
}

/** Changes the password and signs out every other session. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepToken?: string | null) {
  const user = memoryStore.users.get(userId);
  if (!user) throw new Error('Account not found.');
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 200) {
    throw new Error(`Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const credential = credentialFor(userId);
  if (credential?.password && !(await verifyPassword(currentPassword, credential.password))) {
    throw new Error('Your current password is incorrect.');
  }
  const now = new Date();
  const hash = await hashPassword(newPassword);
  if (credential) {
    memoryStore.accounts.set(credential.id, { ...credential, password: hash, updatedAt: now });
  } else {
    const id = newId('acct');
    memoryStore.accounts.set(id, {
      id, accountId: userId, providerId: CREDENTIAL_PROVIDER, userId,
      accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, scope: null,
      password: hash, createdAt: now, updatedAt: now,
    });
  }
  const keep = keepToken ? hashToken(keepToken) : null;
  for (const [id, session] of memoryStore.sessions) {
    if (session.userId === userId && session.token !== keep) memoryStore.sessions.delete(id);
  }
}

// --- Admin: member management ---

/** Roles an admin can grant in the app. ADMIN itself comes only from ADMIN_EMAILS. */
export function setUserRole(userId: string, role: 'USER' | 'VERIFIED_HOST') {
  const user = memoryStore.users.get(userId);
  if (!user) throw new Error('Member not found.');
  memoryStore.users.set(userId, { ...user, role, updatedAt: new Date() });
  return toUserModel(memoryStore.users.get(userId)!);
}

/** Suspending signs the member out everywhere and hides their listings. */
export function setUserSuspended(userId: string, suspended: boolean, actorId: string) {
  const user = memoryStore.users.get(userId);
  if (!user) throw new Error('Member not found.');
  if (userId === actorId) throw new Error('You cannot suspend your own account.');
  memoryStore.users.set(userId, { ...user, suspendedAt: suspended ? new Date() : null, updatedAt: new Date() });
  if (suspended) {
    for (const [id, session] of memoryStore.sessions) if (session.userId === userId) memoryStore.sessions.delete(id);
  }
  return toUserModel(memoryStore.users.get(userId)!);
}
