import React, { useState } from 'react';
import { toast } from 'sonner';
import { authService } from '../../../../services/authService';

export default function SettingsAccount() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePassword = (password: string) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      toast.error('New passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Password must be at least 8 characters long, and include uppercase, lowercase, number and special character');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.updatePassword({ currentPassword, newPassword });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update password.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl animate-in fade-in duration-300">
      <div className="bg-white border border-slate-100 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Account Settings</h2>
            <p className="text-[14px] text-slate-500 mt-1">Configure your login preferences and system security.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-6">
          <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#0b8252]">lock</span>
            Change Password
          </h3>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-[14px] text-red-600 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex flex-col gap-2 col-span-2 md:col-span-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] focus:bg-white transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            
            <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] focus:bg-white transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] focus:bg-white transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#0b8252] hover:bg-[#096b43] text-white font-bold text-[14px] rounded-xl shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
