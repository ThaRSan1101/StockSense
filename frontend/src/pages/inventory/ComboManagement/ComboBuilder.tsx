import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { comboService } from '../../../services/comboService';
import { api } from '../../../services/axiosInstance';
import { useAuth } from '../../../hooks/useAuth';
import Sidebar from '../Shared/Sidebar';
import InventoryHeader from '../Shared/InventoryHeader';

export default function ComboBuilder() {
  const [searchParams] = useSearchParams();
  const comboId = searchParams.get('id');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]); // All active products
  const [opportunitiesMap, setOpportunitiesMap] = useState<Record<string, string[]>>({}); // sku -> array of opportunityTypes

  // Form State
  const [name, setName] = useState('');
  const [comboCode, setComboCode] = useState('');
  const [description, setDescription] = useState('');
  const [comboType, setComboType] = useState('SLOW_MOVING');
  const [comboPrice, setComboPrice] = useState<number>(0);
  const [maximumQuantity, setMaximumQuantity] = useState<number>(80);
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [comboStatus, setComboStatus] = useState('DRAFT');
  const [requestChangeMessage, setRequestChangeMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Product Search & Category Filter State
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showSearchList, setShowSearchList] = useState(false);
  const [selectedOppFilter, setSelectedOppFilter] = useState<string>('ALL');

  // StockSense Theme Custom Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'CONFIRM' | 'CHECKLIST';
    title: string;
    message: string;
    listItems?: string[];
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'SUCCESS',
    title: '',
    message: ''
  });

  const [activeCombos, setActiveCombos] = useState<any[]>([]);

  // Helper to generate a unique random combo code
  const generateRandomCode = () => {
    return `COMBO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  // Fetch active products and opportunities
  const fetchProductsAndOpportunities = async () => {
    try {
      const [prodRes, oppRes, combosRes] = await Promise.all([
        api.get('/products?status=ACTIVE'),
        comboService.getOpportunities(),
        comboService.getCombos()
      ]);

      if (prodRes.data.success) {
        setProducts(prodRes.data.data);
      }

      if (oppRes && oppRes.success && Array.isArray(oppRes.data)) {
        const oppMap: Record<string, string[]> = {};
        oppRes.data.forEach((opp: any) => {
          if (!oppMap[opp.targetProductId]) {
            oppMap[opp.targetProductId] = [];
          }
          if (!oppMap[opp.targetProductId].includes(opp.opportunityType)) {
            oppMap[opp.targetProductId].push(opp.opportunityType);
          }
        });
        setOpportunitiesMap(oppMap);
      }

      if (combosRes && combosRes.success && Array.isArray(combosRes.data)) {
        setActiveCombos(combosRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load existing combo if id is passed
  const loadCombo = async () => {
    if (!comboId) {
      // Clean reset for new custom combo creation
      setName('');
      setComboCode(generateRandomCode());
      setDescription('');
      setComboType('SLOW_MOVING');
      setComboPrice(0);
      setMaximumQuantity(80);
      setStartDate('');
      setEndDate('');
      setItems([]);
      setComboStatus('DRAFT');
      setRequestChangeMessage('');
      setRejectionReason('');
      setProductSearchQuery('');
      setSelectedOppFilter('ALL');
      return;
    }
    try {
      setLoading(true);
      const payload = await comboService.getComboDetails(comboId);
      if (payload.success) {
        const combo = payload.data;
        setName(combo.name);
        setComboCode(combo.comboCode);
        setDescription(combo.description || '');
        setComboType(combo.comboType);
        setComboPrice(combo.comboPrice);
        setMaximumQuantity(combo.maximumQuantity || 80);
        setStartDate(combo.startDate ? combo.startDate.split('T')[0] : '');
        setEndDate(combo.endDate ? combo.endDate.split('T')[0] : '');
        setComboStatus(combo.status);
        setRequestChangeMessage(combo.requestChangeMessage || '');
        setRejectionReason(combo.rejectionReason || '');
        
        // Map items
        const mappedItems = combo.items.map((i: any) => ({
          productId: i.productId,
          name: i.product?.name || i.productId,
          role: i.role,
          quantity: i.quantity,
          normalUnitPrice: i.normalUnitPrice,
          costPrice: i.costPrice,
          batchId: i.batchId
        }));
        setItems(mappedItems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndOpportunities();
    loadCombo();
  }, [comboId]);

  // Live Recalculations
  const normalTotalPrice = items.reduce((sum, item) => sum + (item.normalUnitPrice * item.quantity), 0);
  const totalCost = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const breakEvenCost = totalCost;
  const expectedProfit = comboPrice - totalCost;
  const expectedMargin = comboPrice > 0 ? (expectedProfit / comboPrice) * 100 : 0;

  // Handle Add Item
  const handleAddItem = (productId: string) => {
    if (items.some(i => i.productId === productId)) return;
    const prod = products.find(p => p.sku === productId);
    if (!prod) return;

    const newItems = [...items, {
      productId: prod.sku,
      name: prod.name,
      role: items.length === 0 ? 'TARGET' : 'ANCHOR',
      quantity: 1,
      normalUnitPrice: prod.sellingPrice,
      costPrice: prod.costPrice,
      batchId: null
    }];

    setItems(newItems);

    // Auto-calculate suggested combo price (gives 10% discount while guaranteeing > cost)
    const newNormal = newItems.reduce((sum, item) => sum + (item.normalUnitPrice * item.quantity), 0);
    const newCost = newItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const discountedPrice = Math.round(newNormal * 0.90);
    const suggestedPrice = Math.max(Math.ceil(newCost * 1.02), discountedPrice);

    if (suggestedPrice > 0) {
      setComboPrice(suggestedPrice);
    }
  };

  // Apply quick discount preset
  const applyPresetDiscount = (percent: number) => {
    if (normalTotalPrice <= 0) return;
    const price = Math.round(normalTotalPrice * (1 - percent / 100));
    setComboPrice(price);
  };

  const applyCostFloorPreset = () => {
    if (totalCost <= 0) return;
    setComboPrice(Math.ceil(totalCost * 1.02)); // 2% safe floor above cost
  };

  // Helper for quick campaign duration presets
  const setDurationPreset = (days: number) => {
    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    if (!startDate) {
      setStartDate(start.toISOString().split('T')[0]);
    }
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Handle Change Item Field
  const handleItemFieldChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  // Client-Side Revalidation
  const runLiveValidation = () => {
    const errors: string[] = [];
    if (!name) errors.push('Combo name is required.');
    if (!comboCode) errors.push('Combo code identifier is required.');
    if (items.length < 2) errors.push('A combo must contain at least 2 products (1 Target and 1 Anchor).');
    
    if (items.length > 0) {
      const targets = items.filter(i => i.role === 'TARGET');
      const anchors = items.filter(i => i.role === 'ANCHOR');
      if (targets.length === 0) errors.push('A combo must designate at least one TARGET product.');
      if (anchors.length === 0) errors.push('A combo must designate at least one ANCHOR product.');
    }

    if (items.length >= 2) {
      if (comboPrice <= 0) errors.push('Combo price must be set.');
      if (comboPrice >= normalTotalPrice && normalTotalPrice > 0) errors.push('Combo price must be less than the normal total price.');
      if (comboPrice <= totalCost && totalCost > 0) errors.push('Critical: Combo price is below aggregate cost price. Negative profit detected.');
    }

    if (startDate && startDate < todayStr) {
      errors.push('Start date cannot be in the past.');
    }
    if (endDate && startDate && endDate < startDate) {
      errors.push('End date must be on or after the start date.');
    }

    setValidationErrors(errors);
    setValidationSuccess(errors.length === 0 && items.length >= 2 && comboPrice > 0);
  };

  useEffect(() => {
    runLiveValidation();
  }, [name, comboCode, comboPrice, items, startDate, endDate]);

  const handleSave = async (submit = false) => {
    if (submit && validationErrors.length > 0) {
      setModalConfig({
        isOpen: true,
        type: 'CHECKLIST',
        title: 'Approval Submission Checklist',
        message: 'Please complete the following required items before submitting for approval:',
        listItems: validationErrors,
        confirmText: 'Understand'
      });
      return;
    }

    if (!submit && validationErrors.length > 0) {
      setModalConfig({
        isOpen: true,
        type: 'CONFIRM',
        title: 'Save Incomplete Draft?',
        message: 'Your combo setup has pending validation items. Would you like to save it as a draft anyway?',
        confirmText: 'Save Draft Anyway',
        cancelText: 'Continue Editing',
        onConfirm: () => executeSave(submit)
      });
      return;
    }

    executeSave(submit);
  };

  const executeSave = async (submit: boolean) => {
    try {
      setSaving(true);
      const payload = {
        name,
        comboCode,
        description,
        comboType,
        comboPrice,
        maximumQuantity,
        startDate,
        endDate,
        items
      };

      let activeComboId = comboId;
      if (comboId) {
        const res = await comboService.updateComboDraft(comboId, payload);
        if (!res.success) {
          setModalConfig({
            isOpen: true,
            type: 'ERROR',
            title: 'Save Error',
            message: res.message || 'Error occurred while saving.',
            listItems: res.errors
          });
          return;
        }
      } else {
        const res = await comboService.createComboDraft(payload);
        if (res.success) {
          activeComboId = res.data.id;
        } else {
          setModalConfig({
            isOpen: true,
            type: 'ERROR',
            title: 'Save Error',
            message: res.message || 'Error occurred while saving.',
            listItems: res.errors
          });
          return;
        }
      }

      if (submit && activeComboId) {
        const subRes = await comboService.submitComboForApproval(activeComboId);
        if (subRes.success) {
          setModalConfig({
            isOpen: true,
            type: 'SUCCESS',
            title: 'Submitted for Approval!',
            message: 'Combo campaign saved and submitted for manager approval successfully.',
            confirmText: 'Back to Dashboard',
            onConfirm: () => navigate('/inventory-combo')
          });
          return;
        } else {
          setModalConfig({
            isOpen: true,
            type: 'ERROR',
            title: 'Submission Error',
            message: subRes.message || 'Failed to submit combo for approval.'
          });
          return;
        }
      }

      setModalConfig({
        isOpen: true,
        type: 'SUCCESS',
        title: 'Draft Saved Successfully!',
        message: 'Combo campaign draft saved to your database.',
        confirmText: 'Back to Dashboard',
        onConfirm: () => navigate('/inventory-combo')
      });
    } catch (error: any) {
      console.error('Error saving combo:', error);
      const serverMsg = error.response?.data?.message || 'Network or server error while saving combo.';
      setModalConfig({
        isOpen: true,
        type: 'ERROR',
        title: 'Server Error',
        message: serverMsg,
        listItems: error.response?.data?.errors
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApproveCombo = async () => {
    if (!comboId) return;
    try {
      setSaving(true);
      const res = await comboService.approveCombo(comboId);
      if (res.success) {
        setModalConfig({
          isOpen: true,
          type: 'SUCCESS',
          title: 'Combo Approved & Converted!',
          message: 'The combo campaign has been approved by Admin and its target opportunities are now marked as CONVERTED.',
          confirmText: 'Back to Dashboard',
          onConfirm: () => navigate('/inventory-combo')
        });
      } else {
        setModalConfig({
          isOpen: true,
          type: 'ERROR',
          title: 'Approval Error',
          message: res.message || 'Failed to approve combo.'
        });
      }
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'ERROR',
        title: 'Approval Error',
        message: err.response?.data?.message || 'Error occurred during approval.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRejectCombo = async () => {
    if (!comboId) return;
    setModalConfig({
      isOpen: true,
      type: 'CONFIRM',
      title: 'Confirm Campaign Rejection',
      message: 'Are you sure you want to reject this combo campaign proposal?',
      confirmText: 'Reject Campaign',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setSaving(true);
          const res = await comboService.rejectCombo(comboId, 'Rejected during Admin review.');
          if (res.success) {
            setModalConfig({
              isOpen: true,
              type: 'SUCCESS',
              title: 'Combo Rejected',
              message: 'The combo campaign proposal has been rejected.',
              confirmText: 'Back to Dashboard',
              onConfirm: () => navigate('/inventory-combo')
            });
          } else {
            setModalConfig({
              isOpen: true,
              type: 'ERROR',
              title: 'Rejection Error',
              message: res.message || 'Failed to reject combo.'
            });
          }
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            type: 'ERROR',
            title: 'Rejection Error',
            message: err.response?.data?.message || 'Error occurred during rejection.'
          });
        } finally {
          setSaving(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <InventoryHeader />
          <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
            <div className="text-center py-20 text-gray-400">Loading campaign details...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <InventoryHeader />

        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <button 
            onClick={() => navigate('/inventory-combo')}
            className="flex items-center gap-1 text-gray-400 hover:text-[#103e2c] font-bold text-xs cursor-pointer mb-2"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
          </button>
          <h1 className="text-3xl font-extrabold text-gray-900">{comboId ? 'Edit Combo Campaign' : 'Create Custom Combo'}</h1>
        </div>
        
        <div className="flex gap-2 items-center">
          {comboStatus === 'PENDING_APPROVAL' ? (
            isAdmin ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRejectCombo}
                  disabled={saving}
                  className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs disabled:opacity-50"
                >
                  Reject Campaign
                </button>
                <button
                  type="button"
                  onClick={handleApproveCombo}
                  disabled={saving}
                  className="bg-[#103e2c] text-white hover:bg-[#165a40] font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Approve & Convert Opportunity
                </button>
              </div>
            ) : (
              <span className="bg-blue-50 text-blue-800 font-extrabold border border-blue-100 text-xs px-4 py-2 rounded-xl">
                Combo Status: PENDING_APPROVAL (Awaiting Admin Review)
              </span>
            )
          ) : comboStatus === 'DRAFT' || comboStatus === 'CHANGES_REQUESTED' || comboStatus === 'REJECTED' ? (
            <>
              {comboId && (
                <button
                  type="button"
                  onClick={() => {
                    setModalConfig({
                      isOpen: true,
                      title: 'Delete Combo Campaign',
                      message: 'Are you sure you want to permanently delete this combo draft campaign? This action cannot be undone.',
                      type: 'CONFIRM',
                      confirmText: 'Delete Campaign',
                      cancelText: 'Cancel',
                      onConfirm: async () => {
                        try {
                          const res = await comboService.deleteCombo(comboId);
                          if (res.success) {
                            toast.success('Combo draft deleted successfully.');
                            navigate('/inventory-combo');
                          } else {
                            toast.error(res.message || 'Failed to delete combo.');
                          }
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Error deleting combo.');
                        }
                      }
                    });
                  }}
                  className="bg-white border border-red-200 text-red-700 font-bold px-4 py-2.5 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer text-sm shadow-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete Draft
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="bg-white border border-gray-200 text-gray-700 font-bold px-6 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer text-sm shadow-xs disabled:opacity-50"
              >
                {saving ? 'Saving Draft...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-[#103e2c] text-white hover:bg-[#165a40] font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {saving ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </>
          ) : (
            <span className={`font-extrabold border text-xs px-4 py-2 rounded-xl ${
              comboStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              comboStatus === 'APPROVED' ? 'bg-teal-50 text-teal-800 border-teal-200' :
              'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              Combo Status: {comboStatus}
            </span>
          )}
        </div>
      </div>

      {/* Admin Feedback Banners for Manager */}
      {comboStatus === 'CHANGES_REQUESTED' && requestChangeMessage && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 space-y-2 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
            <span className="material-symbols-outlined text-[22px] text-amber-700">edit_note</span>
            Admin Revision Request Instructions
          </div>
          <div className="text-xs text-amber-900 font-mono leading-relaxed bg-white/80 p-3.5 rounded-xl border border-amber-200/60 shadow-inner">
            "{requestChangeMessage}"
          </div>
          <p className="text-[11px] text-amber-700 font-medium italic">
            Please make the requested adjustments below and click "Submit for Approval" again.
          </p>
        </div>
      )}

      {comboStatus === 'REJECTED' && rejectionReason && (
        <div className="bg-red-50 border border-red-200/80 rounded-2xl p-5 space-y-2 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 text-red-900 font-extrabold text-sm">
            <span className="material-symbols-outlined text-[22px] text-red-700">cancel</span>
            Admin Rejection Reason
          </div>
          <div className="text-xs text-red-900 font-mono leading-relaxed bg-white/80 p-3.5 rounded-xl border border-red-200/60 shadow-inner">
            "{rejectionReason}"
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Builder Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Attributes */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b border-gray-50 pb-2">Campaign Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-bold uppercase">Combo Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Bread & Butter Breakfast Pack"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white focus:border-emerald-700 transition-all"
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase">Combo Code (Unique)</label>
                  {!comboId && (
                    <button
                      type="button"
                      onClick={() => setComboCode(generateRandomCode())}
                      className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span> Auto Gen
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  value={comboCode} 
                  onChange={(e) => setComboCode(e.target.value)} 
                  placeholder="e.g. BREAKFASTCOMBO"
                  disabled={!!comboId}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-mono outline-none focus:bg-white focus:border-emerald-700 transition-all disabled:bg-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-bold uppercase">Combo Goal / Type</label>
                <select 
                  value={comboType} 
                  onChange={(e) => setComboType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white focus:border-emerald-700 transition-all cursor-pointer font-medium"
                >
                  <option value="SLOW_MOVING">Slow-Moving Stock Support</option>
                  <option value="DEAD_STOCK">Dead-Stock Clearance Campaign</option>
                  <option value="NEAR_EXPIRY">Near-Expiry Emergency Sell-off</option>
                  <option value="OVERSTOCK">Overstock Bulk Reduction</option>
                  <option value="SEASONAL">Seasonal Promotional Deal</option>
                  <option value="REGULAR_COMPLEMENTARY">Standard Cross-Sell Bundle</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase">Campaign Duration</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDurationPreset(7)}
                      className="text-[9px] font-extrabold bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      7D
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationPreset(14)}
                      className="text-[9px] font-extrabold bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      14D (Rec.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationPreset(30)}
                      className="text-[9px] font-extrabold bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      30D
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="date" 
                    value={startDate} 
                    min={todayStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (endDate && val && endDate < val) {
                        setEndDate(val);
                      }
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-700 transition-all cursor-pointer font-medium"
                    placeholder="Start Date"
                  />
                  <input 
                    type="date" 
                    value={endDate} 
                    min={startDate || todayStr}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-700 transition-all cursor-pointer font-medium"
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Campaign Description</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details of promotional campaign..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white focus:border-emerald-700 transition-all"
              />
            </div>
          </div>

          {/* Combo Items */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Combo Products</h3>
                <p className="text-xs text-gray-400">Designate at least 1 Target (slow item) and 1 Anchor (popular item).</p>
              </div>
              
              {/* Product Search Input (Barcode / SKU / Name / Category Filter) */}
              <div className="relative min-w-[340px]">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-700 focus-within:bg-white transition-all shadow-sm">
                  <span className="material-symbols-outlined text-[18px] text-gray-400 mr-2">barcode_scanner</span>
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowSearchList(true);
                    }}
                    onFocus={() => setShowSearchList(true)}
                    placeholder="Search Barcode, SKU, or Name..."
                    className="w-full bg-transparent text-xs font-semibold outline-none text-gray-800 placeholder:text-gray-400"
                  />
                  {productSearchQuery && (
                    <button 
                      type="button" 
                      onClick={() => { setProductSearchQuery(''); setShowSearchList(false); }}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>

                {showSearchList && (
                  <div 
                    onMouseLeave={() => setShowSearchList(false)}
                    className="absolute right-0 top-full mt-1.5 w-[420px] max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl z-50 divide-y divide-gray-50"
                  >
                    {/* Category Filter Tabs Header */}
                    <div className="p-2 bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10 flex gap-1 overflow-x-auto border-b border-gray-100">
                      {[
                        { id: 'ALL', label: 'All Items' },
                        { id: 'SLOW_MOVING', label: 'Slow-Moving' },
                        { id: 'NEAR_EXPIRY', label: 'Near-Expiry' },
                        { id: 'OVERSTOCK', label: 'Overstock' },
                        { id: 'DEAD_STOCK', label: 'Dead-Stock' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedOppFilter(cat.id)}
                          className={`text-[10px] font-extrabold px-2 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                            selectedOppFilter === cat.id
                              ? 'bg-[#103e2c] text-white shadow-xs'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Filtered Products List */}
                    {(() => {
                      const filteredList = products.filter(p => {
                        const oppTypes = opportunitiesMap[p.sku] || [];
                        
                        if (selectedOppFilter === 'SLOW_MOVING' && !oppTypes.includes('SLOW_MOVING')) return false;
                        if (selectedOppFilter === 'NEAR_EXPIRY' && !oppTypes.includes('NEAR_EXPIRY')) return false;
                        if (selectedOppFilter === 'OVERSTOCK' && !oppTypes.includes('OVERSTOCK')) return false;
                        if (selectedOppFilter === 'DEAD_STOCK' && !oppTypes.includes('DEAD_STOCK')) return false;

                        if (productSearchQuery) {
                          const q = productSearchQuery.toLowerCase();
                          const matchName = p.name?.toLowerCase().includes(q);
                          const matchSku = p.sku?.toLowerCase().includes(q);
                          const matchBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
                          return matchName || matchSku || matchBarcode;
                        }

                        return true;
                      });

                      if (filteredList.length === 0) {
                        return (
                          <div className="p-6 text-xs text-gray-400 text-center font-medium">
                            No matching products found in this category
                          </div>
                        );
                      }

                      return filteredList.slice(0, 40).map(p => {
                        const oppTypes = opportunitiesMap[p.sku] || [];
                        const isAdded = items.some(i => i.productId === p.sku);
                        
                        return (
                          <div
                            key={p.sku}
                            onClick={() => {
                              if (!isAdded) {
                                handleAddItem(p.sku);
                                setProductSearchQuery('');
                                setShowSearchList(false);
                              }
                            }}
                            className={`p-3 text-xs flex justify-between items-center transition-all cursor-pointer border-b border-gray-50 last:border-0 ${
                              isAdded ? 'bg-gray-50/70 opacity-40 cursor-not-allowed' : 'hover:bg-emerald-50/50'
                            }`}
                          >
                            <div className="space-y-1 flex-1 pr-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-gray-900">{p.name}</span>
                                {oppTypes.includes('NEAR_EXPIRY') && (
                                  <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black px-1.5 py-0.5 rounded">
                                    Near Expiry
                                  </span>
                                )}
                                {oppTypes.includes('DEAD_STOCK') && (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded">
                                    Dead Stock
                                  </span>
                                )}
                                {oppTypes.includes('SLOW_MOVING') && (
                                  <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-black px-1.5 py-0.5 rounded">
                                    Slow Moving
                                  </span>
                                )}
                                {oppTypes.includes('OVERSTOCK') && (
                                  <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black px-1.5 py-0.5 rounded">
                                    Overstock
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 text-[10px] text-gray-400 font-mono">
                                <span>SKU: {p.sku}</span>
                                {p.barcode && <span>| Barcode: {p.barcode}</span>}
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-3">
                              <div>
                                <span className="font-extrabold text-[#103e2c] block text-xs">Rs. {p.sellingPrice}</span>
                                <span className={`text-[10px] font-semibold ${p.currentStock > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                                  {p.currentStock} in stock
                                </span>
                              </div>
                              <span className={`material-symbols-outlined text-[18px] p-1 rounded-full ${
                                isAdded ? 'text-gray-300' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}>
                                {isAdded ? 'check' : 'add'}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                <span className="material-symbols-outlined text-[36px] text-gray-300">add_shopping_cart</span>
                <p className="text-sm text-gray-500 font-medium">Select products from the dropdown above to build your bundle.</p>
                <p className="text-xs text-gray-400">Items tagged with AI badges (e.g. SLOW_MOVING, DEAD_STOCK) are ideal Target candidates.</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-gray-50">
                {items.map((item, index) => {
                  const oppTypes = opportunitiesMap[item.productId] || [];
                  const isTarget = item.role === 'TARGET';
                  return (
                    <div key={item.productId} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-gray-200 transition-all grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-6 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                            isTarget 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            {isTarget ? '🎯 Target Item' : '⭐ Anchor Item'}
                          </span>
                          {oppTypes.map((ot: string) => (
                            <span key={ot} className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded">
                              {ot}
                            </span>
                          ))}
                        </div>
                        <p className="font-extrabold text-gray-900 text-sm">{item.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 font-mono">
                          <span>SKU: {item.productId}</span>
                          <span>Sell: <strong>Rs. {item.normalUnitPrice}</strong></span>
                          <span>Cost: <strong>Rs. {item.costPrice}</strong></span>
                        </div>
                      </div>
                      
                      <div className="md:col-span-5 grid grid-cols-5 gap-2 items-center">
                        <div className="col-span-2 space-y-0.5">
                          <label className="text-[9px] text-gray-400 font-bold uppercase">Qty</label>
                          <input 
                            type="number" 
                            min="1"
                            value={item.quantity} 
                            onChange={(e) => handleItemFieldChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-700 font-bold text-center"
                          />
                        </div>
                        <div className="col-span-3 space-y-0.5">
                          <label className="text-[9px] text-gray-400 font-bold uppercase">Bundle Role</label>
                          <select 
                            value={item.role} 
                            onChange={(e) => handleItemFieldChange(index, 'role', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer font-bold focus:border-emerald-700"
                          >
                            <option value="TARGET">Target (Clearance Item)</option>
                            <option value="ANCHOR">Anchor (Popular Item)</option>
                            <option value="SUPPORT">Support (Bonus Item)</option>
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-1 flex justify-end pr-1">
                        <button 
                          onClick={() => handleRemoveItem(index)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove from bundle"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stock Capacity & Bottleneck Insight */}
            {items.length >= 2 && (() => {
              const capacityList = items.map(item => {
                const prod = products.find(p => p.sku === item.productId);
                const physicalStock = prod?.currentStock ?? 80;
                const qtyPerPack = Math.max(1, item.quantity);
                const isTarget = item.role === 'TARGET';

                // Detect overlap with other active/approved combos
                const overlappingCombos = activeCombos.filter((c: any) => 
                  c.id !== comboId && 
                  ['ACTIVE', 'APPROVED', 'SUBMITTED'].includes(c.status) &&
                  c.items?.some((ci: any) => ci.productId === item.productId)
                );

                const lockedInOtherCombos = overlappingCombos.reduce((sum: number, c: any) => {
                  const ci = c.items?.find((i: any) => i.productId === item.productId);
                  return sum + (ci ? ci.quantity * Math.max(0, (c.maximumQuantity || 0) - (c.soldQuantity || 0)) : 0);
                }, 0);

                // Regular buyer reserve buffer: Anchors reserve 15% stock for regular walk-in shoppers
                const walkinReserveBuffer = isTarget ? 0 : Math.max(5, Math.round(physicalStock * 0.15));
                const availableForThisPromo = Math.max(0, physicalStock - lockedInOtherCombos - walkinReserveBuffer);
                const possiblePacks = Math.floor(availableForThisPromo / qtyPerPack);

                return {
                  productId: item.productId,
                  name: item.name,
                  role: item.role,
                  physicalStock,
                  lockedInOtherCombos,
                  overlappingCombos,
                  walkinReserveBuffer,
                  availableForThisPromo,
                  qtyPerPack,
                  possiblePacks
                };
              });

              const bottleneckPacks = Math.min(...capacityList.map(c => c.possiblePacks));
              const bottleneckItem = capacityList.find(c => c.possiblePacks === bottleneckPacks);
              const hasConflict = capacityList.some(c => c.lockedInOtherCombos > 0);

              return (
                <div className="bg-slate-50/60 rounded-2xl p-5 border border-slate-200 space-y-4 mt-4">
                  <div className="flex justify-between items-center gap-4">
                    <div>
                      <span className="text-xs font-extrabold text-[#103e2c] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                        Stock Availability & Safe Campaign Capacity
                      </span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Protects regular walk-in sales buffer and prevents stock conflicts with active combos.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={bottleneckPacks <= 0}
                      onClick={() => {
                        if (bottleneckPacks > 0) setMaximumQuantity(bottleneckPacks);
                      }}
                      className="text-[11px] font-bold text-[#103e2c] bg-white border border-emerald-300 px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[15px]">sync</span>
                      Auto-Fit Safe Max ({bottleneckPacks} Packs)
                    </button>
                  </div>

                  {/* Active Combo Conflict Alert Banner */}
                  {hasConflict && (
                    <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-3 text-xs">
                      <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">info</span>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-amber-900 text-xs">Shared Stock with Active Campaigns</p>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">verified</span>
                            Safe Buffer Protected
                          </span>
                        </div>

                        <div className="space-y-1">
                          {capacityList.filter(c => c.lockedInOtherCombos > 0).map(c => {
                            const comboCount = c.overlappingCombos.length;
                            const comboCodes = c.overlappingCombos.map((oc: any) => oc.comboCode || oc.name).join(', ');
                            return (
                              <div key={c.name} className="flex flex-wrap items-center gap-1.5 text-[11px] text-amber-900">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                <span className="font-semibold text-slate-900">{c.name}:</span>
                                <span>
                                  <strong>{c.lockedInOtherCombos} units</strong> reserved across {comboCount} active {comboCount === 1 ? 'campaign' : 'campaigns'}
                                </span>
                                <span 
                                  className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-mono cursor-help"
                                  title={comboCodes}
                                >
                                  {comboCount > 2 ? `${c.overlappingCombos.slice(0, 2).map((oc: any) => oc.comboCode || oc.name).join(', ')} +${comboCount - 2} more` : comboCodes}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <p className="text-[11px] text-amber-800/90 pt-0.5">
                          AI automatically reserved these units to protect regular customers. You can safely create up to <strong>{bottleneckPacks} packs</strong> without stock shortages.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Multi-Tier Product Stock Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {capacityList.map(c => {
                      const isBottleneck = c.possiblePacks === bottleneckPacks;
                      const totalReserved = c.lockedInOtherCombos + c.walkinReserveBuffer;
                      const availPercent = c.physicalStock > 0 ? Math.min(100, Math.round((c.availableForThisPromo / c.physicalStock) * 100)) : 0;

                      return (
                        <div 
                          key={c.name} 
                          className={`p-4 rounded-xl border transition-all ${
                            isBottleneck && bottleneckPacks === 0
                              ? 'bg-rose-50/20 border-rose-200'
                              : isBottleneck
                              ? 'bg-amber-50/25 border-amber-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2.5">
                            <div className="min-w-0 pr-1">
                              <p className="font-bold text-xs text-slate-800 truncate" title={c.name}>{c.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                  c.role === 'TARGET' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {c.role}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">• {c.qtyPerPack} / pack</span>
                              </div>
                            </div>

                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 border ${
                              c.possiblePacks === 0
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isBottleneck
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {c.possiblePacks} Packs Max {isBottleneck && <span className="text-[9px] font-bold opacity-80">(Limit)</span>}
                            </span>
                          </div>

                          {/* 3 Metrics breakdown */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center text-[10px]">
                            <div>
                              <span className="text-slate-400 block font-medium">Physical Stock</span>
                              <span className="font-bold text-slate-700 text-xs mt-0.5 block">{c.physicalStock} Units</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Reserved Buffer</span>
                              <span 
                                className="font-bold text-amber-800 text-xs mt-0.5 block cursor-help"
                                title={`${c.lockedInOtherCombos} in active combos + ${c.walkinReserveBuffer} walk-in reserve`}
                              >
                                {totalReserved} Units
                              </span>
                            </div>
                            <div className="border-l border-slate-200/60 pl-1">
                              <span className="text-slate-400 block font-medium">Safe Promo Pool</span>
                              <span className={`font-black text-xs mt-0.5 block ${c.availableForThisPromo > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {c.availableForThisPromo} Units
                              </span>
                            </div>
                          </div>

                          {/* Mini Availability Progress Bar */}
                          <div className="mt-2.5 space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                              <span>Promo Availability</span>
                              <span className={availPercent > 0 ? 'text-slate-600 font-semibold' : 'text-rose-600 font-semibold'}>
                                {availPercent > 0 ? `${availPercent}% Available` : 'Fully Reserved'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  availPercent > 40 ? 'bg-emerald-500' : availPercent > 0 ? 'bg-amber-500' : 'bg-rose-400'
                                }`}
                                style={{ width: `${Math.max(4, availPercent)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Campaign Target Volume Input */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800">Set Max Campaign Volume</p>
                        {maximumQuantity > bottleneckPacks && bottleneckPacks > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            Exceeds Safe Limit
                          </span>
                        )}
                        {bottleneckPacks === 0 && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">block</span>
                            0 Safe Packs Available
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {bottleneckItem ? (
                          <>
                            Safe maximum is <strong className="text-slate-700">{bottleneckPacks} packs</strong> (bounded by <em>{bottleneckItem.name}</em>).
                          </>
                        ) : (
                          'Sets total promo bundles allowed for POS checkout.'
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {bottleneckPacks > 0 && maximumQuantity !== bottleneckPacks && (
                        <button
                          type="button"
                          onClick={() => setMaximumQuantity(bottleneckPacks)}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Set to Safe Max ({bottleneckPacks})
                        </button>
                      )}
                      <div className="relative w-32">
                        <input 
                          type="number"
                          min="1"
                          value={maximumQuantity}
                          onChange={(e) => setMaximumQuantity(parseInt(e.target.value) || 1)}
                          className={`w-full bg-slate-50 border rounded-xl px-3 py-1.5 text-sm font-black outline-none focus:bg-white transition-all text-center ${
                            maximumQuantity > bottleneckPacks
                              ? 'border-amber-300 text-amber-900 focus:border-amber-500'
                              : 'border-slate-200 text-[#103e2c] focus:border-emerald-700'
                          }`}
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold pointer-events-none">Packs</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>

        {/* Right 1 Column: Financial Preview & Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b border-gray-50 pb-2">Financial Preview & Pricing</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Regular Total Price</span>
                <span className="font-bold text-gray-900">Rs. {normalTotalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Combined Cost Price</span>
                <span className="font-semibold text-gray-700">Rs. {totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-50 pt-2">
                <span>Break-Even Floor (0% Loss)</span>
                <span className="font-bold text-gray-700">Rs. {breakEvenCost.toFixed(2)}</span>
              </div>

              {/* Combo Price Input inside Financial Preview */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-3 mt-2">
                <label className="text-xs text-emerald-900 font-extrabold uppercase tracking-wider block">
                  Set Promotional Combo Price (Rs.)
                </label>
                <input 
                  type="number" 
                  value={comboPrice === 0 ? '' : comboPrice} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setComboPrice(0);
                    } else {
                      const parsed = parseFloat(val);
                      setComboPrice(isNaN(parsed) ? 0 : parsed);
                    }
                  }}
                  onFocus={(e) => {
                    if (comboPrice === 0) {
                      e.target.select();
                    }
                  }}
                  placeholder="Enter Bundle Price (e.g. 1500)"
                  className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2.5 text-lg outline-none focus:border-emerald-700 transition-all font-black text-emerald-900 shadow-sm"
                />

                {/* Quick Preset Buttons */}
                {normalTotalPrice > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Quick Discount Presets</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPresetDiscount(10)}
                        className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        10% OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetDiscount(15)}
                        className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        15% OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetDiscount(20)}
                        className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        20% OFF
                      </button>
                      <button
                        type="button"
                        onClick={applyCostFloorPreset}
                        className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        Cost Floor
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between border-t border-gray-50 pt-2">
                <span className="text-gray-600">Customer Saves</span>
                <span className="font-extrabold text-emerald-700">
                  Rs. {Math.max(0, normalTotalPrice - comboPrice).toFixed(2)} ({normalTotalPrice > 0 ? ((Math.max(0, normalTotalPrice - comboPrice) / normalTotalPrice) * 100).toFixed(0) : 0}% OFF)
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-50 pt-2 text-base">
                <span className="text-gray-700">Projected Net Profit</span>
                <span className={`font-black ${expectedProfit >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                  Rs. {expectedProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-600 text-xs">Profit Margin</span>
                <span className={`text-base font-black ${expectedMargin >= 15 ? 'text-emerald-700' : expectedMargin > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                  {expectedMargin.toFixed(1)}% {expectedMargin < 15 && expectedMargin > 0 ? '(Clearance)' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Contextual Validation Feedback */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b border-gray-50 pb-2">System Revalidation</h3>
            
            {items.length === 0 ? (
              <div className="bg-gray-50 border border-gray-100 text-gray-600 p-4 rounded-xl text-xs leading-relaxed space-y-1">
                <p className="font-bold text-gray-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">info</span> Combo Setup Guide
                </p>
                <p>1. Select Target & Anchor products from the dropdown.</p>
                <p>2. Review the cost price and normal total in the Financial Preview.</p>
                <p>3. Set your promotional bundle price or click a preset button.</p>
              </div>
            ) : validationSuccess ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                All checks passed! Campaign is margin-safe and ready.
              </div>
            ) : (
              <div className="space-y-2">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 text-amber-900 px-3 py-2.5 rounded-xl text-[11px] leading-relaxed">
                    <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0">warning</span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </main>

  {/* StockSense Theme Custom Modal Popup */}
  {modalConfig.isOpen && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-fade-in">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-5 animate-scale-up">
        {/* Modal Header & Icon */}
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            modalConfig.type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
            modalConfig.type === 'WARNING' || modalConfig.type === 'CHECKLIST' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
            modalConfig.type === 'ERROR' ? 'bg-red-50 text-red-700 border border-red-100' :
            'bg-blue-50 text-blue-700 border border-blue-100'
          }`}>
            <span className="material-symbols-outlined text-[26px]">
              {modalConfig.type === 'SUCCESS' ? 'check_circle' :
               modalConfig.type === 'WARNING' ? 'warning' :
               modalConfig.type === 'CHECKLIST' ? 'checklist' :
               modalConfig.type === 'ERROR' ? 'error' : 'help_outline'}
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{modalConfig.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{modalConfig.message}</p>
          </div>
        </div>

        {/* Modal List Items */}
        {modalConfig.listItems && modalConfig.listItems.length > 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 space-y-2 max-h-48 overflow-y-auto">
            {(modalConfig.listItems ?? []).map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="material-symbols-outlined text-[14px] text-amber-600 shrink-0 mt-0.5">adjust</span>
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-3">
          {modalConfig.type === 'CONFIRM' && (
            <button
              type="button"
              onClick={() => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                if (modalConfig.onCancel) modalConfig.onCancel();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
            >
              {modalConfig.cancelText || 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setModalConfig(prev => ({ ...prev, isOpen: false }));
              if (modalConfig.onConfirm) modalConfig.onConfirm();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              modalConfig.type === 'ERROR'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[#103e2c] hover:bg-[#165a40] text-white'
            }`}
          >
            {modalConfig.confirmText || 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
</div>
  );
}
