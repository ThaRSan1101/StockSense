import React, { useState, useEffect } from 'react';
import Sidebar from '../Shared/Sidebar';
import AdminHeader from '../Shared/AdminHeader';
import { authService, AuthUser } from '../../../services/authService';
import { toast } from 'sonner';

export default function AccountManagement() {
  // State
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CASHIER' | 'INVENTORY_MANAGER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CASHIER' as 'CASHIER' | 'INVENTORY_MANAGER',
    status: 'ACTIVE'
  });
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [emailCheck, setEmailCheck] = useState<{ loading: boolean; available: boolean | null; msg: string }>({ loading: false, available: null, msg: '' });
  
  // Password Visibility State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Edit User Form
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'CASHIER' as 'CASHIER' | 'INVENTORY_MANAGER',
    isActive: true
  });

  // Password Reset Modal
  const [passwordResetUser, setPasswordResetUser] = useState<AuthUser | null>(null);

  // Load Users (We load backend users and map additional mock fields like phone/username for UI demonstration if needed, but the backend handles name, email, role)
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await authService.listUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const validateField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'name':
        if (!/^[a-zA-Z\s]+$/.test(value)) error = 'Name must contain only English letters.';
        break;
      case 'phone':
        if (value && !/^\d{10}$/.test(value)) error = 'Phone number must be exactly 10 digits.';
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email address format.';
        break;
      case 'password':
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value)) {
          error = 'Min 8 chars, uppercase, lowercase, number, special character required.';
        }
        break;
      case 'confirmPassword':
        if (value !== formData.password) error = 'Passwords do not match.';
        break;
    }
    setFormErrors(prev => ({ ...prev, [name]: error }));
    return error === '';
  };

  useEffect(() => {
    const emailValue = formData.email;
    if (!emailValue || formErrors.email) {
      setEmailCheck({ loading: false, available: null, msg: '' });
      return;
    }

    const timer = setTimeout(async () => {
      setEmailCheck({ loading: true, available: null, msg: 'Checking availability...' });
      try {
        const isAvailable = await authService.checkEmail(emailValue);
        setEmailCheck({
          loading: false,
          available: isAvailable,
          msg: isAvailable ? 'Email is available' : 'Email is already taken'
        });
        if (!isAvailable) {
           setFormErrors(prev => ({ ...prev, email: 'Email is already taken.' }));
        }
      } catch (err) {
        setEmailCheck({ loading: false, available: null, msg: '' });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
    if (name === 'password' && formData.confirmPassword) {
      validateField('confirmPassword', formData.confirmPassword);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await authService.toggleUserStatus(id);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: !u.isActive } : u))
      );
    } catch (err) {
      console.error('Failed to toggle user status', err);
      toast.error('Failed to toggle user status');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isNameValid = validateField('name', formData.name);
    const isPhoneValid = validateField('phone', formData.phone);
    const isEmailValid = validateField('email', formData.email);
    const isPasswordValid = validateField('password', formData.password);
    const isConfirmValid = validateField('confirmPassword', formData.confirmPassword);

    if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmValid || (formData.phone && !isPhoneValid) || emailCheck.available === false) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await authService.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone || undefined,
      });
      // Optionally handle initial status if API allows setting isActive on creation
      setUsers((prev) => [created, ...prev]);
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', password: '', confirmPassword: '', role: 'CASHIER', status: 'ACTIVE' });
      setFormErrors({});
      setEmailCheck({ loading: false, available: null, msg: '' });
      toast.success('Account created successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create user account.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: AuthUser) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      phone: user.phone || '',
      email: user.email,
      role: user.role as 'CASHIER' | 'INVENTORY_MANAGER',
      isActive: user.isActive !== false,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const isNameValid = validateField('name', editFormData.name);
    const isPhoneValid = validateField('phone', editFormData.phone);
    const isEmailValid = validateField('email', editFormData.email);

    if (!isNameValid || !isEmailValid || (editFormData.phone && !isPhoneValid)) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await authService.updateUser(editingUser.id, editFormData);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setShowEditModal(false);
      toast.success('Account updated successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmResetPassword = async () => {
    if (!passwordResetUser) return;
    try {
      const res = await authService.resetPassword(passwordResetUser.id);
      if (res.emailSent) {
        toast.success(`Password reset successful. A new password has been generated and sent to ${passwordResetUser.email}`, { duration: 5000 });
      } else {
        toast.success(`Password reset successful! (SMTP not configured, so email skipped). New password is: ${res.newPassword}`, { duration: 10000 });
      }
      setPasswordResetUser(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset password.');
    }
  };

  // Filter Logic
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    const isActive = user.isActive !== false; // Assuming undefined means active
    const matchesStatus = statusFilter === 'ALL' || 
                          (statusFilter === 'ACTIVE' && isActive) || 
                          (statusFilter === 'INACTIVE' && !isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Summary Metrics
  const totalEmployees = users.length;
  const activeCashiers = users.filter(u => u.role === 'CASHIER' && u.isActive !== false).length;
  const activeManagers = users.filter(u => u.role === 'INVENTORY_MANAGER' && u.isActive !== false).length;
  const inactiveAccounts = users.filter(u => u.isActive === false).length;

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Account Management</h1>
                <p className="text-sm text-slate-500 mt-1">Manage employee accounts and control access to supermarket operations.</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#0b8252] hover:bg-[#096b43] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                Add Employee
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">group</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Employees</p>
                  <p className="text-2xl font-black text-slate-900">{totalEmployees}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Cashiers</p>
                  <p className="text-2xl font-black text-slate-900">{activeCashiers}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Managers</p>
                  <p className="text-2xl font-black text-slate-900">{activeManagers}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">person_off</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inactive Accounts</p>
                  <p className="text-2xl font-black text-slate-900">{inactiveAccounts}</p>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  type="text"
                  placeholder="Search by name, email or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-shadow"
                />
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0b8252]"
                >
                  <option value="ALL">All Roles</option>
                  <option value="CASHIER">Cashiers</option>
                  <option value="INVENTORY_MANAGER">Inventory Managers</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0b8252]"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {/* Employee Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-4xl mb-3 text-[#0b8252]">progress_activity</span>
                  <p className="font-medium">Loading employee accounts...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                    <span className="material-symbols-outlined text-[32px] text-slate-300">badge</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">No Employee Accounts Found</h3>
                  <p className="text-sm text-slate-500 max-w-sm">Create employee accounts to start managing your supermarket operations. Adjust filters if you are looking for a specific user.</p>
                  {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                    <button 
                      onClick={() => { setSearchQuery(''); setRoleFilter('ALL'); setStatusFilter('ALL'); }}
                      className="mt-4 text-[#0b8252] font-bold text-sm hover:underline"
                    >
                      Clear Filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Added</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold uppercase shrink-0">
                                {user.name.substring(0, 2)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-sm group-hover:text-[#0b8252] transition-colors">{user.name}</p>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.id.substring(0, 8).toUpperCase()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-medium text-slate-700">{user.email}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{user.phone || 'No phone number'}</p>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                              user.role === 'INVENTORY_MANAGER' 
                                ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                : 'bg-teal-50 text-teal-700 border-teal-100'
                            }`}>
                              {user.role === 'INVENTORY_MANAGER' ? 'Manager' : 'Cashier'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              user.isActive !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? 'bg-[#0b8252]' : 'bg-rose-500'}`} />
                              {user.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-500">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                title="Edit Account"
                                onClick={() => openEditModal(user)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button 
                                title={user.isActive !== false ? "Deactivate Account" : "Activate Account"}
                                onClick={() => handleToggleStatus(user.id)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  user.isActive !== false 
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {user.isActive !== false ? 'block' : 'check_circle'}
                                </span>
                              </button>
                              <button 
                                title="Reset Password"
                                onClick={() => setPasswordResetUser(user)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#0b8252] hover:bg-emerald-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">key</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0b8252]/10 text-[#0b8252] flex items-center justify-center">
                  <span className="material-symbols-outlined">person_add</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add New Employee</h2>
                  <p className="text-xs text-slate-500">Create an account and assign roles</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <form id="add-employee-form" onSubmit={handleCreateUser} className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0b8252]"></span>
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 border ${formErrors.name ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                        placeholder="e.g. John Doe"
                      />
                      {formErrors.name && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address <span className="text-rose-500">*</span></label>
                      <input 
                        type="email" 
                        required
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 border ${formErrors.email ? 'border-rose-500' : (emailCheck.available ? 'border-[#0b8252]' : 'border-slate-200')} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                        placeholder="user@example.com"
                      />
                      {formErrors.email ? (
                         <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.email}</p>
                      ) : (
                         emailCheck.msg && (
                           <p className={`text-[10px] mt-1 font-medium flex items-center gap-1 ${emailCheck.available ? 'text-[#0b8252]' : 'text-slate-500'}`}>
                             {emailCheck.loading && <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>}
                             {emailCheck.msg}
                           </p>
                         )
                      )}
                    </div>
                  </div>
                </div>

                {/* Account Details */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0b8252]"></span>
                    Account Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Temporary Password <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className={`w-full pl-4 pr-10 py-2.5 bg-slate-50 border ${formErrors.password ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                          placeholder="Min. 8 chars, 1 Uppercase, 1 Number, 1 Special"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                      {formErrors.password && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.password}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className={`w-full pl-4 pr-10 py-2.5 bg-slate-50 border ${formErrors.confirmPassword ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                          placeholder="Confirm password"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          <span className="material-symbols-outlined text-[20px]">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                      {formErrors.confirmPassword && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.confirmPassword}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input 
                        type="tel" 
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 border ${formErrors.phone ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                        placeholder="0771234567"
                      />
                      {formErrors.phone && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.phone}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Account Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] cursor-pointer"
                      >
                        <option value="ACTIVE">Active (Can Login)</option>
                        <option value="INACTIVE">Inactive (Suspended)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Role & Permissions */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0b8252]"></span>
                      Assigned Role
                    </h3>
                    <button 
                      type="button"
                      onClick={() => setShowPermissions(!showPermissions)}
                      className="text-xs font-bold text-[#0b8252] hover:underline"
                    >
                      {showPermissions ? 'Hide Permissions' : 'View Permissions Guide'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                      formData.role === 'CASHIER' 
                        ? 'border-[#0b8252] bg-[#0b8252]/5' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <input 
                        type="radio" 
                        name="role" 
                        value="CASHIER" 
                        checked={formData.role === 'CASHIER'}
                        onChange={() => setFormData({...formData, role: 'CASHIER'})}
                        className="sr-only" 
                      />
                      <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                          <span className="material-symbols-outlined">point_of_sale</span>
                        </div>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          formData.role === 'CASHIER' ? 'border-[#0b8252] bg-[#0b8252]' : 'border-slate-300'
                        }`}>
                          {formData.role === 'CASHIER' && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">Cashier</h4>
                      <p className="text-xs text-slate-500 mt-1">Point of Sale operations and checkout handling.</p>
                    </label>

                    <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                      formData.role === 'INVENTORY_MANAGER' 
                        ? 'border-[#0b8252] bg-[#0b8252]/5' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <input 
                        type="radio" 
                        name="role" 
                        value="INVENTORY_MANAGER" 
                        checked={formData.role === 'INVENTORY_MANAGER'}
                        onChange={() => setFormData({...formData, role: 'INVENTORY_MANAGER'})}
                        className="sr-only" 
                      />
                      <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          formData.role === 'INVENTORY_MANAGER' ? 'border-[#0b8252] bg-[#0b8252]' : 'border-slate-300'
                        }`}>
                          {formData.role === 'INVENTORY_MANAGER' && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">Inventory Manager</h4>
                      <p className="text-xs text-slate-500 mt-1">Full access to stock, procurement, and reports.</p>
                    </label>
                  </div>

                  {/* Visual Permissions Section */}
                  {showPermissions && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            Cashier Access
                          </h5>
                          <ul className="space-y-1.5 text-sm text-slate-600">
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> POS Billing</li>
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> Orders History</li>
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> Billing Discounts</li>
                            <li className="flex items-center gap-2 text-slate-400"><span className="material-symbols-outlined text-[16px]">cancel</span> Inventory Management</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Manager Access
                          </h5>
                          <ul className="space-y-1.5 text-sm text-slate-600">
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> Products & Categories</li>
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> Suppliers & Procurement</li>
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> Inventory Adjustments</li>
                            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#0b8252]">check_circle</span> Stock Monitoring & Reports</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="add-employee-form"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0b8252] text-white hover:bg-[#096b43] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                {submitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0b8252]/10 text-[#0b8252] flex items-center justify-center">
                  <span className="material-symbols-outlined">edit</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit Employee</h2>
                  <p className="text-xs text-slate-500">Update account details and role</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-employee-form" onSubmit={handleUpdateUser} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0b8252]"></span>
                    Personal & Account Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        name="name"
                        value={editFormData.name}
                        onChange={handleEditChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 border ${formErrors.name ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                      />
                      {formErrors.name && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address <span className="text-rose-500">*</span></label>
                      <input 
                        type="email" 
                        required
                        name="email"
                        value={editFormData.email}
                        onChange={handleEditChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 border ${formErrors.email ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                      />
                      {formErrors.email && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.email}</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0b8252]"></span>
                    Account Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input 
                        type="tel" 
                        name="phone"
                        value={editFormData.phone}
                        onChange={handleEditChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 border ${formErrors.phone ? 'border-rose-500' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252]`}
                      />
                      {formErrors.phone && <p className="text-[10px] text-rose-500 mt-1 font-medium">{formErrors.phone}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Account Status</label>
                      <select 
                        value={editFormData.isActive ? 'ACTIVE' : 'INACTIVE'}
                        onChange={(e) => setEditFormData({...editFormData, isActive: e.target.value === 'ACTIVE'})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] cursor-pointer"
                      >
                        <option value="ACTIVE">Active (Can Login)</option>
                        <option value="INACTIVE">Inactive (Suspended)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0b8252]"></span>
                    Assigned Role
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                      editFormData.role === 'CASHIER' 
                        ? 'border-[#0b8252] bg-[#0b8252]/5' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <input 
                        type="radio" 
                        name="editRole" 
                        value="CASHIER" 
                        checked={editFormData.role === 'CASHIER'}
                        onChange={() => setEditFormData({...editFormData, role: 'CASHIER'})}
                        className="sr-only" 
                      />
                      <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                          <span className="material-symbols-outlined">point_of_sale</span>
                        </div>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          editFormData.role === 'CASHIER' ? 'border-[#0b8252] bg-[#0b8252]' : 'border-slate-300'
                        }`}>
                          {editFormData.role === 'CASHIER' && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">Cashier</h4>
                    </label>

                    <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                      editFormData.role === 'INVENTORY_MANAGER' 
                        ? 'border-[#0b8252] bg-[#0b8252]/5' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <input 
                        type="radio" 
                        name="editRole" 
                        value="INVENTORY_MANAGER" 
                        checked={editFormData.role === 'INVENTORY_MANAGER'}
                        onChange={() => setEditFormData({...editFormData, role: 'INVENTORY_MANAGER'})}
                        className="sr-only" 
                      />
                      <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          editFormData.role === 'INVENTORY_MANAGER' ? 'border-[#0b8252] bg-[#0b8252]' : 'border-slate-300'
                        }`}>
                          {editFormData.role === 'INVENTORY_MANAGER' && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">Inventory Manager</h4>
                    </label>
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="edit-employee-form"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0b8252] text-white hover:bg-[#096b43] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center border border-slate-200 transform transition-all scale-100">
            <div className="mx-auto w-16 h-16 bg-emerald-50 text-[#0b8252] rounded-full flex items-center justify-center mb-4 border border-emerald-100">
              <span className="material-symbols-outlined text-[32px]">lock_reset</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Reset Password?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to reset <strong className="text-slate-700">{passwordResetUser.name}'s</strong> password?{' '}
              A new randomly generated password will be sent to <strong className="text-slate-700">{passwordResetUser.email}</strong>, and the database will be updated with the new password.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setPasswordResetUser(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetPassword}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-[#0b8252] hover:bg-[#096b43] transition-colors shadow-sm"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
