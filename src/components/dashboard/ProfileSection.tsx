import React, { useState, useRef } from 'react';
import {
  User,
  MapPin,
  Phone,
  FileText,
  Camera,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { UserModel } from '../../types';
import { api } from '../../api/client';
import { prepareImage } from '../../lib/images';

export interface ProfileSectionProps {
  currentUser: UserModel;
  onUserUpdated: (user: UserModel) => void;
  onSignOut: () => void;
  showToast: (msg: string, tone?: 'success' | 'info') => void;
}

const inputClass =
  'w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 outline-none transition-all';

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  currentUser,
  onUserUpdated,
  onSignOut,
  showToast,
}) => {
  // Profile details state
  const [name, setName] = useState(currentUser.name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [neighborhood, setNeighborhood] = useState(currentUser.neighborhood || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber || '');
  const [avatar, setAvatar] = useState(currentUser.image || '');

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const prepared = await prepareImage(file);
      if (prepared.success === true) {
        setAvatar(prepared.dataUrl);
        const updatedUser = await api.updateProfile({ image: prepared.dataUrl });
        onUserUpdated(updatedUser);
        showToast('Profile photo updated.');
      } else {
        setProfileError(prepared.error);
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Could not update photo.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setIsUpdatingProfile(true);
    try {
      const user = await api.updateProfile({
        name: name.trim(),
        bio: bio.trim() || null,
        neighborhood: neighborhood.trim() || null,
        phoneNumber: phoneNumber.trim() || null,
      });
      onUserUpdated(user);
      showToast('Profile details saved.');
    } catch (err: any) {
      setProfileError(err?.message || 'Could not save profile details.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.');
    } catch (err: any) {
      setPasswordError(err?.message || 'Could not change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your Profile & Settings</h2>
        <p className="text-xs text-slate-500">Manage your public information, avatar and security credentials</p>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSaveProfile} className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-slate-100">
          {/* Avatar with Upload Button */}
          <div className="relative group shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-md cursor-pointer transition-colors"
              title="Change photo"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-base font-bold text-slate-900">{currentUser.name}</h3>
              {currentUser.role === 'VERIFIED_HOST' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Host
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{currentUser.email}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Trust Score: <strong className="text-slate-700">{currentUser.trustScore} / 100</strong>
            </p>
          </div>
        </div>

        {profileError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{profileError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Full Name</span>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass + ' pl-9'}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Neighbourhood</span>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="e.g. Observatory, Rondebosch, Sea Point"
                className={inputClass + ' pl-9'}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</span>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+27 82 123 4567"
                className={inputClass + ' pl-9'}
              />
            </div>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700 block mb-1">About You (Bio)</span>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell your neighbours a little about yourself, your tools, or your interests..."
                className={inputClass + ' pl-9'}
              />
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isUpdatingProfile}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
          >
            {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>Save Profile Changes</span>
          </button>
        </div>
      </form>

      {/* Password Change Form */}
      <form onSubmit={handleChangePassword} className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Lock className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Change Password</h3>
        </div>

        {passwordError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{passwordError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Current Password</span>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">New Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 chars"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Confirm New Password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm"
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isChangingPassword}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Update Password</span>
          </button>
        </div>
      </form>

      {/* Account Actions / Sign Out */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Account Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">Sign out from your account on this browser</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-rose-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
