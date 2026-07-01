import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { authService } from '../../../../services/authService';
import { toast } from 'sonner';

export default function SettingsProfile() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!/^[a-zA-Z\s]+$/.test(fullName)) {
      newErrors.fullName = 'Name must contain only English letters.';
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      newErrors.phone = 'Phone number must be exactly 10 digits.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form.');
      return;
    }
    setIsSaving(true);
    setErrors({});
    try {
      const updatedUser = await authService.updateProfile({
        name: fullName,
        email,
        phone: phone || undefined,
      });
      updateUser(updatedUser);
      setSaved(true);
      toast.success('Profile settings saved successfully!');
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save profile settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl animate-in fade-in duration-300">
      <div className="bg-white border border-slate-100 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">My Profile</h2>
            <p className="text-[14px] text-slate-500 mt-1">Manage your personal details and public profile info.</p>
          </div>
          {saved && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e6f4ef] border border-[#0b8252]/20 text-[#0b8252] text-xs font-bold animate-pulse">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Changes saved successfully!
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full bg-slate-50/50 border ${errors.fullName ? 'border-rose-500' : 'border-slate-200'} text-slate-800 text-[15px] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] focus:bg-white transition-all`}
                required
              />
              {errors.fullName && <p className="text-[10px] text-rose-500 font-medium">{errors.fullName}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] focus:bg-white transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full bg-slate-50/50 border ${errors.phone ? 'border-rose-500' : 'border-slate-200'} text-slate-800 text-[15px] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] focus:bg-white transition-all`}
              />
              {errors.phone && <p className="text-[10px] text-rose-500 font-medium">{errors.phone}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Account Role</label>
              <div className="relative">
                <input
                  type="text"
                  value={user?.role || 'INVENTORY_MANAGER'}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-slate-500 text-[15px] rounded-xl px-4 py-3 cursor-not-allowed font-medium"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  Verified
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#0b8252] hover:bg-[#096b43] text-white font-bold text-[14px] rounded-xl shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isSaving ? 'Saving...' : 'Save Profile Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
