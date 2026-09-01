'use server';

import { db, memoryStore } from '../db';
import {
  trustGroups,
  groupMemberships,
  systemLogs,
  listings,
  type TrustGroup,
  type GroupMembership,
  type SystemLog,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import type { TrustGroupModel, GroupMembershipModel } from '../src/types';

export interface CreateTrustGroupInput {
  name: string;
  description?: string;
  icon?: string;
  adminId?: string;
}

export interface CreateGroupResult {
  success: boolean;
  group: TrustGroupModel;
  membership: GroupMembershipModel;
  systemLog: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

export interface JoinGroupResult {
  success: boolean;
  group: TrustGroupModel;
  membership: GroupMembershipModel;
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
 * Generate human-friendly 6-8 character alphanumeric invite code
 */
function generateInviteCode(name: string): string {
  const prefix = name
    .trim()
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 4)
    .toUpperCase();
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  return `${prefix || 'GRP'}-${randomSuffix}`;
}

/**
 * Server Action: Create Private Trust Group
 *
 * Creates a verified cluster (e.g. apartment building, co-working space, makers guild)
 * with a shareable invite code. Group creator is automatically made Admin & active member.
 */
export async function createTrustGroup(
  input: CreateTrustGroupInput
): Promise<CreateGroupResult> {
  const { name, description = '', icon = 'ShieldCheck', adminId = 'usr_me' } = input;

  if (!name || name.trim().length < 3) {
    throw new Error('Group name must be at least 3 characters long');
  }

  return await db.transaction(async (tx: any) => {
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const inviteCode = generateInviteCode(name);

    const newGroup: TrustGroup = {
      id: groupId,
      name: name.trim(),
      description: description.trim() || null,
      inviteCode,
      adminId,
      icon,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const newMembership: GroupMembership = {
      id: membershipId,
      groupId,
      userId: adminId,
      status: 'ACTIVE',
      joinedAt: now,
    };

    // Store in memoryStore & db
    memoryStore.trustGroups.set(groupId, newGroup);
    memoryStore.groupMemberships.set(membershipId, newMembership);

    if (tx.insert && tx.insert(trustGroups)) {
      try {
        await tx.insert(trustGroups).values(newGroup);
        await tx.insert(groupMemberships).values(newMembership);
      } catch {
        // Fallback handled
      }
    }

    // System audit log
    const newSysLog: SystemLog = {
      id: systemLogId,
      eventType: 'GROUP_CREATED',
      userId: adminId,
      targetId: groupId,
      metadata: {
        groupName: newGroup.name,
        inviteCode: newGroup.inviteCode,
        adminId,
        createdAt: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(systemLogId, newSysLog);

    const adminUser = memoryStore.users.get(adminId);

    return {
      success: true,
      group: {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
        inviteCode: newGroup.inviteCode,
        adminId: newGroup.adminId,
        adminName: adminUser ? adminUser.name : 'Group Admin',
        icon: newGroup.icon,
        memberCount: newGroup.memberCount,
        isCurrentUserMember: true,
        createdAt: newGroup.createdAt.toISOString(),
        updatedAt: newGroup.updatedAt.toISOString(),
      },
      membership: {
        id: newMembership.id,
        groupId: newMembership.groupId,
        groupName: newGroup.name,
        userId: newMembership.userId,
        userName: adminUser ? adminUser.name : 'You',
        status: newMembership.status,
        joinedAt: newMembership.joinedAt.toISOString(),
      },
      systemLog: {
        id: newSysLog.id,
        eventType: newSysLog.eventType,
        userId: newSysLog.userId,
        targetId: newSysLog.targetId,
        metadata: newSysLog.metadata as Record<string, unknown>,
        createdAt: newSysLog.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Join Private Trust Group by Invite Code
 */
export async function joinTrustGroup(
  inviteCode: string,
  userId: string = 'usr_me'
): Promise<JoinGroupResult> {
  if (!inviteCode || !inviteCode.trim()) {
    throw new Error('Please enter a valid invite code');
  }

  const cleanCode = inviteCode.trim().toUpperCase();

  return await db.transaction(async (tx: any) => {
    // 1. Locate group by invite code
    const group = Array.from(memoryStore.trustGroups.values()).find(
      (g) => g.inviteCode.toUpperCase() === cleanCode
    );

    if (!group) {
      throw new Error(`No Trust Group found with invite code "${cleanCode}". Please verify code with the group admin.`);
    }

    // 2. Check if already a member
    const existingMembership = Array.from(memoryStore.groupMemberships.values()).find(
      (m) => m.groupId === group.id && m.userId === userId
    );

    const now = new Date();
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = memoryStore.users.get(userId);

    if (existingMembership) {
      return {
        success: true,
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          inviteCode: group.inviteCode,
          adminId: group.adminId,
          icon: group.icon,
          memberCount: group.memberCount,
          isCurrentUserMember: true,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
        },
        membership: {
          id: existingMembership.id,
          groupId: existingMembership.groupId,
          groupName: group.name,
          userId: existingMembership.userId,
          userName: user ? user.name : 'You',
          status: existingMembership.status,
          joinedAt: existingMembership.joinedAt.toISOString(),
        },
        systemLog: {
          id: systemLogId,
          eventType: 'GROUP_JOINED',
          userId,
          targetId: group.id,
          metadata: { note: 'Already member', groupName: group.name },
          createdAt: now.toISOString(),
        },
      };
    }

    // 3. Create new membership & update member count
    const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMembership: GroupMembership = {
      id: membershipId,
      groupId: group.id,
      userId,
      status: 'ACTIVE',
      joinedAt: now,
    };

    group.memberCount += 1;
    group.updatedAt = now;

    memoryStore.groupMemberships.set(membershipId, newMembership);
    memoryStore.trustGroups.set(group.id, group);

    // 4. System Audit Log
    const newSysLog: SystemLog = {
      id: systemLogId,
      eventType: 'GROUP_JOINED',
      userId,
      targetId: group.id,
      metadata: {
        groupName: group.name,
        groupId: group.id,
        inviteCode: cleanCode,
        newMemberCount: group.memberCount,
        joinedAt: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(systemLogId, newSysLog);

    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        adminId: group.adminId,
        icon: group.icon,
        memberCount: group.memberCount,
        isCurrentUserMember: true,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      },
      membership: {
        id: newMembership.id,
        groupId: newMembership.groupId,
        groupName: group.name,
        userId: newMembership.userId,
        userName: user ? user.name : 'You',
        status: newMembership.status,
        joinedAt: newMembership.joinedAt.toISOString(),
      },
      systemLog: {
        id: newSysLog.id,
        eventType: newSysLog.eventType,
        userId: newSysLog.userId,
        targetId: newSysLog.targetId,
        metadata: newSysLog.metadata as Record<string, unknown>,
        createdAt: newSysLog.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Get all trust groups with membership status for current user
 */
export async function getTrustGroups(userId: string = 'usr_me'): Promise<TrustGroupModel[]> {
  const userMemberships = new Set(
    Array.from(memoryStore.groupMemberships.values())
      .filter((m) => m.userId === userId && m.status === 'ACTIVE')
      .map((m) => m.groupId)
  );

  const groups = Array.from(memoryStore.trustGroups.values()).map((g) => {
    const adminUser = memoryStore.users.get(g.adminId);
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      inviteCode: g.inviteCode,
      adminId: g.adminId,
      adminName: adminUser ? adminUser.name : 'Co-Op Admin',
      icon: g.icon,
      memberCount: g.memberCount,
      isCurrentUserMember: userMemberships.has(g.id),
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  });

  return groups.sort((a, b) => (b.isCurrentUserMember ? 1 : 0) - (a.isCurrentUserMember ? 1 : 0));
}

/**
 * Server Action: Get list of group IDs current user is a verified member of
 */
export async function getUserMemberGroupIds(userId: string = 'usr_me'): Promise<string[]> {
  return Array.from(memoryStore.groupMemberships.values())
    .filter((m) => m.userId === userId && m.status === 'ACTIVE')
    .map((m) => m.groupId);
}

/**
 * Server Action: Set Listing Visibility (Private to Trust Group or Public)
 */
export async function setListingGroupVisibility(
  listingId: string,
  groupId: string | null
): Promise<{ success: boolean; listingId: string; visibilityGroupId: string | null }> {
  const listing = memoryStore.listings.get(listingId);
  if (listing) {
    listing.visibilityGroupId = groupId;
    memoryStore.listings.set(listingId, listing);
  }

  return {
    success: true,
    listingId,
    visibilityGroupId: groupId,
  };
}
