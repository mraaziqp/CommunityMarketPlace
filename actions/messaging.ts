'use server';

import { db, memoryStore } from '../db';
import {
  conversations,
  messages,
  users,
  listings,
  systemLogs,
  type Conversation,
  type Message,
  type SystemLog,
} from '../db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import type { ConversationModel, MessageModel } from '../src/types';

export interface SendMessageResult {
  success: boolean;
  message: MessageModel;
  systemLog?: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

export interface ConversationDetailResult {
  success: boolean;
  conversation: ConversationModel | null;
  messages: MessageModel[];
}

/**
 * Server Action: Get all conversations for a specific user (either as renter or host)
 */
export async function getConversationsForUser(
  userId: string = 'usr_me'
): Promise<ConversationModel[]> {
  const result: ConversationModel[] = [];

  for (const conv of memoryStore.conversations.values()) {
    if (conv.renterId === userId || conv.hostId === userId) {
      const renter = memoryStore.users.get(conv.renterId);
      const host = memoryStore.users.get(conv.hostId);
      const listing = memoryStore.listings.get(conv.listingId);

      // Find last message and unread count
      let lastMsgText = '';
      let unreadCount = 0;
      const convMsgs: Message[] = [];

      for (const msg of memoryStore.messages.values()) {
        if (msg.conversationId === conv.id) {
          convMsgs.push(msg);
          if (msg.senderId !== userId && !msg.readAt) {
            unreadCount++;
          }
        }
      }

      convMsgs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (convMsgs.length > 0) {
        lastMsgText = convMsgs[0].content;
      }

      result.push({
        id: conv.id,
        listingId: conv.listingId,
        listingTitle: listing?.title || 'Shared Community Asset',
        listingImage: listing?.images?.[0] || 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=400&auto=format&fit=crop&q=80',
        listingPriceInCents: (listing as any)?.dailyRateInCents || 15000,
        renterId: conv.renterId,
        renterName: renter?.name || 'Community Neighbor',
        renterImage: renter?.image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        hostId: conv.hostId,
        hostName: host?.name || 'Asset Host',
        hostImage: host?.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        lastMessage: lastMsgText,
        lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : conv.createdAt.toISOString(),
        unreadCount,
        createdAt: conv.createdAt.toISOString(),
      });
    }
  }

  // Sort by lastMessageAt descending
  return result.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

/**
 * Server Action: Get or Create a Conversation thread between Renter and Host for a Listing
 */
export async function getOrCreateConversation(
  listingId: string,
  renterId: string = 'usr_me',
  hostId: string = 'usr_host_marcus'
): Promise<ConversationModel> {
  // Check if thread already exists
  for (const conv of memoryStore.conversations.values()) {
    if (
      conv.listingId === listingId &&
      ((conv.renterId === renterId && conv.hostId === hostId) ||
        (conv.renterId === hostId && conv.hostId === renterId))
    ) {
      const renter = memoryStore.users.get(conv.renterId);
      const host = memoryStore.users.get(conv.hostId);
      const listing = memoryStore.listings.get(conv.listingId);

      return {
        id: conv.id,
        listingId: conv.listingId,
        listingTitle: listing?.title || 'Shared Community Asset',
        listingImage: listing?.images?.[0] || 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=400&auto=format&fit=crop&q=80',
        renterId: conv.renterId,
        renterName: renter?.name || 'Alex Rivera',
        renterImage: renter?.image || '',
        hostId: conv.hostId,
        hostName: host?.name || 'Marcus Thorne',
        hostImage: host?.image || '',
        lastMessageAt: conv.lastMessageAt.toISOString(),
        createdAt: conv.createdAt.toISOString(),
      };
    }
  }

  // Create new conversation
  const newConvId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();

  const newConv: Conversation = {
    id: newConvId,
    listingId,
    renterId,
    hostId,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };

  memoryStore.conversations.set(newConvId, newConv);

  const renter = memoryStore.users.get(renterId);
  const host = memoryStore.users.get(hostId);
  const listing = memoryStore.listings.get(listingId);

  return {
    id: newConv.id,
    listingId: newConv.listingId,
    listingTitle: listing?.title || 'Shared Community Asset',
    listingImage: listing?.images?.[0] || 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=400&auto=format&fit=crop&q=80',
    renterId: newConv.renterId,
    renterName: renter?.name || 'Alex Rivera',
    renterImage: renter?.image || '',
    hostId: newConv.hostId,
    hostName: host?.name || 'Marcus Thorne',
    hostImage: host?.image || '',
    lastMessageAt: now.toISOString(),
    createdAt: now.toISOString(),
  };
}

/**
 * Server Action: Get Conversation Details & Messages
 * Used by the client polling loop (every 3 seconds) for responsive chat
 */
export async function getConversation(
  conversationId: string,
  currentUserId: string = 'usr_me'
): Promise<ConversationDetailResult> {
  const conv = memoryStore.conversations.get(conversationId);
  if (!conv) {
    return { success: false, conversation: null, messages: [] };
  }

  const renter = memoryStore.users.get(conv.renterId);
  const host = memoryStore.users.get(conv.hostId);
  const listing = memoryStore.listings.get(conv.listingId);

  const rawMsgs: Message[] = [];
  for (const m of memoryStore.messages.values()) {
    if (m.conversationId === conversationId) {
      rawMsgs.push(m);
    }
  }

  // Sort chronological ascending
  rawMsgs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const messagesList: MessageModel[] = rawMsgs.map((m) => {
    const sender = memoryStore.users.get(m.senderId);
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: sender?.name || (m.senderId === currentUserId ? 'You' : 'Participant'),
      senderImage: sender?.image || '',
      senderRole: sender?.role,
      content: m.content,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      isOutgoing: m.senderId === currentUserId,
    };
  });

  const conversationModel: ConversationModel = {
    id: conv.id,
    listingId: conv.listingId,
    listingTitle: listing?.title || 'Shared Community Asset',
    listingImage: listing?.images?.[0] || 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=400&auto=format&fit=crop&q=80',
    listingPriceInCents: (listing as any)?.dailyRateInCents || 15000,
    renterId: conv.renterId,
    renterName: renter?.name || 'Alex Rivera',
    renterImage: renter?.image || '',
    hostId: conv.hostId,
    hostName: host?.name || 'Marcus Thorne',
    hostImage: host?.image || '',
    lastMessage: messagesList[messagesList.length - 1]?.content || '',
    lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : conv.createdAt.toISOString(),
    createdAt: conv.createdAt.toISOString(),
  };

  return {
    success: true,
    conversation: conversationModel,
    messages: messagesList,
  };
}

/**
 * Server Action: Send Message
 * Dispatches a message and registers an audit log in SystemLogs
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  senderId: string = 'usr_me'
): Promise<SendMessageResult> {
  if (!conversationId) {
    throw new Error('Invalid parameter: conversationId is required');
  }
  if (!content || !content.trim()) {
    throw new Error('Invalid parameter: content cannot be empty');
  }

  const trimmed = content.trim();
  const conv = memoryStore.conversations.get(conversationId);
  if (!conv) {
    throw new Error(`Conversation '${conversationId}' not found`);
  }

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();

  const newMsg: Message = {
    id: msgId,
    conversationId,
    senderId,
    content: trimmed,
    readAt: null,
    createdAt: now,
  };
  memoryStore.messages.set(msgId, newMsg);

  // Update conversation lastMessageAt
  const updatedConv: Conversation = {
    ...conv,
    lastMessageAt: now,
    updatedAt: now,
  };
  memoryStore.conversations.set(conversationId, updatedConv);

  const sender = memoryStore.users.get(senderId);

  // Log to SystemLogs audit ledger
  const logId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const systemLogRecord: SystemLog = {
    id: logId,
    eventType: 'MESSAGE_SENT',
    userId: senderId,
    targetId: conversationId,
    metadata: {
      action: 'P2P_MESSAGE_SENT',
      conversationId,
      messageId: msgId,
      senderId,
      recipientId: senderId === conv.renterId ? conv.hostId : conv.renterId,
      contentSnippet: trimmed.length > 60 ? `${trimmed.substring(0, 60)}...` : trimmed,
      listingId: conv.listingId,
      timestamp: now.toISOString(),
    },
    createdAt: now,
  };
  memoryStore.systemLogs.set(logId, systemLogRecord);

  return {
    success: true,
    message: {
      id: newMsg.id,
      conversationId: newMsg.conversationId,
      senderId: newMsg.senderId,
      senderName: sender?.name || 'Alex Rivera',
      senderImage: sender?.image || '',
      senderRole: sender?.role,
      content: newMsg.content,
      readAt: null,
      createdAt: now.toISOString(),
      isOutgoing: true,
    },
    systemLog: {
      id: systemLogRecord.id,
      eventType: systemLogRecord.eventType,
      userId: systemLogRecord.userId,
      targetId: systemLogRecord.targetId,
      metadata: systemLogRecord.metadata,
      createdAt: systemLogRecord.createdAt.toISOString(),
    },
  };
}

/**
 * Server Action: Mark Messages as Read
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string = 'usr_me'
): Promise<{ success: boolean; count: number }> {
  let count = 0;
  const now = new Date();

  for (const msg of memoryStore.messages.values()) {
    if (msg.conversationId === conversationId && msg.senderId !== userId && !msg.readAt) {
      msg.readAt = now;
      count++;
    }
  }

  return { success: true, count };
}
