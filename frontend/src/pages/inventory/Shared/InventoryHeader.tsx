import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../hooks/useAuth';
import defaultAvatar from '@/assets/images/default-avatar.png';
import { authService } from '../../../services/authService';
import { toast } from 'sonner';
import { NotificationService, NotificationItem } from '../../../services/notificationService';
import NotificationDetailsPopup from '../../../components/shared/NotificationDetailsPopup';

interface InventoryHeaderProps {
  children?: React.ReactNode;
}

/* ──────────────────────────────────────────────────────────────────────────
   QUICK CREATE MENU CONFIG
   ────────────────────────────────────────────────────────────────────────── */
const quickCreateCategories = [
  {
    label: 'INVENTORY',
    icon: 'inventory_2',
    color: '#0b8252',
    bg: 'from-emerald-50 to-emerald-100/40',
    items: [
      { name: 'Add New Product', path: '/manage-products?tab=new-product', icon: 'add_box' },
      { name: 'Add Category', path: '/manage-products?tab=categories&action=add', icon: 'category' },
    ],
  },
  {
    label: 'PROCUREMENT',
    icon: 'local_shipping',
    color: '#6366f1',
    bg: 'from-indigo-50 to-indigo-100/40',
    items: [
      { name: 'Add Supplier', path: '/procurement?action=new-supplier', icon: 'person_add' },
      { name: 'New GRN', path: '/inventory-operations?tab=grn&action=add', icon: 'receipt_long' },
    ],
  },
  {
    label: 'OPERATIONS',
    icon: 'swap_horiz',
    color: '#f59e0b',
    bg: 'from-amber-50 to-amber-100/40',
    items: [
      { name: 'Add Brand', path: '/manage-products?tab=brands&action=add', icon: 'branding_watermark' },
      { name: 'Stock Adjustment', path: '/inventory-operations?tab=adjustments', icon: 'sync_alt' },
    ],
  },
  {
    label: 'SYSTEM',
    icon: 'settings',
    color: '#64748b',
    bg: 'from-slate-50 to-slate-100/40',
    items: [
      { name: 'Alert Setting', path: '/alerts', icon: 'notification_add' },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   NOTIFICATIONS CONFIG
   ────────────────────────────────────────────────────────────────────────── */
const severityConfig = {
  CRITICAL: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-600 border-red-100',
    label: 'Critical',
    icon: 'error',
  },
  WARNING: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-600 border-amber-100',
    label: 'Warning',
    icon: 'warning',
  },
  INFO: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-600 border-blue-100',
    label: 'Info',
    icon: 'info',
  },
};

/* ── Helper: format role for display ── */
const formatRole = (role: string) => {
  const roleMap: Record<string, string> = {
    ADMIN: 'Administrator',
    INVENTORY_MANAGER: 'Inventory Manager',
    CASHIER: 'Cashier',
  };
  return roleMap[role] || role;
};

/* ──────────────────────────────────────────────────────────────────────────
   SUB-COMPONENT: QUICK CREATE DROPDOWN
   ────────────────────────────────────────────────────────────────────────── */
