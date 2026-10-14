import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  KeyRound,
  Copy,
  Check,
  Lock,
  ArrowRight,
  Hammer,
  Cpu,
  Building,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  X,
} from 'lucide-react';
import { TrustGroupModel } from '../../types';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

interface TrustGroupHubProps {
  currentUserId: string | null;
  onFilterByGroup?: (groupId: string | null, groupName?: string) => void;
  activeSelectedGroupId?: string | null;
  onRequireSignIn: () => void;
  /** Called after joining or starting a circle so the marketplace can show its listings. */
  onMembershipChange?: () => void;
}

export function TrustGroupHub({
  currentUserId,
  onFilterByGroup,
  activeSelectedGroupId = null,
  onRequireSignIn,
  onMembershipChange,
}: TrustGroupHubProps) {
  const [groups, setGroups] = useState<TrustGroupModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('ShieldCheck');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Load Groups
  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const data = await api.circles();
      setGroups(data);
    } catch (err) {
      console.error('Failed to load trust groups', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [currentUserId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim() || !currentUserId) return;

    setIsActionPending(true);
    setStatusMessage(null);
    try {
      const res = { group: await api.joinCircle(inviteCodeInput.trim()) };
      setStatusMessage({
        type: 'success',
        text: `Welcome to ${res.group.name}! You can now see what its members share.`,
      });
      setInviteCodeInput('');
      fetchGroups();
      onMembershipChange?.();
      setTimeout(() => setShowJoinModal(false), 1500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || "That code didn't work. Please check it with a member.",
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !currentUserId) return;

    setIsActionPending(true);
    setStatusMessage(null);
    try {
      const res = {
        group: await api.createCircle({ name: newGroupName.trim(), description: newGroupDesc.trim(), icon: newGroupIcon }),
      };
      setStatusMessage({
        type: 'success',
        text: `${res.group.name} is ready. Share the code ${res.group.inviteCode} with people you'd like to invite.`,
      });
      setNewGroupName('');
      setNewGroupDesc('');
      fetchGroups();
      onMembershipChange?.();
      setTimeout(() => setShowCreateModal(false), 1500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'We could not start that circle. Please try again.',
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const getGroupIcon = (iconName?: string | null) => {
    switch (iconName) {
      case 'Hammer':
        return <Hammer className="w-5 h-5" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5" />;
      case 'Building':
        return <Building className="w-5 h-5" />;
      default:
        return <ShieldCheck className="w-5 h-5" />;
    }
  };

  return (
    <div id="trust-group-hub" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold tracking-wide border border-emerald-500/30">
              <Lock className="w-3.5 h-3.5" />
              Private circles
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Share with people you know
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Keep your best gear within your building, makerspace or street. Only members of a circle can see what's shared in it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              id="open-join-group-modal-btn"
              onClick={() => {
                if (!currentUserId) return onRequireSignIn();
                setStatusMessage(null);
                setShowJoinModal(true);
              }}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-semibold rounded-xl border border-zinc-700 transition-all flex items-center gap-2 shadow-sm"
            >
              <KeyRound className="w-4 h-4 text-emerald-400" />
              I have a code
            </button>
            <button
              id="open-create-group-modal-btn"
              onClick={() => {
                if (!currentUserId) return onRequireSignIn();
                setStatusMessage(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30"
            >
              <Plus className="w-4 h-4" />
              Start a circle
            </button>
          </div>
        </div>
      </div>

      {/* Filter indicator if a group is currently active */}
      {activeSelectedGroupId && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-900">
              Showing listings from{' '}
              <strong className="font-bold">
                {groups.find((g) => g.id === activeSelectedGroupId)?.name || 'Selected Group'}
              </strong>
            </span>
          </div>
          <button
            onClick={() => onFilterByGroup && onFilterByGroup(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
          >
            Show everything
          </button>
        </div>
      )}

      {/* Group Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-600" />
            Circles ({groups.length})
          </h3>

        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-zinc-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => {
              const isSelected = activeSelectedGroupId === group.id;
              return (
                <div
                  key={group.id}
                  id={`trust-group-card-${group.id}`}
                  className={cn(
                    'p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 bg-white shadow-sm hover:shadow-md',
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                      : 'border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-xl">
                        {getGroupIcon(group.icon)}
                      </div>
                      {group.isCurrentUserMember ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Member
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-semibold">
                          Invite only
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-zinc-900">{group.name}</h4>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                        {group.description || 'A private sharing circle.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 space-y-3">
                    {/* Members & invite code. The code is only ever shown to members. */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </span>

                      {group.isCurrentUserMember && (
                      <button
                        type="button"
                        onClick={() => handleCopyCode(group.inviteCode)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded font-mono text-[11px] font-semibold transition-colors"
                        title="Copy shareable invite code"
                      >
                        {copiedCode === group.inviteCode ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-zinc-400" />
                        )}
                        {group.inviteCode}
                      </button>
                      )}
                    </div>

                    {!group.isCurrentUserMember ? (
                      <p className="text-[11px] text-zinc-500 text-center">Ask a member for the invite code to join.</p>
                    ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (onFilterByGroup) {
                          onFilterByGroup(isSelected ? null : group.id, group.name);
                        }
                      }}
                      className={cn(
                        'w-full py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5',
                        isSelected
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800'
                      )}
                    >
                      {isSelected ? 'Showing its listings' : 'See what it shares'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Join a circle</h3>
                <p className="text-xs text-zinc-500">Enter the invite code a member shared with you</p>
              </div>
            </div>

            {statusMessage && (
              <div
                className={cn(
                  'p-3 rounded-xl text-xs font-medium mb-4',
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                )}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Invite code
                </label>
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE-12"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-mono text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-zinc-900 uppercase"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {isActionPending ? 'Joining…' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Start a circle</h3>
                <p className="text-xs text-zinc-500">You'll get an invite code to share with people you trust</p>
              </div>
            </div>

            {statusMessage && (
              <div
                className={cn(
                  'p-3 rounded-xl text-xs font-medium mb-4',
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                )}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Kloof Street Maker Collective"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Who is it for, and what will you share?"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'ShieldCheck', label: 'Shield', icon: <ShieldCheck className="w-4 h-4" /> },
                    { id: 'Hammer', label: 'Workshop', icon: <Hammer className="w-4 h-4" /> },
                    { id: 'Cpu', label: 'Tech/Lab', icon: <Cpu className="w-4 h-4" /> },
                    { id: 'Building', label: 'Building', icon: <Building className="w-4 h-4" /> },
                  ].map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setNewGroupIcon(ic.id)}
                      className={cn(
                        'p-2 rounded-xl border flex flex-col items-center gap-1 text-xs font-medium transition-colors',
                        newGroupIcon === ic.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      )}
                    >
                      {ic.icon}
                      <span className="text-[10px]">{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-900/20"
                >
                  {isActionPending ? 'Creating…' : 'Create circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
