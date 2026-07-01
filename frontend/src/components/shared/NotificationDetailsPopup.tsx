import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NotificationItem, NotificationService } from '../../services/notificationService';
import { DiscountService } from '../../services/discountService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface NotificationDetailsPopupProps {
  notification: NotificationItem;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function NotificationDetailsPopup({
  notification,
  onClose,
  onActionComplete
}: NotificationDetailsPopupProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [discountDetails, setDiscountDetails] = useState<any | null>(null);

  // Fetch full discount details if it is a discount approval notification
  useEffect(() => {
    if (notification.type === 'DISCOUNT_APPROVAL' && notification.metadata?.discountId) {
      const fetchDiscount = async () => {
        try {
          setLoading(true);
          const res = await DiscountService.getDiscounts();
          if (res.success) {
            const match = res.data.find((d: any) => d.id === notification.metadata.discountId);
            setDiscountDetails(match || null);
          }
        } catch (err) {
          console.error('Error loading discount details:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchDiscount();
    }
  }, [notification]);

  const handleMarkReadAndClose = async () => {
    try {
      await NotificationService.markRead(notification.id);
      onActionComplete();
      onClose();
    } catch {
      onClose();
    }
  };

  const handleDiscountApproval = async (approve: boolean) => {
    if (!notification.metadata?.discountId) return;
    try {
      setLoading(true);
      const res = await DiscountService.toggleStatus(notification.metadata.discountId, {
        approvalStatus: approve ? 'APPROVED' : 'DRAFT',
        isActive: approve ? true : false
      });
      if (res.success) {
        toast.success(approve ? 'Discount campaign approved successfully!' : 'Discount campaign declined.');
        // Try to mark the approval notification as read (it may have been auto-deleted by toggleStatus)
        try {
          await NotificationService.markRead(notification.id);
        } catch {
          // Notification was already cleaned up — this is expected
        }
        onActionComplete();
        onClose();
      } else {
        toast.error(res.message || 'Failed to update discount approval status.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Server error updating discount.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = async () => {
    // Determine action based on type
    if (notification.type === 'LOW_STOCK' || notification.type === 'OUT_OF_STOCK') {
      if (notification.sku) {
        navigate(`/inventory-operations?tab=grn&action=add&sku=${notification.sku}`);
        toast.info(`Redirected to Procurement GRN for SKU ${notification.sku}`);
      } else {
        navigate('/inventory-operations?tab=grn');
      }
      handleMarkReadAndClose();
    } else if (notification.type === 'STOCK_VELOCITY') {
      const sku = notification.sku || notification.product?.sku;
      if (sku) {
        navigate(`/manage-products?tab=discounts&action=add&sku=${sku}`);
        toast.info(`Redirected to Discounts to create promotion for SKU ${sku}`);
      } else {
        navigate('/manage-products?tab=discounts');
      }
      handleMarkReadAndClose();
    } else if (notification.type === 'EXPIRING_SOON' || notification.type === 'OVERSTOCK') {
      const sku = notification.sku || notification.product?.sku;
      const reason = notification.type === 'EXPIRING_SOON' ? 'Expired' : 'System correction';
      if (sku) {
        navigate(`/inventory-operations?tab=adjustments&sku=${sku}&reason=${reason}`);
        toast.info(`Redirected to Stock Adjustments for SKU ${sku}`);
      } else {
        navigate('/inventory-operations?tab=adjustments');
      }
      handleMarkReadAndClose();
    } else if (notification.type === 'DEMAND_FORECAST') {
      const sku = notification.sku || notification.product?.sku;
      if (sku) {
        navigate(`/manage-products?tab=products&action=edit&sku=${sku}&scrollTo=reorder`);
        toast.info(`Redirected to Product Edit for SKU ${sku}`);
      } else {
        navigate('/manage-products?tab=products');
      }
      handleMarkReadAndClose();
    } else if (notification.type === 'EXPIRED') {
      if (notification.sku) {
        navigate(`/inventory-operations?tab=adjustments&sku=${notification.sku}&reason=EXPIRED`);
        toast.info(`Redirected to Stock Adjustments for SKU ${notification.sku}`);
      } else {
        navigate('/inventory-operations?tab=adjustments');
      }
      handleMarkReadAndClose();
    } else if (notification.type === 'COMBO_SUGGESTION') {
      navigate('/manage-products?tab=discounts&action=add-combo');
      handleMarkReadAndClose();
    } else {
      // General acknowledgement
      handleMarkReadAndClose();
    }
  };

  // ── RENDER SPECIFIC BODY SECTIONS ──────────────────────────────────────────

  // 1. Discount Approval
  const renderDiscountApprovalBody = () => {
    if (loading) {
      return <div className="text-center py-6 text-xs font-semibold text-slate-500">Loading discount campaign products...</div>;
    }
    if (!discountDetails) {
      return <div className="text-center py-6 text-xs text-red-500">Could not retrieve discount products list. It may have been deleted.</div>;
    }

    const value = discountDetails.discountValue;
    const isCombo = discountDetails.type === 'COMBO';

    return (
      <div className="space-y-4">
        <div className="bg-[#f8f9fa] border border-slate-200/80 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Campaign Type:</span>
              <span className="ml-1.5 font-bold text-slate-700">{discountDetails.type}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Discount Value:</span>
              <span className="ml-1.5 font-bold text-emerald-600">{value}% Off</span>
            </div>
          </div>
          {discountDetails.startDate && (
            <div className="text-xs">
              <span className="text-slate-400 font-medium">Duration:</span>
              <span className="ml-1.5 font-semibold text-slate-600">{discountDetails.startDate} to {discountDetails.endDate}</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Product list &amp; Pricing</p>
          <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                  <th className="px-3 py-2">Product Name</th>
                  <th className="px-3 py-2 text-center">Stock</th>
                  <th className="px-3 py-2 text-right">Orig Price</th>
                  <th className="px-3 py-2 text-right">Promo Price</th>
                </tr>
              </thead>
              <tbody>
                {isCombo
                  ? discountDetails.comboItems?.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-700">{item.productName || item.productId} (x{item.minQty})</td>
                        <td className="px-3 py-2 text-center text-slate-500">{item.currentStock ?? '-'}</td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {item.sellingPrice != null ? `Rs. ${((item.sellingPrice) * item.minQty).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-600">
                          {item.sellingPrice != null ? `Rs. ${(((item.sellingPrice) * item.minQty) * (1 - value / 100)).toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))
                  : (discountDetails.products?.length > 0 ? discountDetails.products : discountDetails.productIds?.map((sku: string) => ({ sku, name: sku, currentStock: null, sellingPrice: null })))
                    ?.map((prod: any, idx: number) => {
                      const origPrice = prod.sellingPrice;
                      const promoPrice = origPrice != null ? origPrice * (1 - value / 100) : null;
                      return (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-medium text-slate-700 truncate max-w-[12rem]">
                            {prod.name || prod.sku}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-500">
                            {prod.currentStock ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">
                            {origPrice != null ? `Rs. ${origPrice.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-600">
                            {promoPrice != null ? `Rs. ${promoPrice.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleDiscountApproval(true)}
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer flex justify-center items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Approve Campaign
          </button>
          <button
            onClick={() => handleDiscountApproval(false)}
            disabled={loading}
            className="flex-1 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex justify-center items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">cancel</span>
            Decline
          </button>
        </div>
      </div>
    );
  };

  // 2. Low / Out of Stock
  const renderStockAlertBody = () => {
    const prod = notification.product;
    return (
      <div className="space-y-4">
        {prod && (
          <div className="flex items-center gap-4 bg-[#f8f9fa] border border-slate-200/80 rounded-xl p-4">
            {prod.imageUrl ? (
              <img src={prod.imageUrl} alt={prod.name} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
            ) : (
              <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[28px]">inventory_2</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm text-slate-800 truncate">{prod.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">SKU: {prod.sku}</p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <div>
                  Stock: <span className="font-bold text-red-600">{prod.currentStock}</span>
                </div>
                <div className="h-3 w-px bg-slate-200" />
                <div>
                  Reorder Level: <span className="font-bold text-slate-500">{prod.reorderLevel}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-red-50/50 border border-red-100 rounded-xl p-3.5 text-xs text-red-700 leading-relaxed">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">info</span>
            Replenishment Advice
          </p>
          <p className="mt-1">
            Running low on stock affects billing checkout operations and risks lost customer sales. We recommend creating an instant Goods Receiving Note (GRN) to restock inventory levels above the warning threshold.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleActionClick}
            className="flex-1 bg-[#0b8252] hover:bg-[#096b43] text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer flex justify-center items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">local_shipping</span>
            Restock Now
          </button>
          <button
            onClick={handleMarkReadAndClose}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  // ── CORE PORTAL MODAL DIALOG ───────────────────────────────────────────────
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${
              notification.severity === 'CRITICAL' ? 'text-red-500' :
              notification.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-500'
            }`}>
              {notification.type === 'DISCOUNT_APPROVAL' ? 'pending_actions' :
               notification.type === 'LOW_STOCK' || notification.type === 'OUT_OF_STOCK' ? 'crisis_alert' : 'notifications'}
            </span>
            <h3 className="font-bold text-sm text-slate-800">Alert Details</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div>
            <h4 className="font-bold text-base text-slate-800 leading-tight">{notification.title}</h4>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">{notification.message}</p>
          </div>

          {/* Type specific details */}
          {notification.type === 'DISCOUNT_APPROVAL' && renderDiscountApprovalBody()}
          {(notification.type === 'LOW_STOCK' || notification.type === 'OUT_OF_STOCK') && renderStockAlertBody()}

          {/* Fallback actions if not handled by standard templates */}
          {notification.type !== 'DISCOUNT_APPROVAL' && notification.type !== 'LOW_STOCK' && notification.type !== 'OUT_OF_STOCK' && (
            <div className="flex gap-3 pt-2">
              {notification.type !== 'DEMAND_FORECAST' && (
                <button
                  onClick={handleActionClick}
                  className="flex-1 bg-[#0b8252] hover:bg-[#096b43] text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {(notification.type === 'EXPIRING_SOON' || notification.type === 'OVERSTOCK')
                    ? 'Remove Shelf'
                    : notification.type === 'STOCK_VELOCITY'
                      ? 'Create Promotion'
                      : (notification.suggestedAction || 'Acknowledge Action')}
                </button>
              )}
              <button
                onClick={handleMarkReadAndClose}
                className={`py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer ${
                  notification.type === 'DEMAND_FORECAST' ? 'flex-1 bg-slate-50' : 'px-5'
                }`}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
