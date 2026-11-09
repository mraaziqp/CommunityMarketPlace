import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  X,
  Loader2,
  Search,
  Check,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { ConversationModel, MessageModel, UserModel } from '../../types';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

export interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialConversationId?: string | null;
  initialListingId?: string | null;
  currentUser: UserModel | null;
  onSelectListing?: (listingId: string) => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  initialConversationId,
  initialListingId,
  currentUser,
  onSelectListing,
}) => {
  const [conversations, setConversations] = useState<ConversationModel[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationModel | null>(null);
  const [messages, setMessages] = useState<MessageModel[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Fetch list of user conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    try {
      setIsLoadingList(true);
      const list = await api.conversations();
      setConversations(list);
    } catch (err: any) {
      setError(err?.message || 'Could not load messages');
    } finally {
      setIsLoadingList(false);
    }
  }, [currentUser]);

  // Initial load when drawer opens
  useEffect(() => {
    if (isOpen && currentUser) {
      loadConversations();
    } else {
      setSelectedConversationId(null);
      setActiveConversation(null);
      setMessages([]);
      setDraftMessage('');
      setError(null);
    }
  }, [isOpen, currentUser, loadConversations]);

  // Handle initialConversationId or initialListingId
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    if (initialConversationId) {
      setSelectedConversationId(initialConversationId);
    } else if (initialListingId) {
      // Find or start conversation for this listing
      api
        .startConversation(initialListingId)
        .then((conv) => {
          setSelectedConversationId(conv.id);
          setActiveConversation(conv);
          loadConversations();
        })
        .catch((err) => {
          setError(err?.message || 'Failed to open chat for listing');
        });
    }
  }, [isOpen, currentUser, initialConversationId, initialListingId, loadConversations]);

  // Fetch active conversation messages
  const loadMessages = useCallback(
    async (convId: string, showSpinner = false) => {
      if (showSpinner) setIsLoadingMessages(true);
      try {
        const res = await api.conversation(convId);
        setActiveConversation(res.conversation);
        setMessages(res.messages);
        // Mark as read in background
        api.markMessagesRead(convId).catch(() => {});
      } catch (err: any) {
        setError(err?.message || 'Failed to load conversation thread');
      } finally {
        if (showSpinner) setIsLoadingMessages(false);
      }
    },
    []
  );

  // When selectedConversationId changes, load messages
  useEffect(() => {
    if (!selectedConversationId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    loadMessages(selectedConversationId, true);
    inputRef.current?.focus();

    // Poll every 3.5 seconds while viewing this conversation
    const timer = setInterval(() => {
      loadMessages(selectedConversationId, false);
    }, 3500);

    return () => clearInterval(timer);
  }, [selectedConversationId, loadMessages]);

  // Auto-scroll when messages update
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConversationId || !draftMessage.trim() || isSending) return;

    const content = draftMessage.trim();
    setDraftMessage('');
    setIsSending(true);
    setError(null);

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: MessageModel = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'You',
      content,
      createdAt: new Date().toISOString(),
      isOutgoing: true,
      readAt: null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const realMessage = await api.sendMessage(selectedConversationId, content);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMessage : m)));
      loadConversations();
    } catch (err: any) {
      setError(err?.message || 'Message could not be sent. Please retry.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraftMessage(content);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const otherName = (c.renterId === currentUser?.id ? c.hostName : c.renterName) || '';
    const title = c.listingTitle || '';
    const last = c.lastMessage || '';
    return (
      otherName.toLowerCase().includes(term) ||
      title.toLowerCase().includes(term) ||
      last.toLowerCase().includes(term)
    );
  });

  const otherPersonName =
    activeConversation && currentUser
      ? activeConversation.renterId === currentUser.id
        ? activeConversation.hostName || 'Host'
        : activeConversation.renterName || 'Neighbour'
      : '';

  const otherPersonImage =
    activeConversation && currentUser
      ? activeConversation.renterId === currentUser.id
        ? activeConversation.hostImage
        : activeConversation.renterImage
      : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Messages"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity duration-300 animate-in fade-in"
    >
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200/90 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedConversationId ? (
              <button
                type="button"
                onClick={() => setSelectedConversationId(null)}
                className="p-1.5 -ml-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                aria-label="Back to messages"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4.5 h-4.5" />
              </div>
            )}

            <div className="min-w-0">
              {selectedConversationId ? (
                <div>
                  <h2 className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                    {otherPersonImage && (
                      <img
                        src={otherPersonImage}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <span>{otherPersonName}</span>
                  </h2>
                  {activeConversation?.listingTitle && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectListing && activeConversation?.listingId) {
                          onSelectListing(activeConversation.listingId);
                          onClose();
                        }
                      }}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 truncate max-w-xs block text-left cursor-pointer transition-colors"
                    >
                      Regarding: {activeConversation.listingTitle}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="font-bold text-base text-slate-900">Community Messages</h2>
                  <p className="text-[11px] text-slate-500">In-app chats with hosts and neighbours</p>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-600 hover:text-rose-900 font-bold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        {selectedConversationId ? (
          /* Active Thread View */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                  <p className="text-xs">Loading conversation…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Start the conversation</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Ask questions about equipment condition, arrange handover times, or check availability.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === currentUser?.id || m.isOutgoing;
                  const time = new Date(m.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={m.id}
                      className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-2xs whitespace-pre-wrap break-words leading-relaxed',
                          isMe
                            ? 'bg-slate-900 text-white rounded-br-xs'
                            : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                        )}
                      >
                        {m.content}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400">
                        <span>{time}</span>
                        {isMe && (
                          <span>
                            {m.readAt ? (
                              <CheckCheck className="w-3 h-3 text-emerald-500 inline" />
                            ) : (
                              <Check className="w-3 h-3 inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-slate-200/90 flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder={`Message ${otherPersonName || 'host'}…`}
                aria-label="Message input"
                disabled={isSending}
                className="flex-1 min-w-0 px-3.5 py-2 text-xs sm:text-sm bg-slate-100 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all placeholder:text-slate-400 text-slate-900"
              />
              <button
                type="submit"
                disabled={!draftMessage.trim() || isSending}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 transition-all cursor-pointer shrink-0 shadow-xs"
                aria-label="Send message"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Conversation List View */
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Search Filter */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter by neighbour or item…"
                  aria-label="Filter conversations"
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200/80 focus:border-slate-400 outline-none transition-colors"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoadingList ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                  <p className="text-xs">Loading conversations…</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="py-16 px-6 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">No messages yet</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    When you inquire about a listing or receive a booking inquiry, your chats will appear here.
                  </p>
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isRenter = c.renterId === currentUser?.id;
                  const partnerName = isRenter ? c.hostName || 'Host' : c.renterName || 'Neighbour';
                  const partnerImage = isRenter ? c.hostImage : c.renterImage;
                  const hasUnread = (c.unreadCount || 0) > 0;
                  const time = new Date(c.lastMessageAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConversationId(c.id)}
                      className={cn(
                        'w-full p-3.5 text-left flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors',
                        hasUnread && 'bg-indigo-50/40'
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {partnerImage ? (
                          <img
                            src={partnerImage}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                            {partnerName.charAt(0)}
                          </div>
                        )}
                        {c.listingImage && (
                          <img
                            src={c.listingImage}
                            alt=""
                            className="w-5 h-5 rounded-md object-cover border border-white shadow-2xs absolute -bottom-1 -right-1"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={cn('text-xs font-semibold truncate text-slate-900', hasUnread && 'font-bold text-indigo-950')}>
                            {partnerName}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">{time}</span>
                        </div>

                        {c.listingTitle && (
                          <p className="text-[11px] text-indigo-600 font-medium truncate mb-0.5">
                            {c.listingTitle}
                          </p>
                        )}

                        <p className={cn('text-xs text-slate-500 truncate', hasUnread && 'font-semibold text-slate-800')}>
                          {c.lastMessage || 'No messages yet'}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {hasUnread && (
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