function QuickCreateDropdown({ activeDropdown, setActiveDropdown }: { activeDropdown: string | null; setActiveDropdown: (name: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isOpen = activeDropdown === 'quickcreate';

  const toggle = () => setActiveDropdown(isOpen ? null : 'quickcreate');
  const close = () => setActiveDropdown(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-xl
          text-white transition-all duration-300 ease-out
          shadow-[0_2px_8px_rgba(11,130,82,0.35)]
          hover:shadow-[0_4px_16px_rgba(11,130,82,0.45)] hover:scale-110
          active:scale-95
          ${isOpen
            ? 'bg-gradient-to-br from-[#096b43] to-[#064e31]'
            : 'bg-gradient-to-br from-[#0b8252] to-[#0a7048]'
          }
        `}
        aria-expanded={isOpen}
        aria-label="Quick create menu"
      >
        <span
          className={`material-symbols-outlined text-[22px] transition-transform duration-300 ease-out ${isOpen ? 'rotate-45' : 'rotate-0'}`}
        >
          add
        </span>
        <span className="absolute inset-0 rounded-xl border-2 border-white/0 hover:border-white/20 transition-all duration-300" />
      </button>

      {isOpen && (
        <div
          className="absolute right-[-14rem] top-[3.2rem] z-50 w-[44rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-gradient-to-r from-[#f0fdf4] via-white to-white">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0b8252]/10">
                <span className="material-symbols-outlined text-[18px] text-[#0b8252]">bolt</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Quick Create</p>
                <p className="text-[11px] text-slate-500">Jump to any action instantly</p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-all duration-150"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-4 gap-0 divide-x divide-slate-100/80">
            {quickCreateCategories.map((category) => (
              <div key={category.label} className="p-4">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br ${category.bg}`}>
                    <span className="material-symbols-outlined text-[14px]" style={{ color: category.color }}>{category.icon}</span>
                  </div>
                  <span className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: category.color }}>{category.label}</span>
                </div>

                <div className="space-y-0.5">
                  {category.items.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => { close(); navigate(item.path); }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-slate-600 hover:bg-[#f0fdf4] hover:text-[#0b8252] transition-all duration-150 group"
                    >
                      <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-[#0b8252] transition-colors">{item.icon}</span>
                      <span className="text-[12.5px] font-medium leading-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 flex items-center justify-between">
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">keyboard</span>
              Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-500">Esc</kbd> to close
            </p>
            <button
              type="button"
              onClick={() => { close(); navigate('/inventory'); }}
              className="text-[11px] font-semibold text-[#0b8252] hover:text-[#096b43] hover:underline flex items-center gap-1 transition-colors"
            >
              Go to Dashboard
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SUB-COMPONENT: NOTIFICATION DROPDOWN
   ────────────────────────────────────────────────────────────────────────── */
function NotificationDropdown({ activeDropdown, setActiveDropdown }: { activeDropdown: string | null; setActiveDropdown: (name: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isOpen = activeDropdown === 'notifications';

  const toggle = () => setActiveDropdown(isOpen ? null : 'notifications');
  const close = () => setActiveDropdown(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await NotificationService.getNotifications();
      if (res.success) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('Error fetching notifications in header:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await NotificationService.dismiss(id);
      if (res.success) {
        toast.success('Notification dismissed.');
        fetchNotifications();
      }
    } catch {
      toast.error('Failed to dismiss notification.');
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className="
          relative flex items-center justify-center w-10 h-10 rounded-xl
          text-slate-600 bg-slate-50 border border-slate-200/80
          hover:bg-white hover:border-slate-300 hover:text-[#0b8252] hover:shadow-sm
          active:scale-95 transition-all duration-200
        "
        aria-expanded={isOpen}
        aria-label="Open notifications"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white" />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-[3.2rem] z-50 w-[23rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-[#f0fdf4] via-white to-white">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0b8252]/10">
                <span className="material-symbols-outlined text-[18px] text-[#0b8252]">notifications_active</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Smart Alerts</p>
                <p className="text-[11px] text-slate-500">{notifications.length} active notifications</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await Promise.all(notifications.map(n => NotificationService.dismiss(n.id)));
                      toast.success('All notifications dismissed.');
                      fetchNotifications();
                    } catch {
                      toast.error('Failed to dismiss all notifications.');
                    }
                  }}
                  className="text-[11px] font-bold text-[#0b8252] hover:text-[#096b43] hover:underline cursor-pointer flex items-center gap-0.5"
                  title="Dismiss all notifications"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                  Dismiss All
                </button>
              )}
              <button type="button" onClick={close} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-all duration-150">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto p-2.5 space-y-1.5">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-400">
                No active notifications
              </div>
            ) : (
              notifications.map((n) => {
                const config = (severityConfig as any)[n.severity] || severityConfig.INFO;
                return (
                  <div
                    key={n.id}
                    onClick={() => setSelectedNotification(n)}
                    className="rounded-xl border border-slate-100 bg-white hover:bg-slate-50/80 p-3 transition-colors duration-150 cursor-pointer group relative"
                  >
                    <div className="flex items-start gap-3 pr-6">
                      <div className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg ${config.badge} border shrink-0`}>
                        <span className="material-symbols-outlined text-[15px]">{config.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-slate-800 group-hover:text-[#0b8252] transition-colors">{n.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed truncate">{n.message}</p>
                        <p className="mt-1.5 text-[10px] text-slate-400 font-medium">{formatTime(n.createdAt)}</p>
                      </div>
                    </div>
                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(e, n.id)}
                      className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 p-0.5 rounded transition-colors"
                      title="Dismiss notification"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/60 p-2.5">
            <button
              type="button"
              onClick={() => { close(); navigate('/alerts'); }}
              className="
                inline-flex w-full items-center justify-center gap-2
                rounded-xl bg-gradient-to-r from-[#0b8252] to-[#0a7048]
                px-4 py-2.5 text-[13px] font-bold text-white
                shadow-sm hover:shadow-md hover:from-[#096b43] hover:to-[#085e3a]
                active:scale-[0.98] transition-all duration-200
              "
            >
              Open Alerts Center
              <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Details Popup */}
      {selectedNotification && (
        <NotificationDetailsPopup
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onActionComplete={fetchNotifications}
        />
      )}
    </div>
  );
}

// Temporary in-memory store for profile settings (resets on page refresh)
let memoryProfileSettings: { fullName?: string; email?: string; customAvatar?: string } = {};

/* ──────────────────────────────────────────────────────────────────────────
   SUB-COMPONENT: PROFILE DROPDOWN
   ────────────────────────────────────────────────────────────────────────── */
function ProfileDropdown({ activeDropdown, setActiveDropdown }: { activeDropdown: string | null; setActiveDropdown: (name: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, logout, updateUser } = useAuth();
  const isOpen = activeDropdown === 'profile';

  const toggle = () => setActiveDropdown(isOpen ? null : 'profile');
  const close = () => setActiveDropdown(null);

  const [profileName, setProfileName] = useState(user?.name || 'User');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileAvatar, setProfileAvatar] = useState(defaultAvatar);
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const userRole = user?.role ? formatRole(user.role) : 'Team Member';

  useEffect(() => {
    const updateDisplayInfo = () => {
      const name = memoryProfileSettings.fullName || user?.name || 'User';
      const email = memoryProfileSettings.email || user?.email || '';
      const phone = user?.phone || '';
      const avatar = memoryProfileSettings.customAvatar || defaultAvatar;
      setProfileName(name);
      setProfileEmail(email);
      setProfilePhone(phone);
      setProfileAvatar(avatar);
    };

    updateDisplayInfo();

    window.addEventListener('stocksense_profile_updated', updateDisplayInfo);

    return () => {
      window.removeEventListener('stocksense_profile_updated', updateDisplayInfo);
    };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className={`
          flex items-center gap-2.5 px-2 py-1.5 rounded-xl
          cursor-pointer group transition-all duration-200
          hover:bg-slate-50 active:scale-[0.97]
          ${isOpen ? 'bg-slate-50 shadow-sm' : ''}
        `}
        aria-expanded={isOpen}
        aria-label="Profile menu"
      >
        <div className="text-right hidden md:block">
          <p className="text-[13px] font-bold leading-tight text-slate-800 group-hover:text-[#0b8252] transition-colors">{profileName}</p>
          <p className="text-[10.5px] font-medium text-slate-500">{userRole}</p>
        </div>
        <div className="relative">
          <img src={profileAvatar} alt={profileName} className="w-9 h-9 rounded-full border-2 border-[#34d399] object-cover shadow-sm bg-white" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
        </div>
        <span className={`material-symbols-outlined text-[15px] text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-[3.2rem] z-50 w-[17.5rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="px-4 pt-5 pb-4 bg-gradient-to-br from-[#f0fdf4] via-[#ecfdf5] to-white border-b border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <img src={profileAvatar} alt={profileName} className="w-14 h-14 rounded-full border-[3px] border-[#34d399] shadow-lg object-cover bg-white" />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 border-[2.5px] border-white rounded-full" />
              </div>
              <p className="text-[15px] font-bold text-slate-800">{profileName}</p>
              <p className="text-[11.5px] text-slate-500 mt-0.5">{profileEmail}</p>
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] bg-emerald-50 text-emerald-600 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {userRole}
              </span>
            </div>
          </div>

          {/* Menu */}
          <div className="py-1.5 px-1.5 space-y-0.5">
            <button
              type="button"
              onClick={() => { close(); setIsEditModalOpen(true); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-[#f0fdf4] hover:text-[#0b8252] transition-all duration-150 group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-100 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-slate-500 group-hover:text-[#0b8252] transition-colors">edit_square</span>
              </div>
              <div className="text-left">
                <p className="text-[12.5px] font-semibold">Edit Profile</p>
                <p className="text-[10.5px] text-slate-400">Update your details</p>
              </div>
            </button>


          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => { close(); logout(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150 group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-red-400 group-hover:text-red-600 transition-colors">logout</span>
              </div>
              <div className="text-left">
                <p className="text-[12.5px] font-semibold">Logout</p>
                <p className="text-[10.5px] text-red-300 group-hover:text-red-400">End your session</p>
              </div>
            </button>
          </div>
        </div>
      )}
      {/* Edit Profile Modal */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0b8252]">edit_square</span>
                Edit Profile
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full bg-[#f8f9fa] border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Username / Email</label>
                <input type="text" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-[#f8f9fa] border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                <input type="text" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+1 (555) 000-0000" className="w-full bg-[#f8f9fa] border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Assigned Role</label>
                <input type="text" value={userRole} disabled className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-medium rounded-lg px-4 py-2.5 cursor-not-allowed" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                disabled={isSaving} 
                onClick={() => setIsEditModalOpen(false)} 
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    const updatedUser = await authService.updateProfile({
                      name: profileName,
                      email: profileEmail,
                      phone: profilePhone || undefined,
                    });
                    updateUser(updatedUser);

                    memoryProfileSettings.fullName = profileName;
                    memoryProfileSettings.email = profileEmail;
                    window.dispatchEvent(new Event('stocksense_profile_updated'));
                    
                    toast.success('Profile updated successfully!');
                    setIsEditModalOpen(false);
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err.response?.data?.message || 'Failed to update profile.');
                  } finally {
                    setIsSaving(false);
                  }
                }} 
                className="px-5 py-2.5 text-sm font-bold text-white bg-[#0b8252] hover:bg-[#096b43] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSaving && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   MAIN ORCHESTRATOR COMPONENT: INVENTORY HEADER
   ────────────────────────────────────────────────────────────────────────── */
export default function InventoryHeader({ children }: InventoryHeaderProps) {
  const [time, setTime] = useState(new Date());
  // Single active state to make sure only ONE dropdown is open at a time
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [searchParams] = useSearchParams();

  // Generate breadcrumb path automatically based on current location
  const getBreadcrumbs = () => {
    if (currentPath === '/inventory') {
      return (
        <span className="text-[14.5px] font-extrabold text-[#0b8252] tracking-tight">Inventory</span>
      );
    }

    let parentLabel = '';
    let parentPath = '';
    let childLabel = '';

    if (currentPath.startsWith('/manage-products')) {
      parentLabel = 'Product Catalog';
      parentPath = '/manage-products';
    } else if (currentPath.startsWith('/inventory-analytics')) {
      parentLabel = 'Analytics';
      parentPath = '/inventory-analytics';
    } else if (currentPath.startsWith('/inventory-operations')) {
      parentLabel = 'Stock Operations';
      parentPath = '/inventory-operations';
    } else if (currentPath.startsWith('/inventory-adjustments')) {
      parentLabel = 'Adjustments';
      parentPath = '/inventory-adjustments';
    } else if (currentPath.startsWith('/procurement') || currentPath.startsWith('/suppliers')) {
      parentLabel = 'Procurement';
      parentPath = currentPath;
    } else if (currentPath.startsWith('/stock-movements')) {
      parentLabel = 'Stock Movements';
      parentPath = '/stock-movements';
    } else if (currentPath.startsWith('/alerts')) {
      parentLabel = 'Alerts';
      parentPath = '/alerts';
      if (searchParams.get('view') === 'settings') {
        childLabel = 'Settings';
      }
    } else if (currentPath.startsWith('/reports')) {
      parentLabel = 'Reports & Analytics';
      parentPath = '/reports';
      const view = searchParams.get('view');
      if (view && view !== 'overview') {
        const viewMap: Record<string, string> = {
          sales: 'Sales Reports',
          inventory: 'Inventory Reports',
          supplier: 'Supplier Reports',
          activity: 'Adjustment Reports',
          purchase: 'Purchase Reports',
          alert: 'Alert Reports'
        };
        childLabel = viewMap[view] || '';
      }
    } else if (currentPath.startsWith('/settings')) {
      parentLabel = 'Settings';
      parentPath = '/settings';
      const tab = searchParams.get('tab');
      if (tab) childLabel = tab;
    } else if (currentPath.startsWith('/categories')) {
      parentLabel = 'Categories';
      parentPath = '/categories';
    } else {
      const segments = currentPath.split('/').filter(Boolean);
      if (segments.length > 0) {
        parentLabel = segments[segments.length - 1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        parentPath = currentPath;
      }
    }

    if (!parentLabel) {
      return <span className="text-[14.5px] font-extrabold text-[#0b8252] tracking-tight">Inventory</span>;
    }

    return (
      <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-slate-500">
        <Link
          to="/inventory"
          className="hover:text-[#0b8252] transition-colors cursor-pointer"
        >
          Inventory
        </Link>
        <span className="material-symbols-outlined text-[15px] text-slate-400 select-none">chevron_right</span>
        
        {childLabel ? (
          <>
            <Link
              to={parentPath}
              className="hover:text-[#0b8252] transition-colors cursor-pointer"
            >
              {parentLabel}
            </Link>
            <span className="material-symbols-outlined text-[15px] text-slate-400 select-none">chevron_right</span>
            <span className="text-[#0b8252] font-bold">{childLabel}</span>
          </>
        ) : (
          <span className="text-[#0b8252] font-bold">{parentLabel}</span>
        )}
      </div>
    );
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0 w-full z-30 sticky top-0">
      {/* Left side content (Breadcrumbs, Search, etc.) */}
      <div className="flex-1 flex items-center gap-4">
        {getBreadcrumbs()}
        {children}
      </div>

      {/* Right side global actions */}
      <div className="flex items-center gap-3">
        {/* Time Badge */}
        <div className="
          flex items-center gap-2 px-3.5 py-2 rounded-xl
          text-[13px] font-bold text-[#0b8252]
          bg-gradient-to-r from-[#f0fdf4] to-[#ecfdf5]
          border border-emerald-100/60 shadow-sm
        ">
          <span className="material-symbols-outlined text-[18px] opacity-70">schedule</span>
          <span className="tabular-nums tracking-tight">
            {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Quick Create */}
        <QuickCreateDropdown activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />

        {/* Notifications */}
        <NotificationDropdown activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />

        {/* Separator */}
        <div className="h-8 w-px bg-slate-200/80 mx-0.5" />

        {/* Profile */}
        <ProfileDropdown activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
      </div>
    </header>
  );
}
