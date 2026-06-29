import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductItem } from './ProductsRegistry';
import { toast } from 'sonner';
import { DiscountService, DiscountPayload } from '../../../../services/discountService';

export interface DiscountItem {
  id: string;
  name: string;
  type: 'SEASONAL' | 'DAILY' | 'COMBO';
  discountValue: number; // percentage (integer) for all types
  label?: string;
  imageUrl?: string;
  startDate?: string;
  endDate?: string;
  dailyStartTime?: string;
  dailyEndTime?: string;
  applicableDate?: string;
  isActive: boolean;
  productIds: string[];
  comboItems?: {
    productId: string;
    minQty: number;
  }[];
  createdAt: string;
  approvalStatus: 'DRAFT' | 'APPROVED';
}

interface DiscountRegistryProps {
  products: ProductItem[];
  showToast: (msg: string, type?: 'success' | 'info') => void;
  showConfirm?: (title: string, message: React.ReactNode, onConfirm: () => void) => void;
}

export default function DiscountRegistry({ products, showToast, showConfirm }: DiscountRegistryProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [discounts, setDiscounts] = useState<DiscountItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountItem | null>(null);
  const [viewingDiscount, setViewingDiscount] = useState<DiscountItem | null>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [type, setType] = useState<'SEASONAL' | 'DAILY' | 'COMBO'>('SEASONAL');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [label, setLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dailyStartTime, setDailyStartTime] = useState('');
  const [dailyEndTime, setDailyEndTime] = useState('');
  const [applicableDate, setApplicableDate] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [comboItems, setComboItems] = useState<{ productId: string; minQty: number }[]>([]);

  // Search/Filter for registry list
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SEASONAL' | 'DAILY' | 'COMBO'>('ALL');

  // Product search filter inside modal
  const [productSearch, setProductSearch] = useState('');

  // Fetch discounts on mount
  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const res = await DiscountService.getDiscounts();
      if (res.success) {
        setDiscounts(res.data);
      } else {
        toast.error('Failed to load discount campaigns.');
      }
    } catch (err) {
      console.error('Failed to fetch discounts:', err);
      toast.error('Server error loading discounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  // Filtered products for seasonal/daily checkboxes
  const filteredSearchProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  // Search products to add to combo list
  const comboSearchProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products.filter(p => 
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())) &&
      !comboItems.some(item => item.productId === p.id)
    ).slice(0, 5); // limit to top 5 results for UI neatness
  }, [products, productSearch, comboItems]);

  // Calculate sum of regular prices of all items in the combo
  const originalComboTotal = useMemo(() => {
    return comboItems.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.productId);
      return sum + (prod ? prod.sellingPrice * item.minQty : 0);
    }, 0);
  }, [comboItems, products]);

  const handleOpenAddModal = (initialProductIds: string[] = [], initialComboItems: { productId: string; minQty: number }[] = []) => {
    setEditingDiscount(null);
    setName('');
    setType('SEASONAL');
    setDiscountValue(10);
    setLabel('');
    setImageUrl('');
    setStartDate('');
    setEndDate('');
    setDailyStartTime('');
    setDailyEndTime('');
    setApplicableDate('');
    setSelectedProductIds(initialProductIds);
    setComboItems(initialComboItems);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (discount: DiscountItem) => {
    setEditingDiscount(discount);
    setName(discount.name);
    setType(discount.type);
    setDiscountValue(discount.discountValue);
    setLabel(discount.label || '');
    setImageUrl(discount.imageUrl || '');
    setStartDate(discount.startDate || '');
    setEndDate(discount.endDate || '');
    setDailyStartTime(discount.dailyStartTime || '');
    setDailyEndTime(discount.dailyEndTime || '');
    setApplicableDate(discount.applicableDate || '');
    setSelectedProductIds(discount.productIds || []);
    setComboItems(discount.comboItems || []);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a discount campaign name.');
      return;
    }

    if (discountValue <= 0) {
      toast.error('Please enter a valid discount percentage greater than 0.');
      return;
    }
    if (discountValue > 100) {
      toast.error('Percentage discount cannot exceed 100%.');
      return;
    }

    if (type !== 'COMBO') {
      if (selectedProductIds.length === 0) {
        toast.error('Please select at least one target product for the campaign.');
        return;
      }
    } else {
      if (comboItems.length === 0) {
        toast.error('Please add at least one product to the combo.');
        return;
      }
    }

    if (type === 'SEASONAL' && (!startDate || !endDate)) {
      toast.error('Please specify both start and end dates.');
      return;
    }

    if (type === 'DAILY' && !applicableDate) {
      toast.error('Please specify the applicable date.');
      return;
    }

    if (type === 'DAILY' && (!dailyStartTime || !dailyEndTime)) {
      toast.error('Please specify start and end times.');
      return;
    }

    const payload: DiscountPayload = {
      name,
      type,
      discountValue,
      label: label || undefined,
      imageUrl: imageUrl || undefined,
      startDate: type === 'SEASONAL' ? startDate : undefined,
      endDate: type === 'SEASONAL' ? endDate : undefined,
      dailyStartTime: type === 'DAILY' ? dailyStartTime : undefined,
      dailyEndTime: type === 'DAILY' ? dailyEndTime : undefined,
      applicableDate: type === 'DAILY' ? applicableDate : undefined,
      productIds: type !== 'COMBO' ? selectedProductIds : undefined,
      comboItems: type === 'COMBO' ? comboItems : undefined
    };

    try {
      if (editingDiscount) {
        const res = await DiscountService.updateDiscount(editingDiscount.id, payload);
        if (res.success) {
          showToast(`Discount "${name}" updated successfully.`);
          fetchDiscounts();
          setIsModalOpen(false);
        } else {
          toast.error(res.message || 'Failed to update discount.');
        }
      } else {
        const res = await DiscountService.createDiscount(payload);
        if (res.success) {
          showToast(`Discount "${name}" created in DRAFT state.`);
          fetchDiscounts();
          setIsModalOpen(false);
        } else {
          toast.error(res.message || 'Failed to create discount.');
        }
      }
    } catch (err: any) {
      console.error('Error saving discount:', err);
      toast.error(err.response?.data?.message || 'Server error saving discount.');
    }
  };

  const handleDelete = (discount: DiscountItem) => {
    if (discount.approvalStatus === 'APPROVED') {
      toast.error(
        `This is an Admin-Approved discount campaign. You must contact the Admin to change it to Draft first before you can delete it.`,
        { duration: 6000 }
      );
      return;
    }

    const action = async () => {
      try {
        const res = await DiscountService.deleteDiscount(discount.id);
        if (res.success) {
          showToast(`Discount "${discount.name}" deleted.`, 'info');
          fetchDiscounts();
        } else {
          toast.error('Failed to delete discount.');
        }
      } catch (err: any) {
        console.error('Error deleting discount:', err);
        toast.error(err.response?.data?.message || 'Server error deleting discount.');
      }
    };

    if (showConfirm) {
      showConfirm(
        'Delete Discount',
        `Are you sure you want to delete the discount "${discount.name}"?`,
        action
      );
    } else {
      if (window.confirm(`Are you sure you want to delete the discount "${name}"?`)) {
        action();
      }
    }
  };

  const toggleDiscountStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await DiscountService.toggleStatus(id, { isActive: !currentStatus });
      if (res.success) {
        showToast(`Discount status changed.`, 'info');
        fetchDiscounts();
      }
    } catch (err) {
      console.error('Error toggling active status:', err);
      toast.error('Failed to update status.');
    }
  };

  const toggleApprovalStatus = async (id: string, currentStatus: 'DRAFT' | 'APPROVED') => {
    const nextStatus = currentStatus === 'APPROVED' ? 'DRAFT' : 'APPROVED';
    try {
      const res = await DiscountService.toggleStatus(id, { approvalStatus: nextStatus });
      if (res.success) {
        showToast(`Discount approval status changed to ${nextStatus}.`, 'info');
        fetchDiscounts();
      }
    } catch (err) {
      console.error('Error toggling approval status:', err);
      toast.error('Failed to update approval status.');
    }
  };

  const handleProductSelectToggle = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleAddComboItem = (productId: string) => {
    if (comboItems.some(item => item.productId === productId)) return;
    setComboItems(prev => [...prev, { productId, minQty: 1 }]);
    setProductSearch(''); // Reset search input
  };

  const handleRemoveComboItem = (productId: string) => {
    setComboItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleUpdateComboItem = (productId: string, val: number) => {
    setComboItems(prev =>
      prev.map(item => (item.productId === productId ? { ...item, minQty: val } : item))
    );
  };

  // Filtered List for Dashboard Display
  const filteredDiscounts = discounts.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (d.label && d.label.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || d.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Handle URL action=add / add-combo and sku + campaign_name trigger
  useEffect(() => {
    const action = searchParams.get('action');
    const sku = searchParams.get('sku');
    const campaignNameParam = searchParams.get('campaign_name');
    if ((action === 'add' || action === 'add-combo') && products.length > 0) {
      // Clear URL params so we don't reopen/repopulate on subsequent renders
      setSearchParams(prev => {
        prev.delete('action');
        prev.delete('sku');
        prev.delete('campaign_name');
        return prev;
      }, { replace: true });

      let initialProductIds: string[] = [];
      let initialComboItems: { productId: string; minQty: number }[] = [];

      if (sku) {
        const product = products.find(p => p.sku.toLowerCase() === sku.toLowerCase() || p.id.toLowerCase() === sku.toLowerCase());
        if (product) {
          if (action === 'add-combo') {
            initialComboItems = [{ productId: product.id, minQty: 1 }];
          } else {
            initialProductIds = [product.sku];
          }
        }
      }

      handleOpenAddModal(initialProductIds, initialComboItems);

      if (action === 'add-combo') {
        setType('COMBO');
      }

      // Pre-fill campaign name if provided from alert
      if (campaignNameParam) {
        setName(campaignNameParam);
      }
    }
  }, [searchParams, products, setSearchParams]);

  return (
    <div className="space-y-6">
      {/* Premium Statistics Overview deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-outline-variant/60 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Total Campaigns</p>
            <h3 className="text-2xl font-black text-on-surface">{discounts.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">local_offer</span>
          </div>
        </div>

        <div className="bg-white border border-outline-variant/60 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Active Approved</p>
            <h3 className="text-2xl font-black text-emerald-700">
              {discounts.filter(d => d.isActive && d.approvalStatus === 'APPROVED').length}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
        </div>

        <div className="bg-white border border-outline-variant/60 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Awaiting Approval</p>
            <h3 className="text-2xl font-black text-amber-600">
              {discounts.filter(d => d.approvalStatus === 'DRAFT').length}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <span className="material-symbols-outlined text-[24px]">pending_actions</span>
          </div>
        </div>
      </div>

      {/* Search and filter header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-container-lowest border border-outline-variant/60 p-4 rounded-2xl shadow-sm">
        <div className="flex flex-1 gap-2.5 items-center">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search discounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary font-bold"
            >
              <option value="ALL">All Types</option>
              <option value="SEASONAL">Seasonal Offers</option>
              <option value="DAILY">Daily Offers</option>
              <option value="COMBO">Combo Offers</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
          </div>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Create Discount Campaign
        </button>
      </div>

      {/* Grid of campaigns */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-sm font-bold text-outline">Loading discount campaigns from database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDiscounts.map(discount => (
            <div
              key={discount.id}
              className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
            >
              <div
                onClick={() => setViewingDiscount(discount)}
                className="cursor-pointer hover:bg-slate-50/20 transition-colors flex-1 flex flex-col"
                title="Click to view details"
              >
                <div className="h-32 w-full relative bg-slate-100">
                  <img
                    src={discount.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop'}
                    alt={discount.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    <span className="bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-black text-primary border border-primary/20">
                      {discount.type}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-sm shadow-sm ${
                      discount.approvalStatus === 'APPROVED'
                        ? 'bg-emerald-500/90 text-white border-emerald-500/30'
                        : 'bg-amber-500/95 text-white border-amber-500/30 font-black'
                    }`}>
                      {discount.approvalStatus}
                    </span>
                  </div>
                  {discount.label && (
                    <div className="absolute bottom-3 left-3 bg-[#0a3822]/85 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      {discount.label}
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-sm text-on-surface line-clamp-1">{discount.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${discount.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-bold text-outline uppercase">{discount.isActive ? 'Active' : 'Paused'}</span>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-outline space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-outline text-[16px]">local_offer</span>
                        <span>
                          Discount Value: <strong className="text-on-surface">{discount.discountValue}% Off</strong>
                        </span>
                      </div>

                      {discount.type === 'SEASONAL' && (
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-outline text-[16px]">calendar_month</span>
                          <span>
                            Validity: <strong className="text-on-surface">{discount.startDate} to {discount.endDate}</strong>
                          </span>
                        </div>
                      )}

                      {discount.type === 'DAILY' && (
                        <>
                          {discount.applicableDate && (
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-outline text-[16px]">calendar_month</span>
                              <span>
                                Date: <strong className="text-on-surface">{discount.applicableDate}</strong>
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-outline text-[16px]">schedule</span>
                            <span>
                              Daily Hours: <strong className="text-on-surface">{discount.dailyStartTime} - {discount.dailyEndTime}</strong>
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-outline text-[16px]">shopping_basket</span>
                          <span>
                            Applied to:{' '}
                            <strong className="text-on-surface">
                              {discount.type === 'COMBO'
                                ? `${discount.comboItems?.length || 0} Combo Items`
                                : `${discount.productIds?.length || 0} Products`}
                            </strong>
                          </span>
                        </div>
                        {discount.type === 'COMBO' && discount.comboItems && discount.comboItems.length > 0 && (
                          <div className="mt-1 pl-5 space-y-0.5 border-l border-primary/30 max-h-24 overflow-y-auto">
                            {discount.comboItems.map((item, idx) => {
                              const prod = products.find(p => p.id === item.productId || p.sku === item.productId);
                              return (
                                <div key={idx} className="text-[10px] text-outline-variant font-medium">
                                  • {prod ? prod.name : 'Unknown Product'} (x{item.minQty})
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {discount.type !== 'COMBO' && discount.productIds && discount.productIds.length > 0 && (
                          <div className="mt-1 pl-5 space-y-0.5 border-l border-primary/30 max-h-20 overflow-y-auto">
                            {discount.productIds.slice(0, 3).map((pId, idx) => {
                              const prod = products.find(p => p.id === pId || p.sku === pId);
                              return (
                                <div key={idx} className="text-[10px] text-outline-variant font-medium truncate">
                                  • {prod ? prod.name : pId}
                                </div>
                              );
                            })}
                            {discount.productIds.length > 3 && (
                              <div className="text-[9px] text-outline font-bold pl-2">
                                + {discount.productIds.length - 3} more products
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-outline-variant/60 flex items-center justify-between bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleDiscountStatus(discount.id, discount.isActive)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                      discount.isActive
                        ? 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                        : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {discount.isActive ? 'Pause' : 'Activate'}
                  </button>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(discount)}
                    className="p-1 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(discount)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredDiscounts.length === 0 && (
            <div className="col-span-full py-12 text-center bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm">
              <span className="material-symbols-outlined text-[48px] text-outline/30">local_offer</span>
              <p className="text-sm font-bold text-outline mt-2">No discount campaigns found.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">local_offer</span>
                <h2 className="text-base font-bold text-on-surface">
                  {editingDiscount ? 'Modify Discount Campaign' : 'Create New Discount Campaign'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramadan Super Clearance"
                    className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                    Discount Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as any;
                      setType(nextType);
                      setProductSearch('');
                      if (discountValue === 0) {
                        setDiscountValue(10);
                      }
                    }}
                    className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary font-bold"
                  >
                    <option value="SEASONAL">Seasonal Offer (Fixed Date Range)</option>
                    <option value="DAILY">Daily Offer (Recurring Hours)</option>
                    <option value="COMBO">Combo Offer (Bundle Deal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                    Discount Value (%) *
                  </label>
                  <input
                    type="number"
                    value={discountValue === 0 ? '' : discountValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDiscountValue(0);
                        return;
                      }
                      let num = parseInt(val);
                      if (isNaN(num)) num = 0;
                      if (num < 0) num = 0;
                      if (num > 100) num = 100;
                      setDiscountValue(num);
                    }}
                    min="0"
                    max="100"
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {type === 'COMBO' && (
                  <div className="bg-slate-50 border border-outline-variant/60 rounded-xl p-3 flex flex-col justify-center text-xs">
                    <div className="flex justify-between font-semibold text-outline text-[10px] uppercase">
                      <span>Original Total:</span>
                      <span>Rs. {originalComboTotal.toFixed(2)}</span>
                    </div>
                    {discountValue > 0 && originalComboTotal > 0 && (
                      <>
                        <div className="flex justify-between font-bold text-emerald-700 mt-1">
                          <span>Combo Bundle Price:</span>
                          <span>Rs. {(originalComboTotal * (1 - discountValue / 100)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-outline font-semibold mt-0.5">
                          <span>Bundle Savings:</span>
                          <span>Rs. {(originalComboTotal * (discountValue / 100)).toFixed(2)} ({discountValue}%)</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Clearance ⚡"
                    className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                    Campaign Promo Image
                  </label>
                  <div className="flex items-center gap-4 p-4 bg-background border border-outline-variant rounded-xl">
                    {imageUrl ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-outline-variant shrink-0 bg-slate-50">
                        <img src={imageUrl} alt="Promo Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                          title="Remove image"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-outline-variant shrink-0 bg-slate-50">
                        <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
                        <span className="text-[9px] font-semibold mt-1">No Image</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-[10px] text-outline font-semibold mb-2">
                        Select a local image file. It will be converted and saved in the database.
                      </p>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg cursor-pointer hover:opacity-90 transition-all shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                        Choose Image File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            // Convert to Base64
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setImageUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {type === 'SEASONAL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-outline-variant/60 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {type === 'DAILY' && (
                <div className="grid grid-cols-1 gap-4 border-t border-outline-variant/60 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                      Applicable Date *
                    </label>
                    <input
                      type="date"
                      value={applicableDate}
                      onChange={(e) => setApplicableDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {type === 'DAILY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-outline-variant/60 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                      Daily Start Time *
                    </label>
                    <input
                      type="time"
                      value={dailyStartTime}
                      onChange={(e) => setDailyStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
                      Daily End Time *
                    </label>
                    <input
                      type="time"
                      value={dailyEndTime}
                      onChange={(e) => setDailyEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Products selection section */}
              {type !== 'COMBO' ? (
                <div className="border-t border-outline-variant/60 pt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="block text-[10px] font-black text-outline uppercase tracking-wider">
                      Select Target Products for this Campaign
                    </label>
                    <input
                      type="text"
                      placeholder="Search products by SKU or Name..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="px-3 py-1.5 max-w-xs bg-white border border-outline-variant rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-outline-variant/60 rounded-xl p-3 bg-slate-50/50">
                    {filteredSearchProducts.map(prod => {
                      const isSelected = selectedProductIds.includes(prod.id) || selectedProductIds.includes(prod.sku);
                      const finalPrice = prod.sellingPrice * (1 - discountValue / 100);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleProductSelectToggle(prod.sku)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-outline-variant/60 hover:border-outline bg-white'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[18px] ${
                            isSelected ? 'text-primary font-bold' : 'text-outline-variant'
                          }`}>
                            {isSelected ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-on-surface leading-tight line-clamp-1">{prod.name}</p>
                            <p className="text-[9px] text-outline font-semibold mt-0.5">
                              SKU: {prod.sku} | Price:{' '}
                              <span className={discountValue > 0 ? 'line-through text-red-500' : ''}>
                                Rs. {prod.sellingPrice}
                              </span>
                              {discountValue > 0 && (
                                <strong className="text-emerald-700 ml-1">
                                  ➔ Rs. {finalPrice.toFixed(2)}
                                </strong>
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {filteredSearchProducts.length === 0 && (
                      <p className="col-span-full text-center py-4 text-xs font-bold text-outline">No products match search.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Combo setup section */
                <div className="border-t border-outline-variant/60 pt-4 space-y-3">
                  <div className="flex flex-col gap-2">
                    <label className="block text-[10px] font-black text-outline uppercase tracking-wider">
                      Add Combo Items
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search product by SKU or Name to add..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      />
                      {comboSearchProducts.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-outline-variant/60 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {comboSearchProducts.map(prod => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleAddComboItem(prod.id)}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-on-surface">{prod.name}</span>
                                <span className="block text-[10px] text-outline font-semibold">SKU: {prod.sku} | Price: Rs. {prod.sellingPrice}</span>
                              </div>
                              <span className="text-xs font-black text-primary hover:underline">+ Add to Combo</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                    {comboItems.map((item) => {
                      const prod = products.find(p => p.id === item.productId || p.sku === item.productId);
                      if (!prod) return null;
                      return (
                        <div
                          key={item.productId}
                          className="flex items-center justify-between gap-4 p-3 bg-white border border-outline-variant/60 rounded-xl"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{prod.name}</p>
                            <p className="text-[10px] text-outline font-semibold">
                              SKU: {prod.sku} | Price: Rs. {prod.sellingPrice}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-outline uppercase mb-0.5">Min Qty</span>
                              <input
                                type="number"
                                min="1"
                                value={item.minQty}
                                onChange={(e) => handleUpdateComboItem(item.productId, parseInt(e.target.value) || 1)}
                                className="w-14 px-2 py-1 border border-outline-variant rounded text-xs text-center font-bold"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveComboItem(item.productId)}
                              className="text-red-500 hover:text-red-700 p-1 mt-3"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {comboItems.length === 0 && (
                      <div className="text-center py-6 border border-dashed border-outline-variant rounded-xl text-outline text-[11px] font-bold bg-slate-50/50">
                        Type product name above to add items to this combo.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm"
              >
                {editingDiscount ? 'Save Changes' : 'Create Campaign (Draft)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Details Modal */}
      {viewingDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">local_offer</span>
                <h2 className="text-base font-bold text-on-surface">Discount Campaign Details</h2>
              </div>
              <button
                onClick={() => setViewingDiscount(null)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/30">
              <div className="flex items-start gap-4 p-4 bg-white border border-outline-variant/60 rounded-xl shadow-sm">
                {viewingDiscount.imageUrl ? (
                  <img
                    src={viewingDiscount.imageUrl}
                    alt={viewingDiscount.name}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center bg-primary text-white font-black text-2xl uppercase shrink-0 shadow-sm">
                    {viewingDiscount.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                      {viewingDiscount.type}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      viewingDiscount.approvalStatus === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {viewingDiscount.approvalStatus}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      viewingDiscount.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {viewingDiscount.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-on-surface leading-snug line-clamp-2">{viewingDiscount.name}</h4>
                  {viewingDiscount.label && (
                    <p className="text-xs text-[#0a3822] font-semibold mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">sell</span>
                      {viewingDiscount.label}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 border border-outline-variant/60 rounded-xl shadow-sm space-y-2">
                  <span className="block text-[10px] font-black text-outline uppercase tracking-wider">Discount Value</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-primary">
                      {`${viewingDiscount.discountValue}%`}
                    </span>
                    <span className="text-xs font-bold text-outline">
                      {viewingDiscount.type === 'COMBO' ? 'Off Combo Bundle' : 'Off Original Price'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 border border-outline-variant/60 rounded-xl shadow-sm space-y-2">
                  <span className="block text-[10px] font-black text-outline uppercase tracking-wider">Campaign Schedule</span>
                  <div className="text-xs font-bold text-on-surface">
                    {viewingDiscount.type === 'SEASONAL' && (
                      <div className="flex items-center gap-1.5 mt-1 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px] text-outline">calendar_month</span>
                        <span>Validity: {viewingDiscount.startDate} to {viewingDiscount.endDate}</span>
                      </div>
                    )}
                    {viewingDiscount.type === 'DAILY' && (
                      <div className="flex flex-col gap-1 mt-1 text-on-surface-variant">
                        {viewingDiscount.applicableDate && (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-outline">calendar_month</span>
                            <span>Date: {viewingDiscount.applicableDate}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-outline">schedule</span>
                          <span>Daily Hours: {viewingDiscount.dailyStartTime} - {viewingDiscount.dailyEndTime}</span>
                        </div>
                      </div>
                    )}
                    {viewingDiscount.type === 'COMBO' && (
                      <div className="flex items-center gap-1.5 mt-1 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px] text-outline">verified</span>
                        <span>Continuous Bundle Deal</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Applied Products Section */}
              <div className="bg-white border border-outline-variant/60 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-outline uppercase tracking-wider">
                    {viewingDiscount.type === 'COMBO' ? 'Combo Products & Quantities' : 'Applied Target Products'}
                  </h3>
                  <span className="text-[10px] font-bold text-outline-variant">
                    {viewingDiscount.type === 'COMBO'
                      ? `${viewingDiscount.comboItems?.length || 0} Bundle Items`
                      : `${viewingDiscount.productIds?.length || 0} Target Products`}
                  </span>
                </div>

                {viewingDiscount.type === 'COMBO' ? (
                  <div className="divide-y divide-slate-100">
                    {viewingDiscount.comboItems && viewingDiscount.comboItems.length > 0 ? (
                      viewingDiscount.comboItems.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId || p.sku === item.productId);
                        return (
                          <div key={idx} className="py-2.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-on-surface truncate">{prod ? prod.name : 'Unknown Product'}</span>
                              <span className="block text-[10px] text-outline mt-0.5 font-semibold">
                                SKU: {prod ? prod.sku : 'N/A'} • Original Price: Rs. {prod ? prod.sellingPrice : 0}
                              </span>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="block text-xs font-black text-primary">Qty Required: {item.minQty}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-outline py-2">No combo products added.</p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {viewingDiscount.productIds && viewingDiscount.productIds.length > 0 ? (
                      viewingDiscount.productIds.map((pId, idx) => {
                        const prod = products.find(p => p.id === pId || p.sku === pId);
                        if (!prod) return null;
                        const finalPrice = prod.sellingPrice * (1 - viewingDiscount.discountValue / 100);
                        return (
                          <div key={idx} className="py-2.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-on-surface truncate">{prod.name}</span>
                              <span className="block text-[10px] text-outline mt-0.5 font-semibold">
                                SKU: {prod.sku} • Stock: <strong className={prod.stock === 0 ? 'text-red-600' : 'text-on-surface'}>{prod.stock}</strong>
                              </span>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="block text-xs font-black text-primary">Rs. {finalPrice.toFixed(2)}</span>
                              <span className="block text-[9px] text-outline line-through mt-0.5 font-bold">Rs. {prod.sellingPrice}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-outline py-2">No target products selected.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-outline-variant/60 shrink-0">
              <button
                type="button"
                onClick={() => setViewingDiscount(null)}
                className="px-4 py-2 bg-white border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-colors shadow-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewingDiscount;
                  setViewingDiscount(null);
                  handleOpenEditModal(target);
                }}
                className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
