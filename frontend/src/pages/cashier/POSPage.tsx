import { useState, useMemo, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, ShoppingCart, LogOut,
  Plus, Minus, Receipt, FileText,
  TerminalSquare, Banknote, Gift
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthContext } from '../../context/AuthContext';
import { MasterDataService } from '../../services/masterDataService';
import { DiscountService } from '../../services/discountService';
import { SalesService } from '../../services/salesService';
import { RefundService } from '../../services/refundService';

import { ProductsTab } from './components/ProductsTab';
import { DiscountsTab } from './components/DiscountsTab';
import { DraftBillsTab } from './components/DraftBillsTab';
import { OrdersTab } from './components/OrdersTab';
import { BillTab } from './components/BillTab';

// --- MOCK DATA REMOVED ---

export interface DraftBill {
  id: number;
  cart: any[];
  timestamp: Date;
}

const getFallbackImage = (category: string, name: string, sku: string, currentImageUrl: string) => {
  const isDefault = currentImageUrl && currentImageUrl.includes('1542838132-92c53300491e');
  
  if (currentImageUrl && !isDefault && currentImageUrl.trim() !== '') {
    return currentImageUrl;
  }

  const cat = (category || '').toLowerCase();
  const prodName = (name || '').toLowerCase();
  
  if (cat.includes('bakery')) {
    if (prodName.includes('bread')) return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=400&auto=format&fit=crop';
    if (prodName.includes('cake')) return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=400&auto=format&fit=crop';
    if (prodName.includes('croissant')) return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=400&auto=format&fit=crop';
    if (prodName.includes('cookie')) return 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=400&auto=format&fit=crop';
    if (prodName.includes('muffin') || prodName.includes('cupcake')) return 'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?q=80&w=400&auto=format&fit=crop';
    if (prodName.includes('bun')) return 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?q=80&w=400&auto=format&fit=crop';
    
    const bakeryDefaults = [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=400&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?q=80&w=400&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517433622905-015456488a0b?q=80&w=400&auto=format&fit=crop'
    ];
    const index = (sku || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % bakeryDefaults.length;
    return bakeryDefaults[index];
  }
  
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop';
};

export default function POSPage() {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<'bill' | 'products' | 'discounts' | 'orders' | 'drafts'>('bill');
  const [draftBills, setDraftBills] = useState<any[]>([]);
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [scannedProductQty, setScannedProductQty] = useState<number>(1);
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [searchMatches, setSearchMatches] = useState<any[]>([]);
  const [searchMatchQuantities, setSearchMatchQuantities] = useState<Record<number, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountType, setDiscountType] = useState<'item' | 'bill' | 'both'>('item');
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [, setDiscountInput] = useState<string>('');
  const [customerPaidInput, setCustomerPaidInput] = useState<string>('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [resumedDraftId, setResumedDraftId] = useState<string | null>(null);
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'REFUNDED'>('ALL');
  const [showRefundInvoiceModal, setShowRefundInvoiceModal] = useState<boolean>(false);
  const [activeRefundReceipt, setActiveRefundReceipt] = useState<any>(null);

  // Combo suggestion states
  const [suggestedCombo, setSuggestedCombo] = useState<any>(null);
  const [showComboSuggestionModal, setShowComboSuggestionModal] = useState<boolean>(false);
  const [declinedCombos, setDeclinedCombos] = useState<string[]>([]);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [discounts, setDiscounts] = useState<any[]>([]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [prodRes, discRes, draftsRes, historyRes] = await Promise.all([
        MasterDataService.getProducts(),
        DiscountService.getDiscounts(),
        SalesService.getDraftBills(),
        SalesService.getSalesHistory()
      ]);

      if (prodRes.success) {
        const mapped = prodRes.data.map((p: any) => ({
          id: p.sku,
          barcode: p.barcode,
          sku: p.sku,
          category: p.masterClass?.category?.name || 'Uncategorized',
          name: p.name,
          price: p.sellingPrice,
          discount: p.discount || 0,
          image: getFallbackImage(p.masterClass?.category?.name, p.name, p.sku, p.imageUrl),
          currentStock: p.currentStock
        }));
        setProducts(mapped);
      }

      if (discRes.success) {
        const activeApproved = discRes.data.filter((d: any) => d.isActive && d.approvalStatus === 'APPROVED');
        setDiscounts(activeApproved);
      }

      if (draftsRes.success) {
        setDraftBills(draftsRes.data);
      }

      if (historyRes.success) {
        setCompletedOrders(historyRes.data);
        if (historyRes.data.length > 0) {
          setSelectedOrder((prev: any) => {
            if (prev) {
              const matched = historyRes.data.find((o: any) => o.id === prev.id);
              if (matched) return matched;
            }
            return historyRes.data[0];
          });
        }
      }
    } catch (err) {
      console.error('Failed to load data for POS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Dynamically load html2pdf script
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const cartWithDiscounts = useMemo(() => {
    const comboItems = cart.filter(item => item.isCombo);
    const individualItems = cart.filter(item => !item.isCombo).map(item => ({
      ...item,
      // Preserve discount for items pinned from the Discounts tab; reset others so auto-detection can run
      discount: item._discountPinned ? (item.discount || 0) : 0,
      discountId: item._discountPinned ? (item.discountId || null) : null,
    }));

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - tzOffset);
    const currentDateStr = localDate.toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"

    individualItems.forEach(item => {
      // If the item was added with a pinned discount (e.g. from the Discounts tab),
      // skip auto-recalculation and use the pinned value.
      if (item._discountPinned) return;

      const prod = products.find(p => p.sku === item.sku || p.id === item.id);
      const defaultDiscount = prod ? (prod.discount || 0) : 0;

      let bestDiscount = defaultDiscount;
      let bestDiscountId = null;

      discounts.forEach(d => {
        if (d.type === 'SEASONAL') {
          const isTarget = d.productIds?.includes(item.sku) || d.productIds?.includes(item.id);
          if (isTarget) {
            let dateMatch = true;
            if (d.startDate && d.endDate) {
              const startD = d.startDate.split('T')[0];
              const endD = d.endDate.split('T')[0];
              if (currentDateStr < startD || currentDateStr > endD) {
                dateMatch = false;
              }
            }
            if (dateMatch) {
              if (d.discountValue > bestDiscount) {
                bestDiscount = d.discountValue;
                bestDiscountId = d.id;
              }
            }
          }
        } else if (d.type === 'DAILY') {
          const isTarget = d.productIds?.includes(item.sku) || d.productIds?.includes(item.id);
          if (isTarget) {
            let dateMatch = true;
            if (d.applicableDate) {
              const appD = d.applicableDate.split('T')[0];
              if (currentDateStr !== appD) {
                dateMatch = false;
              }
            }
            
            if (dateMatch) {
              let timeMatch = true;
              if (d.dailyStartTime && d.dailyEndTime) {
                if (currentTimeStr < d.dailyStartTime || currentTimeStr > d.dailyEndTime) {
                  timeMatch = false;
                }
              }

              if (timeMatch) {
                if (d.discountValue > bestDiscount) {
                  bestDiscount = d.discountValue;
                  bestDiscountId = d.id;
                }
              }
            }
          }
        }
      });

      item.discount = bestDiscount;
      item.discountId = bestDiscountId;
    });

    return [...comboItems, ...individualItems];
  }, [cart, discounts, products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!selectedCategory) return matchesSearch;

      const normProdCat = product.category.toLowerCase();
      const normSelCat = selectedCategory.toLowerCase();

      // Check direct equality or mapping
      const matchesCategory = normProdCat === normSelCat
        || (normSelCat === 'beverages' && normProdCat === 'beverages')
        || (normSelCat === 'snacks' && normProdCat === 'snacks')
        || (normSelCat === 'dairy products' && normProdCat === 'dairy products')
        || (normSelCat === 'bakery items' && normProdCat === 'bakery items')
        || (normSelCat === 'fruits & vegetables' && normProdCat === 'fruits & vegetables')
        || (normSelCat === 'frozen foods' && normProdCat === 'frozen foods')
        || (normSelCat === 'household essentials' && normProdCat === 'household essentials')
        || (normSelCat === 'personal care' && normProdCat === 'personal care')
        || (normSelCat === 'packaged foods' && normProdCat === 'packaged foods')
        || (normSelCat === 'cleaning supplies' && normProdCat === 'cleaning supplies');

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // --- CART LOGIC ---
  const addToCart = (product: any, quantityToAdd: number = 1, overrideDiscount?: number, overrideDiscountId?: string) => {
    // If we add something new, let cashier reconsider declined combos
    setDeclinedCombos([]);
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantityToAdd } : item);
      }
      return [...prev, {
        ...product,
        quantity: quantityToAdd,
        discount: overrideDiscount !== undefined ? overrideDiscount : (product.discount || 0),
        discountId: overrideDiscountId !== undefined ? overrideDiscountId : (product.discountId || null),
        _discountPinned: overrideDiscount !== undefined // flag to skip auto-recalc
      }];
    });
  };

  const updateQuantity = (id: number | string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const passBillToDraft = async () => {
    if (cart.length === 0) return;
    try {
      const itemsPayload = cartWithDiscounts.map(item => {
        const itemDisc = discountType === 'bill' ? 0 : (item.discount || 0);
        if (item.isCombo) {
          return item.comboItems.map((ci: any) => ({
            sku: ci.sku,
            qty: ci.qty,
            unitPrice: ci.unitPrice,
            total: ci.unitPrice * ci.qty * (1 - itemDisc / 100),
            discountId: itemDisc > 0 ? item.discountId : null,
            discountValue: itemDisc
          }));
        } else {
          const itemTotal = (item.price * item.quantity) * (1 - itemDisc / 100);
          return {
            sku: item.sku,
            qty: item.quantity,
            unitPrice: item.price,
            total: itemTotal,
            discountId: itemDisc > 0 ? (item.discountId || null) : null,
            discountValue: itemDisc
          };
        }
      }).flat();

      const payload = {
        subtotal: itemsSubtotal,
        totalDiscount: totalSavedAmount,
        totalBill: total,
        paymentMethod: 'CASH' as const,
        totalQty: cartWithDiscounts.reduce((sum, item) => sum + (item.isCombo ? item.comboItems.reduce((s: number, ci: any) => s + ci.qty, 0) : item.quantity), 0),
        draft: true,
        items: itemsPayload
      };

      const res = await SalesService.createBill(payload);
      if (res.success) {
        toast.success('Bill placed on hold (Draft saved)!');
        const draftsRes = await SalesService.getDraftBills();
        if (draftsRes.success) {
          setDraftBills(draftsRes.data);
        }
        setCart([]);
        setResumedDraftId(null);
        setActiveTab('drafts');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to place bill on hold.');
    }
  };

  const mapDbBillToCart = (dbBill: any) => {
    const newCart: any[] = [];
    const comboGroups: Record<string, any[]> = {};

    dbBill.billItems.forEach((item: any) => {
      const isComboDiscount = item.discount?.type === 'COMBO' || (discounts.find(d => d.id === item.discountId)?.type === 'COMBO');
      if (item.discountId && isComboDiscount) {
        if (!comboGroups[item.discountId]) {
          comboGroups[item.discountId] = [];
        }
        comboGroups[item.discountId].push(item);
      } else {
        newCart.push({
          id: item.sku,
          sku: item.sku,
          barcode: item.product?.barcode,
          category: item.product?.category || 'Uncategorized',
          name: item.product?.name || item.sku,
          price: item.unitPrice,
          quantity: item.qty,
          discount: item.discountValue || 0,
          discountId: item.discountId,
          image: item.product?.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop',
          currentStock: item.product?.currentStock || 0
        });
      }
    });

    Object.entries(comboGroups).forEach(([discountId, items]) => {
      const discount = discounts.find(d => d.id === discountId);
      const originalTotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const discountVal = items[0]?.discountValue || discount?.discountValue || 0;

      newCart.push({
        id: `combo-${discountId}-${Date.now()}`,
        name: `Combo: ${discount?.name || 'Combo Bundle'}`,
        price: originalTotal,
        quantity: 1,
        discount: discountVal,
        isCombo: true,
        discountId: discountId,
        comboItems: items.map(item => ({
          sku: item.sku,
          qty: item.qty,
          unitPrice: item.unitPrice
        })),
        image: discount?.imageUrl || 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=800&auto=format&fit=crop'
      });
    });

    return newCart;
  };

  const restoreDraftBill = async (draftId: string) => {
    const draft = draftBills.find(d => d.id === draftId);
    if (draft) {
      const cartItems = mapDbBillToCart(draft);
      setCart(cartItems);
      setResumedDraftId(draftId);

      try {
        await SalesService.deleteDraftBill(draftId);
        setDraftBills(prev => prev.filter(d => d.id !== draftId));
      } catch (err) {
        console.error('Failed to delete draft bill upon restore:', err);
      }

      setActiveTab('bill');
      toast.success(`Resumed hold order: ${draft.billNumber}!`);
    }
  };

  const ungroupCombo = (comboId: string) => {
    setCart(prev => {
      const comboItem = prev.find(item => item.id === comboId);
      if (!comboItem) return prev;

      let updatedCart = prev.filter(item => item.id !== comboId);

      comboItem.comboItems.forEach((ci: any) => {
        const prod = products.find(p => p.sku === ci.sku || p.id === ci.sku);
        if (prod) {
          const existing = updatedCart.find(item => item.id === prod.sku);
          if (existing) {
            updatedCart = updatedCart.map(item =>
              item.id === prod.sku
                ? { ...item, quantity: item.quantity + ci.qty }
                : item
            );
          } else {
            updatedCart.push({
              ...prod,
              quantity: ci.qty,
              discount: 0
            });
          }
        }
      });

      return updatedCart;
    });

    toast.info('Combo Pack ungrouped back to individual items.');
  };

  const applySuggestedCombo = (discount: any) => {
    setCart(prev => {
      let updatedCart = prev.map(item => {
        if (item.isCombo) return item;

        const req = discount.comboItems.find((ci: any) => ci.productId === item.sku || ci.productId === item.id);
        if (req) {
          return {
            ...item,
            quantity: item.quantity - req.minQty
          };
        }
        return item;
      }).filter(item => item.quantity > 0);

      const originalTotal = discount.comboItems.reduce((sum: number, ci: any) => {
        const prod = products.find(p => p.sku === ci.productId || p.id === ci.productId);
        return sum + (prod ? prod.price * ci.minQty : 0);
      }, 0);

      const comboPack = {
        id: `combo-${discount.id}-${Date.now()}`,
        name: `Combo: ${discount.name}`,
        price: originalTotal,
        quantity: 1,
        discount: discount.discountValue,
        isCombo: true,
        discountId: discount.id,
        comboItems: discount.comboItems.map((ci: any) => {
          const prod = products.find(p => p.sku === ci.productId || p.id === ci.productId);
          return {
            sku: ci.productId,
            qty: ci.minQty,
            unitPrice: prod ? prod.price : 0
          };
        }),
        image: discount.imageUrl || "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=800&auto=format&fit=crop"
      };

      return [...updatedCart, comboPack];
    });

    setShowComboSuggestionModal(false);
    setSuggestedCombo(null);
    toast.success(`Grouped items into "${discount.name}" Combo Pack!`);
  };

  const declineSuggestedCombo = (discountId: string) => {
    setDeclinedCombos(prev => [...prev, discountId]);
    setShowComboSuggestionModal(false);
    setSuggestedCombo(null);
  };

  const handleCompleteTransaction = async () => {
    if (cart.length === 0) return;

    try {
      const itemsPayload = cartWithDiscounts.map(item => {
        const itemDisc = discountType === 'bill' ? 0 : (item.discount || 0);
        if (item.isCombo) {
          return item.comboItems.map((ci: any) => ({
            sku: ci.sku,
            qty: ci.qty,
            unitPrice: ci.unitPrice,
            total: ci.unitPrice * ci.qty * (1 - itemDisc / 100),
            discountId: itemDisc > 0 ? item.discountId : null,
            discountValue: itemDisc
          }));
        } else {
          const itemTotal = (item.price * item.quantity) * (1 - itemDisc / 100);
          return {
            sku: item.sku,
            qty: item.quantity,
            unitPrice: item.price,
            total: itemTotal,
            discountId: itemDisc > 0 ? (item.discountId || null) : null,
            discountValue: itemDisc
          };
        }
      }).flat();

      const payload = {
        subtotal: itemsSubtotal,
        totalDiscount: totalSavedAmount,
        totalBill: total,
        paymentMethod: 'CASH' as const, // Default for now
        totalQty: cartWithDiscounts.reduce((sum, item) => sum + (item.isCombo ? item.comboItems.reduce((s: number, ci: any) => s + ci.qty, 0) : item.quantity), 0),
        draft: false,
        items: itemsPayload,
        resumeDraftId: resumedDraftId,
        paidAmount: parseFloat(customerPaidInput) || total,
        changeAmount: Math.max(0, (parseFloat(customerPaidInput) || total) - total)
      };

      const res = await SalesService.createBill(payload);
      if (res.success) {
        toast.success('Transaction completed successfully!');
        setActiveReceipt(res.data);
        setCart([]);
        setResumedDraftId(null);
        setManualDiscount(0);

        // Reload data to reflect decreased stock and fresh history
        const [prodRes, historyRes, draftsRes] = await Promise.all([
          MasterDataService.getProducts(),
          SalesService.getSalesHistory(),
          SalesService.getDraftBills()
        ]);

        if (prodRes.success) {
          const mapped = prodRes.data.map((p: any) => ({
            id: p.sku,
            barcode: p.barcode,
            sku: p.sku,
            category: p.masterClass?.category?.name || 'Uncategorized',
            name: p.name,
            price: p.sellingPrice,
            discount: p.discount || 0,
            image: getFallbackImage(p.masterClass?.category?.name, p.name, p.sku, p.imageUrl),
            currentStock: p.currentStock
          }));
          setProducts(mapped);
        }

        if (historyRes.success) {
          setCompletedOrders(historyRes.data);
          if (historyRes.data.length > 0) {
            setSelectedOrder(historyRes.data[0]);
          }
        }

        if (draftsRes.success) {
          setDraftBills(draftsRes.data);
        }

        setShowInvoiceModal(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to complete transaction.');
    }
  };

  // Check for combo suggestions reactively
  useEffect(() => {
    if (cart.length === 0) return;

    const individualItems = cart.filter(item => !item.isCombo);

    for (const d of discounts) {
      if (d.type !== 'COMBO' || !d.comboItems || d.comboItems.length === 0) continue;
      if (declinedCombos.includes(d.id)) continue;

      const comboSatisfied = d.comboItems.every((ci: any) => {
        const cartItem = individualItems.find(item => item.sku === ci.productId || item.id === ci.productId);
        return cartItem && cartItem.quantity >= ci.minQty;
      });

      if (comboSatisfied) {
        setSuggestedCombo(d);
        setShowComboSuggestionModal(true);
        break; // suggest one at a time
      }
    }
  }, [cart, discounts, declinedCombos]);

  // Calculate total before any discounts
  const grossTotal = useMemo(() => {
    return cartWithDiscounts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cartWithDiscounts]);

  // Calculates subtotal summing up item totals after item discounts are applied (if active)
  const itemsSubtotal = useMemo(() => {
    return cartWithDiscounts.reduce((sum, item) => {
      const itemDisc = (discountType === 'bill') ? 0 : (item.discount || 0);
      const itemTotal = (item.price * item.quantity) * (1 - itemDisc / 100);
      return sum + itemTotal;
    }, 0);
  }, [cartWithDiscounts, discountType]);

  // Auto-calculate threshold overall bill discount
  const autoBillDiscount = useMemo(() => {
    let bestPct = 0;
    let bestId = null;
    let bestName = '';

    discounts.forEach(d => {
      if (d.type === 'BILL' && d.minBillAmount) {
        if (itemsSubtotal >= d.minBillAmount) {
          if (d.discountValue > bestPct) {
            bestPct = d.discountValue;
            bestId = d.id;
            bestName = d.name;
          }
        }
      }
    });

    return { percentage: bestPct, id: bestId, name: bestName };
  }, [discounts, itemsSubtotal]);

  // Overall bill discount percentage applied (manual input overrides auto threshold discount)
  const appliedBillDiscountPercentage = useMemo(() => {
    return manualDiscount > 0 ? manualDiscount : autoBillDiscount.percentage;
  }, [manualDiscount, autoBillDiscount]);

  const billDiscountAmount = useMemo(() => {
    if (discountType === 'bill' || discountType === 'both') {
      return (itemsSubtotal * appliedBillDiscountPercentage) / 100;
    }
    return 0;
  }, [itemsSubtotal, appliedBillDiscountPercentage, discountType]);

  const total = useMemo(() => {
    return itemsSubtotal - billDiscountAmount;
  }, [itemsSubtotal, billDiscountAmount]);

  const totalSavedAmount = useMemo(() => {
    return grossTotal - total;
  }, [grossTotal, total]);

  const isOverallDiscountActive = discountType === 'bill' || discountType === 'both';


  const handlePrint = (order: any, paidVal?: number, changeVal?: number) => {
    if (!order) return;
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) {
      toast.error('Failed to open print window. Please allow popups.');
      return;
    }

    const returnedQtyMap: Record<string, number> = {};
    order.refunds?.forEach((r: any) => {
      r.refundItems?.forEach((ri: any) => {
        returnedQtyMap[ri.sku] = (returnedQtyMap[ri.sku] || 0) + ri.qty;
      });
    });
    
    const itemsHtml = order.billItems?.map((item: any) => {
      const itemTotal = item.qty * item.unitPrice;
      const itemDiscount = itemTotal - item.total;
      const returnedQty = returnedQtyMap[item.sku] || 0;
      const netQty = item.qty - returnedQty;

      let returnLabel = '';
      if (returnedQty > 0) {
        returnLabel = `<div style="font-size: 9px; color: #b45309; font-style: italic; padding-left: 10px;">* Returned: ${returnedQty} unit(s)</div>`;
      }

      return `
        <tr style="font-size: 11px; font-family: monospace;">
          <td style="padding: 4px 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${item.product?.name || item.sku}
            ${returnLabel}
          </td>
          <td align="right" style="padding: 4px 0;">${returnedQty > 0 ? `${netQty} (${item.qty})` : item.qty}</td>
          <td align="right" style="padding: 4px 0;">Rs. ${item.unitPrice.toFixed(2)}</td>
          <td align="right" style="padding: 4px 0;">Rs. ${itemDiscount.toFixed(2)}</td>
          <td align="right" style="padding: 4px 0;">Rs. ${item.total.toFixed(2)}</td>
        </tr>
      `;
    }).join('') || '';

    const paidAmount = paidVal !== undefined ? paidVal : (order.paidAmount !== null && order.paidAmount !== undefined ? order.paidAmount : order.totalBill);
    const changeAmount = changeVal !== undefined ? changeVal : (order.changeAmount !== null && order.changeAmount !== undefined ? order.changeAmount : 0);

    let refundedBanner = '';
    if (order.refunds && order.refunds.length > 0) {
      refundedBanner = `
        <div style="text-align: center; margin-top: 10px; margin-bottom: 10px; background-color: #fef3c7; color: #78350f; border: 1px dashed #fcd34d; padding: 6px; border-radius: 4px; font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase;">
          *** REFUNDED ***
          ${order.refunds.map((r: any) => `
            <div style="font-size: 9px; font-weight: normal; text-transform: none; margin-top: 2px;">
              Rs. ${r.refundAmount.toFixed(2)} returned
            </div>
          `).join('')}
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Receipt - ${order.billNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; line-height: 1.4; color: black; }
            .text-center { text-align: center; }
            .border-t { border-top: 1px dashed black; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .mb-5 { margin-bottom: 20px; }
            .font-bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
            th { border-bottom: 1px dashed black; padding-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="text-center mb-5">
            <div class="font-bold" style="font-size: 15px;">Sales Receipt</div>
            <div class="font-bold" style="font-size: 16px; margin-top: 2px;">CHAMSON MULTI SHOP</div>
            <div style="margin-top: 2px;">Hospital road, Mannar</div>
            <div>0774847867</div>
          </div>
          <div style="font-size: 11px; margin-bottom: 8px;">
            <div>Receipt #: ${order.billNumber}</div>
            <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
            <div>Cashier: ${order.cashier?.name || 'POS System'}</div>
          </div>
          ${refundedBanner}
          <div class="border-t my-2"></div>
          <table>
            <thead>
              <tr style="font-size: 11px; font-weight: bold;">
                <th align="left">Item</th>
                <th align="right">Qty</th>
                <th align="right">Price</th>
                <th align="right">Disc</th>
                <th align="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="border-t my-2"></div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
            <span>Subtotal:</span>
            <span>Rs. ${order.subtotal.toFixed(2)}</span>
          </div>
          ${order.totalDiscount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
            <span>Discount:</span>
            <span>-Rs. ${order.totalDiscount.toFixed(2)}</span>
          </div>` : ''}
          <div class="border-t my-2"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; padding: 4px 0;">
            <span>Total:</span>
            <span>Rs. ${order.totalBill.toFixed(2)}</span>
          </div>
          <div class="border-t my-2"></div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
            <span>Paid Amount:</span>
            <span>Rs. ${paidAmount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
            <span>Change:</span>
            <span>Rs. ${changeAmount.toFixed(2)}</span>
          </div>
          <div class="text-center" style="margin-top: 30px; font-size: 11px; font-weight: bold;">
            Thank You Come Again!
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintRefund = (refund: any) => {
    if (!refund) return;
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) {
      toast.error('Failed to open print window. Please allow popups.');
      return;
    }
    
    const itemsHtml = refund.refundItems?.map((item: any) => {
      const itemTotal = item.qty * item.refundValue;
      return `
        <tr style="font-size: 11px; font-family: monospace;">
          <td style="padding: 4px 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.product?.name || item.sku}</td>
          <td align="right" style="padding: 4px 0;">${item.qty.toFixed(0)}</td>
          <td align="right" style="padding: 4px 0;">Rs. ${item.refundValue.toFixed(2)}</td>
          <td align="right" style="padding: 4px 0;">Rs. ${itemTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('') || '';

    const cashierName = authContext?.user?.name || 'POS Cashier';

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Refund Receipt - ${refund.refundNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; line-height: 1.4; color: black; }
            .text-center { text-align: center; }
            .border-t { border-top: 1px dashed black; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .mb-5 { margin-bottom: 20px; }
            .font-bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
            th { border-bottom: 1px dashed black; padding-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="text-center mb-5">
            <div class="font-bold" style="font-size: 15px;">REFUND RECEIPT</div>
            <div class="font-bold" style="font-size: 16px; margin-top: 2px;">CHAMSON MULTI SHOP</div>
            <div style="margin-top: 2px;">Hospital road, Mannar</div>
            <div>0774847867</div>
          </div>
          <div style="font-size: 11px; margin-bottom: 8px;">
            <div>Refund #: ${refund.refundNumber}</div>
            <div>Ref Bill #: ${selectedOrder?.billNumber || ''}</div>
            <div>Date: ${new Date(refund.createdAt).toLocaleString()}</div>
            <div>Cashier: ${cashierName}</div>
          </div>
          <div class="border-t my-2"></div>
          <table>
            <thead>
              <tr style="font-size: 11px; font-weight: bold;">
                <th align="left">Returned Item</th>
                <th align="right">Qty</th>
                <th align="right">Refund Val</th>
                <th align="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="border-t my-2"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; padding: 4px 0;">
            <span>Total Refunded:</span>
            <span>Rs. ${refund.refundAmount.toFixed(2)}</span>
          </div>
          <div class="border-t my-2"></div>
          <div class="text-center" style="margin-top: 30px; font-size: 11px; font-weight: bold;">
            Refund Processed Successfully
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = (order: any, paidVal?: number, changeVal?: number) => {
    if (!order) return;
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '12px';
    element.style.color = 'black';
    element.style.width = '340px';

    const returnedQtyMap: Record<string, number> = {};
    order.refunds?.forEach((r: any) => {
      r.refundItems?.forEach((ri: any) => {
        returnedQtyMap[ri.sku] = (returnedQtyMap[ri.sku] || 0) + ri.qty;
      });
    });

    const itemsHtml = order.billItems?.map((item: any) => {
      const itemTotal = item.qty * item.unitPrice;
      const itemDiscount = itemTotal - item.total;
      const returnedQty = returnedQtyMap[item.sku] || 0;
      const netQty = item.qty - returnedQty;

      return `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
          <span style="flex: 1; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.product?.name || item.sku}</span>
          <span style="width: 30px; text-align: right;">${returnedQty > 0 ? `${netQty} (${item.qty})` : item.qty}</span>
          <span style="width: 60px; text-align: right;">Rs. ${item.unitPrice.toFixed(2)}</span>
          <span style="width: 50px; text-align: right;">Rs. ${itemDiscount.toFixed(2)}</span>
          <span style="width: 60px; text-align: right;">Rs. ${item.total.toFixed(2)}</span>
        </div>
        ${returnedQty > 0 ? `<div style="font-size: 9px; color: #b45309; font-style: italic; padding-left: 10px; margin-bottom: 4px;">* Returned: ${returnedQty} unit(s)</div>` : ''}
      `;
    }).join('');

    let refundedBanner = '';
    if (order.refunds && order.refunds.length > 0) {
      refundedBanner = `
        <div style="text-align: center; margin-top: 10px; margin-bottom: 10px; background-color: #fef3c7; color: #78350f; border: 1px dashed #fcd34d; padding: 6px; border-radius: 4px; font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase;">
          *** REFUNDED ***
          ${order.refunds.map((r: any) => `
            <div style="font-size: 9px; font-weight: normal; text-transform: none; margin-top: 2px;">
              Rs. ${r.refundAmount.toFixed(2)} returned
            </div>
          `).join('')}
        </div>
      `;
    }

    element.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-weight: bold; font-size: 15px;">Sales Receipt</div>
        <div style="font-weight: bold; font-size: 16px; margin-top: 2px;">CHAMSON MULTI SHOP</div>
        <div style="margin-top: 2px;">Hospital road, Mannar</div>
        <div>0774847867</div>
      </div>
      <div style="font-size: 11px; margin-bottom: 8px;">
        <div>Receipt #: ${order.billNumber}</div>
        <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
        <div>Cashier: ${order.cashier?.name || 'POS System'}</div>
      </div>
      ${refundedBanner}
      <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
        <span style="flex: 1;">Item</span>
        <span style="width: 30px; text-align: right;">Qty</span>
        <span style="width: 60px; text-align: right;">Price</span>
        <span style="width: 50px; text-align: right;">Disc</span>
        <span style="width: 60px; text-align: right;">Total</span>
      </div>
      ${itemsHtml}
      <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
        <span>Subtotal:</span>
        <span>Rs. ${order.subtotal.toFixed(2)}</span>
      </div>
      ${order.totalDiscount > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
        <span>Discount:</span>
        <span>-Rs. ${order.totalDiscount.toFixed(2)}</span>
      </div>` : ''}
      <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; padding: 4px 0;">
        <span>Total:</span>
        <span>Rs. ${order.totalBill.toFixed(2)}</span>
      </div>
      <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
        <span>Paid Amount:</span>
        <span>Rs. ${(paidVal !== undefined ? paidVal : (order.paidAmount !== null && order.paidAmount !== undefined ? order.paidAmount : order.totalBill)).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
        <span>Change:</span>
        <span>Rs. ${(changeVal !== undefined ? changeVal : (order.changeAmount !== null && order.changeAmount !== undefined ? order.changeAmount : 0)).toFixed(2)}</span>
      </div>
      <div style="text-align: center; margin-top: 30px; font-size: 11px; font-weight: bold;">
        Thank You Come Again!
      </div>
    `;

    // @ts-ignore
    if (window.html2pdf) {
      // @ts-ignore
      window.html2pdf()
        .from(element)
        .set({
          margin: 10,
          filename: `receipt-${order.billNumber}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
        })
        .save();
    } else {
      toast.error('PDF library is loading, please try again in a moment.');
    }
  };

  const handleDownloadRefundPDF = (refund: any) => {
    if (!refund) return;
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '12px';
    element.style.color = 'black';
    element.style.width = '340px';

    const itemsHtml = refund.refundItems?.map((item: any) => {
      const itemTotal = item.qty * item.refundValue;
      return `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
          <span style="flex: 1; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.product?.name || item.sku}</span>
          <span style="width: 30px; text-align: right;">${item.qty.toFixed(0)}</span>
          <span style="width: 80px; text-align: right;">Rs. ${item.refundValue.toFixed(2)}</span>
          <span style="width: 80px; text-align: right;">Rs. ${itemTotal.toFixed(2)}</span>
        </div>
      `;
    }).join('');

    const cashierName = authContext?.user?.name || 'POS Cashier';

    element.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-weight: bold; font-size: 15px;">REFUND RECEIPT</div>
        <div style="font-weight: bold; font-size: 16px; margin-top: 2px;">CHAMSON MULTI SHOP</div>
        <div style="margin-top: 2px;">Hospital road, Mannar</div>
        <div>0774847867</div>
      </div>
      <div style="font-size: 11px; margin-bottom: 8px;">
        <div>Refund #: ${refund.refundNumber}</div>
        <div>Ref Bill #: ${selectedOrder?.billNumber || ''}</div>
        <div>Date: ${new Date(refund.createdAt).toLocaleString()}</div>
        <div>Cashier: ${cashierName}</div>
      </div>
      <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
        <span style="flex: 1;">Returned Item</span>
        <span style="width: 30px; text-align: right;">Qty</span>
        <span style="width: 80px; text-align: right;">Refund Val</span>
        <span style="width: 80px; text-align: right;">Total</span>
      </div>
      ${itemsHtml}
      <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; padding: 4px 0;">
        <span>Total Refunded:</span>
        <span>Rs. ${refund.refundAmount.toFixed(2)}</span>
      </div>
      <div style="text-align: center; margin-top: 30px; font-size: 11px; font-weight: bold;">
        Refund Processed Successfully
      </div>
    `;

    // @ts-ignore
    if (window.html2pdf) {
      // @ts-ignore
      window.html2pdf()
        .from(element)
        .set({
          margin: 10,
          filename: `refund-${refund.refundNumber}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
        })
        .save();
    } else {
      toast.error('PDF library is loading, please try again in a moment.');
    }
  };

  const handleConfirmRefund = async () => {
    if (!selectedOrder) return;
    
    const returnedQtyMap: Record<string, number> = {};
    selectedOrder.refunds?.forEach((r: any) => {
      r.refundItems?.forEach((ri: any) => {
        returnedQtyMap[ri.sku] = (returnedQtyMap[ri.sku] || 0) + ri.qty;
      });
    });

    try {
      const itemsToRefund = selectedOrder.billItems.map((item: any) => {
        const qty = refundQuantities[item.sku] || 0;
        if (qty <= 0) return null;

        const alreadyRefunded = returnedQtyMap[item.sku] || 0;
        const maxRefundable = item.qty - alreadyRefunded;
        if (qty > maxRefundable) {
          throw new Error(`Refund quantity for ${item.product?.name || item.sku} exceeds refundable limit.`);
        }

        const refundValue = item.total / item.qty;
        
        return {
          sku: item.sku,
          qty,
          refundValue
        };
      }).filter(Boolean);

      if (itemsToRefund.length === 0) {
        toast.error('Please specify quantities for items to refund.');
        return;
      }

      const payload = {
        originalBillId: selectedOrder.id,
        refundItems: itemsToRefund
      };

      const res = await RefundService.createRefund(payload);
      if (res.success) {
        toast.success('Refund processed successfully!');
        setShowRefundModal(false);
        setRefundQuantities({});
        
        setActiveRefundReceipt(res.data);
        setShowRefundInvoiceModal(true);
        
        await loadAllData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || err.response?.data?.message || 'Failed to process refund.');
    }
  };

  // --- RENDER HELPERS ---
  const renderSidebar = () => (
    <div className="w-[240px] bg-[#f8f9fc] border-r border-gray-200 flex flex-col h-screen">
      <div className="p-6">
        <h1 className="text-xl font-extrabold text-[#111827]">StockSense POS</h1>
        <p className="text-sm text-gray-500 mt-1">Station 01</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <button
          onClick={() => setActiveTab('bill')}
          className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-semibold ${activeTab === 'bill' ? 'bg-[#dcfce7] text-[#166534]' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <TerminalSquare className="w-5 h-5 mr-3" />
          Bill
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-semibold ${activeTab === 'products' ? 'bg-[#dcfce7] text-[#166534]' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <ShoppingCart className="w-5 h-5 mr-3" />
          Products
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-semibold ${activeTab === 'discounts' ? 'bg-[#dcfce7] text-[#166534]' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <Banknote className="w-5 h-5 mr-3" />
          Discounts
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-semibold ${activeTab === 'orders' ? 'bg-[#dcfce7] text-[#166534]' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <Receipt className="w-5 h-5 mr-3" />
          Orders
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-semibold relative ${activeTab === 'drafts' ? 'bg-[#dcfce7] text-[#166534]' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <FileText className="w-5 h-5 mr-3" />
          Draft Bills
          {draftBills.length > 0 && (
            <span className="absolute right-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {draftBills.length}
            </span>
          )}
        </button>
      </nav>

      <div className="p-4 border-t border-gray-200 mt-auto">
        {activeTab === 'orders' && (
          <button
            onClick={() => setActiveTab('bill')}
            className="w-full bg-[#166534] hover:bg-[#14532d] text-white py-3 rounded-xl flex items-center justify-center font-semibold transition-colors shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-2"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Sale
          </button>
        )}
        <div className="flex items-center gap-3 px-2 py-3 mb-4 border-b border-gray-200 pb-6">
          <div className="w-10 h-10 rounded-full bg-[#047857] text-white flex items-center justify-center font-bold text-sm shrink-0">
            {authContext?.user?.name
              ? authContext.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
              : 'AM'}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-[15px] font-bold text-gray-900 leading-tight truncate">
              {authContext?.user?.name || 'Alex Mercer'}
            </h4>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Staff #{authContext?.user?.id ? authContext.user.id.substring(0, 4).toUpperCase() : '4209'}
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            if (authContext?.logout) {
              await authContext.logout();
            } else {
              localStorage.removeItem('stocksense_logged_in');
            }
            navigate('/');
          }}
          className="w-full flex items-center px-2 py-2 text-gray-600 hover:text-gray-900 transition-colors font-semibold"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );

  const addComboToCart = (discount: any) => {
    discount.comboItems.forEach((ci: any) => {
      const prod = products.find(p => p.sku === ci.productId || p.id === ci.productId);
      if (prod) {
        setCart(prev => {
          const existing = prev.find(item => item.id === prod.id);
          if (existing) {
            if (existing.quantity < ci.minQty) {
              return prev.map(item => item.id === prod.id ? { ...item, quantity: ci.minQty } : item);
            }
            return prev;
          }
          return [...prev, { ...prod, quantity: ci.minQty, discount: 0 }];
        });
      }
    });
    toast.success(`Combo "${discount.name}" added to cart!`);
  };

  const addDiscountProductsToCart = (discount: any) => {
    if (discount.productIds && discount.productIds.length > 0) {
      discount.productIds.forEach((sku: string) => {
        const prod = products.find(p => p.sku === sku || p.id === sku);
        if (prod) {
          // Pass the discount % and ID directly so it's immediately visible in cart
          addToCart(prod, 1, discount.discountValue, discount.id);
        }
      });
      toast.success(`Products for "${discount.name}" added to cart with ${discount.discountValue}% discount!`);
    }
  };

  const renderInvoiceModal = () => {
    if (!showInvoiceModal || !activeReceipt) return null;

    const paid = parseFloat(customerPaidInput) || activeReceipt.totalBill;
    const change = Math.max(0, paid - activeReceipt.totalBill);
    const dateStr = new Date(activeReceipt.createdAt).toLocaleString();

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-8 overflow-y-auto bg-white flex-1 flex justify-center">
            {/* Text-based Receipt Style */}
            <div className="font-mono text-[13px] text-black w-full max-w-[320px] mx-auto flex flex-col leading-snug">
              <div className="text-center mb-5 space-y-0.5">
                <div className="font-bold text-base">Sales Receipt</div>
                <div className="font-bold text-base">CHAMSON MULTI SHOP</div>
                <div>Hospital road, Mannar</div>
                <div>0774847867</div>
              </div>

              <div className="mb-2 space-y-0.5">
                <div>Receipt #: {activeReceipt.billNumber}</div>
                <div>Date: {dateStr}</div>
                <div>Cashier: {activeReceipt.cashier?.name || 'POS System'}</div>
              </div>

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex font-bold pb-1 text-[11px]">
                <div className="flex-1">Item</div>
                <div className="w-8 text-right">Qty</div>
                <div className="w-12 text-right">Price</div>
                <div className="w-12 text-right">Disc.</div>
                <div className="w-12 text-right">Total</div>
              </div>

              {activeReceipt.billItems?.map((item: any) => {
                const itemTotal = item.qty * item.unitPrice;
                const itemDiscount = itemTotal - item.total;
                return (
                  <div key={item.id} className="flex pb-1 text-[11px]">
                    <div className="flex-1 truncate pr-1">{item.product?.name || item.sku}</div>
                    <div className="w-8 text-right">{item.qty.toFixed(2)}</div>
                    <div className="w-12 text-right">Rs. {item.unitPrice.toFixed(2)}</div>
                    <div className="w-12 text-right">Rs. {itemDiscount.toFixed(2)}</div>
                    <div className="w-12 text-right">Rs. {item.total.toFixed(2)}</div>
                  </div>
                );
              })}

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {activeReceipt.subtotal.toFixed(2)}</span>
              </div>
              {activeReceipt.totalDiscount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-Rs. {activeReceipt.totalDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>Rs. {activeReceipt.totalBill.toFixed(2)}</span>
              </div>

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between">
                <span>Paid Amount:</span>
                <span>Rs. {paid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span>Rs. {change.toFixed(2)}</span>
              </div>

              <div className="text-center mt-6">
                Thank You Come Again!
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
            <button 
              onClick={() => handlePrint(activeReceipt, paid, change)}
              className="flex-1 py-2.5 bg-[#2563eb] text-white rounded font-bold hover:bg-blue-700 transition-colors text-sm"
            >
              Print
            </button>
            <button 
              onClick={() => handleDownloadPDF(activeReceipt, paid, change)}
              className="flex-1 py-2.5 bg-[#16a34a] text-white rounded font-bold hover:bg-green-700 transition-colors text-sm"
            >
              Download
            </button>
            <button
              onClick={() => {
                setShowInvoiceModal(false);
                setActiveReceipt(null);
                setCustomerPaidInput('');
              }}
              className="flex-1 py-2.5 bg-[#4b5563] text-white rounded font-bold hover:bg-gray-700 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderComboSuggestionModal = () => {
    if (!showComboSuggestionModal || !suggestedCombo) return null;

    const originalTotal = suggestedCombo.comboItems.reduce((sum: number, ci: any) => {
      const prod = products.find(p => p.sku === ci.productId || p.id === ci.productId);
      return sum + (prod ? prod.price * ci.minQty : 0);
    }, 0);
    const finalTotal = originalTotal * (1 - suggestedCombo.discountValue / 100);

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-emerald-600 animate-bounce" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Combo Deal Available! 🎉</h3>
            <p className="text-sm text-gray-500 font-medium">
              We noticed you have the items for the <span className="font-bold text-gray-800">"{suggestedCombo.name}"</span> bundle.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Bundle Products:</p>
            <div className="space-y-2 mb-4">
              {suggestedCombo.comboItems.map((ci: any, idx: number) => {
                const prod = products.find(p => p.sku === ci.productId || p.id === ci.productId);
                return (
                  <div key={idx} className="flex justify-between text-sm font-bold text-gray-700">
                    <span className="truncate pr-2">• {prod ? prod.name : ci.productId}</span>
                    <span className="text-emerald-700">Qty: {ci.minQty}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200/60 pt-3 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500">Combo Bundle Price:</span>
              <div className="text-right">
                <span className="text-gray-900 font-extrabold text-base block">Rs. {finalTotal.toFixed(2)}</span>
                <span className="text-gray-400 line-through text-xs font-medium">Rs. {originalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => declineSuggestedCombo(suggestedCombo.id)}
              className="flex-1 py-3.5 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              Keep Individual
            </button>
            <button
              onClick={() => applySuggestedCombo(suggestedCombo)}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors text-sm shadow-md"
            >
              Group Combo Pack
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBarcodeModal = () => {
    if (!showBarcodeModal) return null;
      return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <ScanLine className="w-6 h-6 mr-2 text-[#1d4ed8]" /> Scan Barcode
            </h2>
            <button onClick={() => setShowBarcodeModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <LogOut className="w-5 h-5 rotate-180" />
            </button>
          </div>
          <div className="p-8 bg-gray-50 flex flex-col items-center">
            <div className="relative w-64 h-64 bg-black rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
              {/* Simulated Camera View */}
              <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=400&auto=format&fit=crop')] bg-cover bg-center mix-blend-luminosity"></div>
              {/* Scanner Frame */}
              <div className="absolute w-48 h-48 border-2 border-white/40 rounded-lg box-border"></div>
              {/* Scanning Line Animation */}
              <style>{`
                  @keyframes scanLine {
                    0% { top: 10%; }
                    50% { top: 90%; }
                    100% { top: 10%; }
                  }
                `}</style>
              <div
                className="absolute w-48 h-[2px] bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.5)]"
                style={{ animation: 'scanLine 2s linear infinite' }}
              ></div>
            </div>
            <p className="mt-6 text-sm font-medium text-gray-600">Place the product barcode inside the frame</p>
          </div>
          <div className="p-4 bg-white border-t border-gray-100">
            <button onClick={() => setShowBarcodeModal(false)} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
      );
  };

  const renderAddProductModal = () => {
    if (!showAddProductModal || !scannedProduct) return null;
      return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
          <div className="relative h-64 bg-gray-50 border-b border-gray-100">
            <img src={scannedProduct.image} alt={scannedProduct.name} className="w-full h-full object-cover" />
            <button
              onClick={() => {
                setShowAddProductModal(false);
                setScannedProduct(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-white/80 hover:bg-white backdrop-blur-md rounded-full flex items-center justify-center text-gray-600 transition-colors shadow-sm"
            >
              &times;
            </button>
          </div>
          <div className="p-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-[#dcfce7] text-[#166534] text-xs font-bold rounded-full">IN STOCK</span>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{scannedProduct.name}</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Barcode: {scannedProduct.barcode}</p>

            <div className="flex items-center justify-between mb-8">
              <span className="text-[#047857] font-extrabold text-3xl">Rs. {scannedProduct.price.toFixed(2)}</span>

              <div className="flex items-center bg-[#f0f4f8] rounded-xl p-1">
                <button onClick={() => setScannedProductQty(Math.max(1, scannedProductQty - 1))} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-gray-900 transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-base font-bold text-gray-800">{scannedProductQty}</span>
                <button onClick={() => setScannedProductQty(scannedProductQty + 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-gray-900 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  setScannedProduct(null);
                }}
                className="px-6 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  addToCart(scannedProduct, scannedProductQty);
                  setShowAddProductModal(false);
                  setScannedProduct(null);
                  setScannedProductQty(1);
                }}
                className="flex-1 bg-[#047857] hover:bg-[#065f46] text-white py-4 rounded-xl font-bold text-lg transition-colors shadow-sm flex items-center justify-center"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
      );
  };

  const renderRefundModal = () => {
    if (!showRefundModal || !selectedOrder) return null;

    // Group returned quantities by SKU
    const returnedQtyMap: Record<string, number> = {};
    selectedOrder.refunds?.forEach((r: any) => {
      r.refundItems?.forEach((ri: any) => {
        returnedQtyMap[ri.sku] = (returnedQtyMap[ri.sku] || 0) + ri.qty;
      });
    });

    let totalRefundPreview = 0;
    let totalItemsToRefund = 0;

    selectedOrder.billItems?.forEach((item: any) => {
      const qty = refundQuantities[item.sku] || 0;
      if (qty > 0) {
        const refundValue = item.total / item.qty;
        totalRefundPreview += refundValue * qty;
        totalItemsToRefund += qty;
      }
    });

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">Process Product Refund</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Original Bill: <span className="font-bold text-gray-800">{selectedOrder.billNumber}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setShowRefundModal(false);
                setRefundQuantities({});
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-bold leading-none p-1"
            >
              &times;
            </button>
          </div>

          {/* Item List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {selectedOrder.billItems?.map((item: any) => {
              const refundQty = refundQuantities[item.sku] || 0;
              const refundValue = item.total / item.qty;
              const alreadyRefunded = returnedQtyMap[item.sku] || 0;
              const maxRefundable = item.qty - alreadyRefunded;
              return (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-900 truncate">
                      {item.product?.name || item.sku}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">SKU: {item.sku}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold text-gray-600">
                        Paid: Rs. {refundValue.toFixed(2)} / unit
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        (Purchased: {item.qty})
                      </span>
                      {alreadyRefunded > 0 && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                          Already Refunded: {alreadyRefunded}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {maxRefundable <= 0 ? (
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shrink-0">
                      Fully Refunded
                    </span>
                  ) : (
                    /* Quantity Counter */
                    <div className="flex items-center bg-[#f0f4f8] rounded-lg p-1 shrink-0">
                      <button
                        onClick={() => {
                          setRefundQuantities(prev => ({
                            ...prev,
                            [item.sku]: Math.max(0, refundQty - 1)
                          }));
                        }}
                        disabled={refundQty <= 0}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:shadow-sm transition-all ${
                          refundQty <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white'
                        }`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-800">{refundQty}</span>
                      <button
                        onClick={() => {
                          setRefundQuantities(prev => ({
                            ...prev,
                            [item.sku]: Math.min(maxRefundable, refundQty + 1)
                          }));
                        }}
                        disabled={refundQty >= maxRefundable}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:shadow-sm transition-all ${
                          refundQty >= maxRefundable ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary & Footer */}
          <div className="p-6 border-t border-gray-100 bg-white shrink-0 space-y-4">
            <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Total Items to Refund</span>
                <span className="text-sm font-black text-emerald-800 mt-0.5 block">{totalItemsToRefund} unit(s)</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Calculated Refund Total</span>
                <span className="text-lg font-black text-emerald-700 mt-0.5 block">Rs. {totalRefundPreview.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundQuantities({});
                }}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRefund}
                disabled={totalItemsToRefund === 0}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors shadow-md flex items-center justify-center ${
                  totalItemsToRefund > 0
                    ? 'bg-[#111827] hover:bg-black text-white cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRefundInvoiceModal = () => {
    if (!showRefundInvoiceModal || !activeRefundReceipt) return null;

    const dateStr = new Date(activeRefundReceipt.createdAt).toLocaleString();
    const cashierName = authContext?.user?.name || 'POS Cashier';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white rounded shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-8 overflow-y-auto bg-white flex-1 flex justify-center">
            <div className="font-mono text-[13px] text-black w-full max-w-[320px] mx-auto flex flex-col leading-snug">
              <div className="text-center mb-5 space-y-0.5">
                <div className="font-bold text-base">REFUND RECEIPT</div>
                <div className="font-bold text-base">CHAMSON MULTI SHOP</div>
                <div>Hospital road, Mannar</div>
                <div>0774847867</div>
              </div>

              <div className="mb-2 space-y-0.5">
                <div>Refund #: {activeRefundReceipt.refundNumber}</div>
                <div>Ref Bill #: {selectedOrder?.billNumber || ''}</div>
                <div>Date: {dateStr}</div>
                <div>Cashier: {cashierName}</div>
              </div>

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex font-bold pb-1 text-[11px]">
                <div className="flex-1">Returned Item</div>
                <div className="w-8 text-right">Qty</div>
                <div className="w-20 text-right">Refund Val</div>
                <div className="w-20 text-right">Total</div>
              </div>

              {activeRefundReceipt.refundItems?.map((item: any) => {
                const itemTotal = item.qty * item.refundValue;
                return (
                  <div key={item.id} className="flex pb-1 text-[11px]">
                    <div className="flex-1 truncate pr-1">{item.product?.name || item.sku}</div>
                    <div className="w-8 text-right">{item.qty.toFixed(0)}</div>
                    <div className="w-20 text-right">Rs. {item.refundValue.toFixed(2)}</div>
                    <div className="w-20 text-right">Rs. {itemTotal.toFixed(2)}</div>
                  </div>
                );
              })}

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between font-bold">
                <span>Total Refunded:</span>
                <span>Rs. {activeRefundReceipt.refundAmount.toFixed(2)}</span>
              </div>

              <div className="text-center mt-6">
                Refund Processed Successfully
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
            <button 
              onClick={() => handlePrintRefund(activeRefundReceipt)}
              className="flex-1 py-2.5 bg-[#2563eb] text-white rounded font-bold hover:bg-blue-700 transition-colors text-sm"
            >
              Print
            </button>
            <button 
              onClick={() => handleDownloadRefundPDF(activeRefundReceipt)}
              className="flex-1 py-2.5 bg-[#16a34a] text-white rounded font-bold hover:bg-green-700 transition-colors text-sm"
            >
              Download
            </button>
            <button
              onClick={() => {
                setShowRefundInvoiceModal(false);
                setActiveRefundReceipt(null);
              }}
              className="flex-1 py-2.5 bg-[#4b5563] text-white rounded font-bold hover:bg-gray-700 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

      return (
      <div className="flex h-screen w-full bg-white font-sans overflow-hidden">
        {renderSidebar()}
                {activeTab === 'bill' && (
          <BillTab 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchMatches={searchMatches}
            setSearchMatches={setSearchMatches}
            searchMatchQuantities={searchMatchQuantities}
            setSearchMatchQuantities={setSearchMatchQuantities}
            products={products}
            addToCart={addToCart}
            setShowBarcodeModal={setShowBarcodeModal}
            scannedProduct={scannedProduct}
            setScannedProduct={setScannedProduct}
            scannedProductQty={scannedProductQty}
            setScannedProductQty={setScannedProductQty}
            cart={cart}
            setCart={setCart}
            cartWithDiscounts={cartWithDiscounts}
            passBillToDraft={passBillToDraft}
            discountType={discountType}
            setDiscountType={setDiscountType}
            setManualDiscount={setManualDiscount}
            setDiscountInput={setDiscountInput}
            isOverallDiscountActive={isOverallDiscountActive}
            autoBillDiscount={autoBillDiscount}
            manualDiscount={manualDiscount}
            customerPaidInput={customerPaidInput}
            setCustomerPaidInput={setCustomerPaidInput}
            grossTotal={grossTotal}
            totalSavedAmount={totalSavedAmount}
            total={total}
            handleCompleteTransaction={handleCompleteTransaction}
            updateQuantity={updateQuantity}
            ungroupCombo={ungroupCombo}
          />
        )}
        {activeTab === 'products' && (
          <ProductsTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            loading={loading}
            filteredProducts={filteredProducts}
            addToCart={addToCart}
          />
        )}
        {activeTab === 'discounts' && (
          <DiscountsTab
            discounts={discounts}
            products={products}
            addComboToCart={addComboToCart}
            addDiscountProductsToCart={addDiscountProductsToCart}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab
            completedOrders={completedOrders}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            handlePrint={handlePrint}
            setShowRefundModal={setShowRefundModal}
            setRefundQuantities={setRefundQuantities}
          />
        )}
        {activeTab === 'drafts' && (
          <DraftBillsTab
            draftBills={draftBills}
            restoreDraftBill={restoreDraftBill}
          />
        )}
        {renderInvoiceModal()}
        {renderBarcodeModal()}
        {renderAddProductModal()}
        {renderComboSuggestionModal()}
        {renderRefundModal()}
        {renderRefundInvoiceModal()}
      </div>
      );
}
