import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../Shared/Sidebar';
import InventoryHeader from '../Shared/InventoryHeader';
import { mockStorage as localStorage } from '../Shared/mockStorage';
import { MasterDataService } from '../../../services/masterDataService';
import { toast } from 'sonner';

// Import our modular subcomponents
import ProductsRegistry, { ProductItem } from './ProductManagementComponents/ProductsRegistry';
import CategoryRegistry from './ProductManagementComponents/CategoryRegistry';
import NewProductForm from './ProductManagementComponents/NewProductForm';
import BrandRegistry, { BrandItem } from './ProductManagementComponents/BrandRegistry';
import { SupplierItem } from './ProductManagementComponents/SupplierRegistry';
import DiscountRegistry from './ProductManagementComponents/DiscountRegistry';

export type SubCategoryNode = {
  id: string;
  name: string;
  status: string;
  productsCount?: number;
};

export type CategoryItem = {
  id: string;
  name: string;
  icon: string;
  image: string;
  status: string;
  statusClass: string;
  skus: number;
  health: string;
  children: SubCategoryNode[];
  description?: string;
};

// Initial preloaded mock supermarket categories matching specifications
export const initialCategories: CategoryItem[] = [
  {
    id: 'grocery',
    name: 'Grocery',
    icon: '🛒',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop',
    status: 'In Stock',
    statusClass: 'bg-emerald-600',
    skus: 64,
    health: '92%',
    description: 'Staples, pulses, grains, flour, spices, and dried foods.',
    children: [
      { id: 'rice-flour', name: 'Rice & Flour', status: 'Active' },
      { id: 'spices', name: 'Spices & Condiments', status: 'Active' },
      { id: 'biscuits', name: 'Biscuits & Snacks', status: 'Active' },
    ]
  },
  {
    id: 'dairy',
    name: 'Dairy',
    icon: '🥛',
    image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?q=80&w=600&auto=format&fit=crop',
    status: 'In Stock',
    statusClass: 'bg-emerald-600',
    skus: 14,
    health: '90%',
    description: 'Fresh milk, block cheese, salted butter, and fresh cream.',
    children: [
      { id: 'milk', name: 'Milk Products', status: 'Active' },
      { id: 'cheese', name: 'Cheese Products', status: 'Active' },
      { id: 'yogurt', name: 'Yogurt & Cream', status: 'Active' },
    ]
  },
  {
    id: 'bakery',
    name: 'Bakery',
    icon: '🍞',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop',
    status: 'In Stock',
    statusClass: 'bg-emerald-600',
    skus: 12,
    health: '94%',
    description: 'Freshly baked loaves of bread, chocolate chip cookies, and tea buns.',
    children: [
      { id: 'bread', name: 'Loaf Bread', status: 'Active' },
      { id: 'cookies', name: 'Cookies & Pastries', status: 'Active' },
      { id: 'buns', name: 'Buns & Cakes', status: 'Active' },
    ]
  },
  {
    id: 'frozen',
    name: 'Frozen Foods',
    icon: '❄️',
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=600&auto=format&fit=crop',
    status: 'In Stock',
    statusClass: 'bg-emerald-600',
    skus: 28,
    health: '88%',
    description: 'Frozen ice cream tubs, meat cuts, frozen seafood, and mixed veggies.',
    children: [
      { id: 'ice-cream', name: 'Ice Cream', status: 'Active' },
      { id: 'meat-seafood', name: 'Frozen Meat & Seafood', status: 'Active' },
      { id: 'veg', name: 'Frozen Vegetables', status: 'Active' },
    ]
  },
  {
    id: 'beverages',
    name: 'Beverages',
    icon: '🥤',
    image: 'https://images.unsplash.com/photo-1559553156-2e97137af16f?q=80&w=600&auto=format&fit=crop',
    status: 'In Stock',
    statusClass: 'bg-emerald-600',
    skus: 48,
    health: '95%',
    description: 'Carbonated soda pop, energy drinks, bottled mineral water, and fruit juices.',
    children: [
      { id: 'soft-drinks', name: 'Soft Drinks', status: 'Active' },
      { id: 'fruit-juices', name: 'Juice', status: 'Active' },
      { id: 'water', name: 'Water', status: 'Active' },
    ]
  },
  {
    id: 'household',
    name: 'Household',
    icon: '🧼',
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600&auto=format&fit=crop',
    status: 'In Stock',
    statusClass: 'bg-emerald-600',
    skus: 22,
    health: '91%',
    description: 'Laundry detergents, dish soaps, garbage bins, and cleaning brushes.',
    children: [
      { id: 'detergent', name: 'Detergents & Soaps', status: 'Active' },
      { id: 'utensils', name: 'Cleaning Utensils', status: 'Active' },
      { id: 'paper-goods', name: 'Tissues & Wipes', status: 'Active' },
    ]
  }
];

// Initial preloaded mock supermarket products matching specifications
const initialProducts: ProductItem[] = [
  {
    id: '1',
    name: 'Anchor Milk Powder 400g',
    sku: 'DAI-005',
    barcode: '4790012948577',
    category: 'Dairy',
    subcategory: 'Milk Products',
    supplier: 'FreshFarm Supplies',
    brand: 'Anchor',
    unitType: 'Pack',
    stock: 240,
    reorderLevel: 30,
    costPrice: 450.00,
    sellingPrice: 520.00,
    status: 'Active',
    description: 'Premium milk powder manufactured in New Zealand and packed locally in Sri Lanka.',
    mfgDate: '2026-04-10',
    expiryDate: '2027-04-10',
    lastUpdated: 'May 28, 2026',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: '2',
    name: 'Coca-Cola 1L',
    sku: 'BEV-001',
    barcode: '0038847291101',
    category: 'Beverages',
    subcategory: 'Soft Drinks',
    supplier: 'Ceylon Beverage Distributors',
    brand: 'Coca-Cola',
    unitType: 'Bottle',
    stock: 8, // Low stock since reorderLevel is 15
    reorderLevel: 15,
    costPrice: 120.00,
    sellingPrice: 150.00,
    status: 'Active',
    description: 'Refreshing carbonated soft drink bottle, best served chilled.',
    mfgDate: '2026-05-01',
    expiryDate: '2026-11-01',
    lastUpdated: 'May 28, 2026',
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: '3',
    name: 'Sunlight Soap',
    sku: 'HOU-012',
    barcode: '0099221188334',
    category: 'Household',
    subcategory: 'Detergents & Soaps',
    supplier: 'FreshFarm Supplies',
    brand: 'Sunlight',
    unitType: 'Piece',
    stock: 142,
    reorderLevel: 25,
    costPrice: 85.00,
    sellingPrice: 105.00,
    status: 'Active',
    description: 'Multi-purpose household laundry and dishwashing soap cake.',
    mfgDate: '2026-03-20',
    expiryDate: '2028-03-20',
    lastUpdated: 'May 28, 2026',
    imageUrl: 'https://images.unsplash.com/photo-1607006342411-b01354cc792a?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: '4',
    name: 'Signal Toothpaste',
    sku: 'GRO-009',
    barcode: '0044556677882',
    category: 'Grocery',
    subcategory: 'Spices & Condiments',
    supplier: 'FreshFarm Supplies',
    brand: 'Signal',
    unitType: 'Piece',
    stock: 0, // Out of stock
    reorderLevel: 20,
    costPrice: 140.00,
    sellingPrice: 175.00,
    status: 'Active',
    description: 'Double active fluoride toothpaste for strong cavity protection.',
    mfgDate: '2026-02-12',
    expiryDate: '2028-02-12',
    lastUpdated: 'May 28, 2026',
    imageUrl: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: '5',
    name: 'Munchee Chocolate Biscuit',
    sku: 'GRO-042',
    barcode: '4790012948600',
    category: 'Grocery',
    subcategory: 'Biscuits & Snacks',
    supplier: 'Golden Crust Bakery',
    brand: 'Munchee',
    unitType: 'Pack',
    stock: 90,
    reorderLevel: 15,
    costPrice: 180.00,
    sellingPrice: 210.00,
    status: 'Active',
    description: 'Crispy chocolate biscuits with rich chocolate cream filling.',
    mfgDate: '2026-05-10',
    expiryDate: '2026-11-10',
    lastUpdated: 'May 28, 2026',
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=80&w=200&auto=format&fit=crop'
  }
];

const PRODUCT_STORAGE_KEY = 'stocksense_product_catalog_products';

const formatUpdatedAt = () =>
  new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

const buildSku = (name: string, category: string) => {
  const prefixSource = `${category || name || 'PRD'}`.replace(/[^a-zA-Z]/g, '');
  const prefix = (prefixSource.slice(0, 3) || 'PRD').toUpperCase();
  const suffix = Date.now().toString().slice(-5);
  return `${prefix}-${suffix}`;
};

const normalizeProduct = (product: Partial<ProductItem> & Record<string, any>, fallbackIndex: number): ProductItem => {
  const fallbackName = product.name?.trim() || `Product ${fallbackIndex + 1}`;
  const fallbackCategory = product.category?.trim() || 'Uncategorized';

  return {
    id: String(product.id || `prod_${Date.now()}_${fallbackIndex}`),
    name: fallbackName,
    sku: String(product.sku || buildSku(fallbackName, fallbackCategory)),
    barcode: String(product.barcode || `479${Math.floor(1000000000 + Math.random() * 9000000000)}`),
    category: fallbackCategory,
    subcategory: String(product.subcategory || ''),
    supplier: String(product.supplier || 'Unassigned Supplier'),
    brand: String(product.brand || 'Unbranded'),
    unitType: String(product.unitType || 'Piece'),
    stock: Number(product.stock ?? 0),
    reorderLevel: Number(product.reorderLevel ?? 0),
    targetCapacity: Number(product.targetCapacity ?? (product.reorderLevel ? (product.reorderLevel * 4) : 100)),
    costPrice: Number(product.costPrice ?? 0),
    sellingPrice: Number(product.sellingPrice ?? 0),
    status: ['Active', 'Inactive', 'Disconnected'].includes(product.status as string) ? (product.status as 'Active' | 'Inactive' | 'Disconnected') : 'Active',
    lastUpdated: String(product.lastUpdated || formatUpdatedAt()),
    imageUrl: product.imageUrl || product.frontImageUrl || null,
    description: String(product.description || ''),
    mfgDate: String(product.mfgDate || ''),
    expiryDate: String(product.expiryDate || '')
  };
};

export const loadStoredProducts = (): ProductItem[] => {
  const stored = localStorage.getItem(PRODUCT_STORAGE_KEY);
  if (!stored) {
    return initialProducts;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return initialProducts;
    }

    return parsed.map((product, index) => normalizeProduct(product, index));
  } catch {
    return initialProducts;
  }
};

const mapBackendProductToFrontend = (p: any): ProductItem => {
  const mapStatusValue = (s: string) => {
    if (s === 'ACTIVE') return 'Active';
    if (s === 'INACTIVE') return 'Inactive';
    if (s === 'DISCONTINUED') return 'Disconnected';
    return 'Active';
  };

  return {
    id: p.sku,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category: p.masterClass?.category?.name || 'Uncategorized',
    subcategory: p.masterClass?.subCategory?.name || 'General',
    supplier: p.masterClass?.supplier?.name || 'Unknown',
    brand: p.masterClass?.brand?.name || 'Generic',
    unitType: p.unitType,
    stock: p.currentStock,
    reorderLevel: p.reorderLevel,
    costPrice: p.costPrice,
    sellingPrice: p.sellingPrice,
    status: mapStatusValue(p.status),
    description: `${p.name} - ${p.unitType}`,
    imageUrl: p.imageUrl || '',
    masterId: p.masterId,
    hasVariant: p.masterClass?.hasVariant || false,
    variantAttributeType: p.variantAttributeType,
    targetCapacity: p.targetCapacity,
    mfgDate: p.mfgDate ? p.mfgDate.split('T')[0] : '',
    expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '',
    batchNumber: p.batchNumber || '',
    lastUpdated: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : formatUpdatedAt()
  };
};

export default function ProductManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabRaw = searchParams.get('tab') || 'products';
  const activeTab = activeTabRaw === 'promotions' ? 'discounts' : activeTabRaw;

  // React shared catalog states
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // preloaded brands directory
  const [brands, setBrands] = useState<BrandItem[]>([]);

  // preloaded suppliers directory from localStorage
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);

  const reloadAllData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, brandRes, supRes] = await Promise.all([
        MasterDataService.getProducts(),
        MasterDataService.getCategories(),
        MasterDataService.getBrands(),
        MasterDataService.getSuppliers()
      ]);

      let mappedProducts: ProductItem[] = [];
      if (prodRes.success) {
        mappedProducts = prodRes.data.map(mapBackendProductToFrontend);
        setProducts(mappedProducts);
      }

      if (catRes.success) {
        const getIcon = (name: string) => {
          const lower = name.toLowerCase();
          if (lower.includes('grocery')) return '🛒';
          if (lower.includes('dairy')) return '🥛';
          if (lower.includes('bakery')) return '🍞';
          if (lower.includes('frozen')) return '🧊';
          if (lower.includes('beverage')) return '🥤';
          if (lower.includes('household')) return '🧹';
          if (lower.includes('personal')) return '🧴';
          if (lower.includes('snacks')) return '🍪';
          if (lower.includes('meat')) return '🥩';
          if (lower.includes('produce')) return '🥬';
          return '📦';
        };
        const mappedCats = catRes.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: getIcon(c.name),
          image: c.categoryImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop',
          status: c.isActive ? 'Active' : 'Inactive',
          statusClass: c.isActive ? 'bg-emerald-600' : 'bg-slate-500',
          skus: mappedProducts.filter((p) => p.category === c.name).length,
          health: '100%',
          description: c.description || `All ${c.name} products`,
          children: (c.subCategories || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            status: sub.isActive ? 'Active' : 'Inactive'
          }))
        }));
        setCategories(mappedCats);
      }

      if (brandRes.success) {
        const brandImages = [
          'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?q=80&w=200&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1563694983011-6f4d90358083?q=80&w=200&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=200&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1607006342411-b01354cc792a?q=80&w=200&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=200&auto=format&fit=crop'
        ];
        setBrands(brandRes.data.map((b: any, i: number) => ({
          id: b.id,
          name: b.name,
          description: b.description || '',
          status: b.state === 'ACTIVE' ? 'Active' : 'Inactive',
          imageUrl: brandImages[i % brandImages.length]
        })));
      }

      if (supRes.success) {
        setSuppliers(supRes.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          email: s.email || '',
          address: s.address || '',
          status: 'Active'
        })));
      }

    } catch (err) {
      console.error('Failed to fetch master data', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Master Data
  useEffect(() => {
    reloadAllData();
  }, []);

  // Filter redirection state
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || 'All Categories';
  const initialBrand = searchParams.get('brand') || '';

  // Edit target state
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);

  // Confirm modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (title: string, message: React.ReactNode, onConfirm: () => void) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(null);
      }
    });
  };

  // Toast notification - using sonner globally

  useEffect(() => {
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  // Handle URL redirects for Quick Create "Add Product"
  useEffect(() => {
    if (activeTab === 'new-product') {
      setEditingProduct(null);
      setIsNewProductModalOpen(true);
      setSearchParams({ tab: 'products' }, { replace: true });
    }
  }, [activeTab, setSearchParams]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.info(message);
    }
  };

  // Dynamic lists derived for dropdown selectors
  const categoryNamesList = useMemo(() => categories.map((cat) => cat.name), [categories]);
  const supplierNamesList = useMemo(() => suppliers.map((sup) => sup.name), [suppliers]);

  // View tabs toggles
  const handleTabChange = (tabName: string) => {
    if (tabName !== 'new-product') {
      setEditingProduct(null);
    }
    setSearchParams({ tab: tabName });
  };

  // Add category handler
  const handleAddCategoryNode = async (newCat: { name: string; description: string; hierarchy: 'parent' | 'sub'; parentId: string; image?: string | null }) => {
    try {
      if (newCat.hierarchy === 'parent') {
        await MasterDataService.createCategory({
          name: newCat.name,
          description: newCat.description,
          categoryImageUrl: newCat.image || null
        });
        showToast(`Category "${newCat.name}" added successfully.`);
      } else {
        await MasterDataService.createSubCategory({
          name: newCat.name,
          description: newCat.description || '',
          categoryId: newCat.parentId
        });
        showToast(`Subcategory "${newCat.name}" added under parent successfully.`);
      }
      await reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to add category node.', 'info');
    }
  };

  // Toggle Category Status (Archive/Restore)
  const handleToggleCategoryStatus = async (id: string, targetStatus: 'Active' | 'Inactive') => {
    const action = async () => {
      try {
        await MasterDataService.updateCategory(id, { isActive: targetStatus === 'Active' });
        showToast(`Category marked as ${targetStatus} successfully.`, 'info');
        await reloadAllData();
      } catch (err) {
        console.error(err);
        showToast('Failed to toggle category status.', 'info');
      }
    };

    if (targetStatus === 'Active') {
      showConfirm(
        'Restore Category',
        'Are you sure you want to mark this category as Active?',
        action
      );
    } else {
      action();
    }
  };

  // Toggle Subcategory Status (Archive/Restore)
  const handleToggleSubcategoryStatus = async (_parentId: string, subId: string, targetStatus: 'Active' | 'Inactive') => {
    const action = async () => {
      try {
        await MasterDataService.updateSubCategory(subId, { isActive: targetStatus === 'Active' });
        showToast(`Subcategory marked as ${targetStatus} successfully.`, 'info');
        await reloadAllData();
      } catch (err) {
        console.error(err);
        showToast('Failed to toggle subcategory status.', 'info');
      }
    };

    if (targetStatus === 'Active') {
      showConfirm(
        'Restore Subcategory',
        'Are you sure you want to mark this subcategory as Active?',
        action
      );
    } else {
      action();
    }
  };

  // Edit Category node
  const handleEditCategoryNode = async (id: string, updatedName: string, updatedDescription: string, updatedImage?: string | null) => {
    try {
      await MasterDataService.updateCategory(id, {
        name: updatedName,
        description: updatedDescription,
        categoryImageUrl: updatedImage || null
      });
      showToast('Category updated successfully.');
      await reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to update category.', 'info');
    }
  };

  // Edit Subcategory node
  const handleEditSubcategoryNode = async (_parentId: string, subId: string, updatedName: string) => {
    try {
      await MasterDataService.updateSubCategory(subId, {
        name: updatedName
      });
      showToast('Subcategory updated successfully.');
      await reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to update subcategory.', 'info');
    }
  };

  // Brand registry handlers
  const handleAddBrand = async (newBrand: Omit<BrandItem, 'id' | 'status'>) => {
    try {
      const res = await MasterDataService.createBrand({
        name: newBrand.name,
        description: newBrand.description || null
      });
      if (res.success) {
        showToast(`Brand "${newBrand.name}" added successfully.`);
        await reloadAllData();
      } else {
        showToast('Failed to add brand.', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to add brand.', 'info');
    }
  };

  const handleEditBrand = async (id: string, updatedFields: Partial<BrandItem>) => {
    try {
      const res = await MasterDataService.updateBrand(id, {
        name: updatedFields.name,
        description: updatedFields.description !== undefined ? (updatedFields.description || null) : undefined
      });
      if (res.success) {
        showToast('Brand updated successfully.');
        await reloadAllData();
      } else {
        showToast('Failed to update brand.', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to update brand.', 'info');
    }
  };

  const handleToggleBrandStatus = async (id: string, targetStatus: 'Active' | 'Inactive') => {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;

    const action = async () => {
      try {
        const res = await MasterDataService.updateBrand(id, {
          state: targetStatus === 'Active' ? 'ACTIVE' : 'INACTIVE'
        });
        if (res.success) {
          showToast(`Brand marked as ${targetStatus}.`, 'info');
          await reloadAllData();
        } else {
          showToast('Failed to update brand status.', 'info');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to update brand status.', 'info');
      }
    };

    if (targetStatus === 'Inactive') {
      const brandProducts = products.filter(p => p.brand === brand.name);

      const messageNode = (
        <div className="space-y-3">
          <p className="text-xs text-outline">
            Are you sure you want to mark the brand <strong className="text-on-surface font-extrabold">"{brand.name}"</strong> as Inactive?
          </p>
          {brandProducts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-rose-600">This will also mark the following products as Inactive:</p>
              <div className="max-h-36 overflow-y-auto border border-rose-100 bg-rose-50/30 rounded-xl p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-rose-200">
                {brandProducts.map((p) => (
                  <div key={p.id} className="text-[11px] text-slate-700 flex justify-between items-center border-b border-rose-100/30 pb-1.5 last:border-0 last:pb-0">
                    <span className="truncate font-semibold pr-2">{p.name}</span>
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono font-bold shrink-0">{p.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

      showConfirm(
        'Archive Brand',
        messageNode,
        action
      );
    } else {
      showConfirm(
        'Restore Brand',
        `Are you sure you want to mark the brand "${brand.name}" as Active?`,
        action
      );
    }
  };

  const handleSaveProduct = async (formData: any) => {
    setLoading(true);
    try {
      const existingProduct = editingProduct || products.find((product) => product.id === formData.id);

      const parentCat = categories.find(c => c.name === formData.category);
      const categoryId = parentCat?.id || categories[0]?.id;
      const subCategoryId = parentCat?.children.find(sub => sub.name === formData.subcategory)?.id || null;

      const brandId = brands.find(b => b.name === formData.brand)?.id || brands[0]?.id;
      const supplierId = suppliers.find(s => s.name === formData.supplier)?.id || suppliers[0]?.id;

      const payload = {
        productStructure: formData.productStructure || 'single',
        name: String(formData.name || existingProduct?.name || 'Untitled Product'),
        categoryId,
        subCategoryId,
        brandId,
        supplierId,
        imageUrl: formData.frontImageUrl || formData.imageUrl || existingProduct?.imageUrl || '',
        status: formData.status || 'Active',

        // Single product specifics
        sku: formData.sku ? String(formData.sku) : undefined,
        barcode: formData.barcode ? String(formData.barcode) : undefined,
        mfgDate: formData.mfgDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber || undefined,
        unitType: formData.unitType ? String(formData.unitType) : undefined,
        costPrice: formData.costPrice !== undefined ? Number(formData.costPrice) : undefined,
        sellingPrice: formData.sellingPrice !== undefined ? Number(formData.sellingPrice) : undefined,
        currentStock: formData.stock !== undefined ? Number(formData.stock) : undefined,
        reorderLevel: formData.reorderLevel !== undefined ? Number(formData.reorderLevel) : undefined,
        targetCapacity: formData.targetCapacity !== undefined ? Number(formData.targetCapacity) : undefined,

        // Variants array
        variants: formData.variants || []
      };

      if (existingProduct && !formData.id?.startsWith('prod_')) {
        const res = await MasterDataService.updateProduct(existingProduct.sku, payload);
        if (res.success) {
          showToast('Product updated successfully!');
          // Reload products
          const prodRes = await MasterDataService.getProducts();
          if (prodRes.success) {
            const mappedProducts = prodRes.data.map(mapBackendProductToFrontend);
            setProducts(mappedProducts);
          }
        } else {
          showToast('Error updating product', 'info');
        }
      } else {
        const res = await MasterDataService.createProduct(payload);
        if (res.success) {
          showToast('Product added successfully to database!');
          // Reload products
          const prodRes = await MasterDataService.getProducts();
          if (prodRes.success) {
            const mappedProducts = prodRes.data.map(mapBackendProductToFrontend);
            setProducts(mappedProducts);
          }
        } else {
          showToast('Error saving product to database', 'info');
        }
      }

      setIsNewProductModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
      showToast('Error saving product', 'info');
    } finally {
      setLoading(false);
    }
  };

  // Row Action Handlers
  const handleEditProduct = (product: ProductItem) => {
    let formProduct = { ...product };
    if (product.hasVariant) {
      // Find all sibling products that have the same masterId
      const siblings = products.filter((p) => p.masterId === product.masterId);
      // Map siblings to the VariantItem type expected by NewProductForm.tsx
      const formVariants = siblings.map((s) => {
        let attrType = 'Flavor';
        let attrValue = '';
        if (s.variantAttributeType) {
          const parts = s.variantAttributeType.split(':');
          if (parts.length > 1) {
            attrType = parts[0].trim();
            attrValue = parts[1].trim();
          }
        }
        return {
          id: s.sku,
          variantName: s.name,
          attributeType: attrType as any,
          attributeValue: attrValue,
          unit: s.unitType,
          sku: s.sku,
          barcode: s.barcode,
          costPrice: s.costPrice,
          sellingPrice: s.sellingPrice,
          stock: s.stock,
          reorderLevel: s.reorderLevel,
          targetCapacity: s.targetCapacity,
          imageUrl: s.imageUrl,
          mfgDate: s.mfgDate,
          expiryDate: s.expiryDate,
          batchNumber: s.batchNumber
        };
      });
      formProduct.variants = formVariants;
    }
    setEditingProduct(formProduct);
    setIsNewProductModalOpen(true);
  };

  const handleArchiveProduct = (id: string, name: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'Inactive' } : p))
    );
    showToast(`Product "${name}" has been marked as Inactive`, 'info');
  };

  // Handle URL parameter trigger for editing a product
  useEffect(() => {
    const action = searchParams.get('action');
    const sku = searchParams.get('sku');
    if (action === 'edit' && sku && products.length > 0) {
      const product = products.find(p => p.sku === sku || p.id === sku);
      if (product) {
        // Keep the tab as products or other params, but remove action/sku trigger so it doesn't loop
        setSearchParams(prev => {
          prev.delete('action');
          prev.delete('sku');
          return prev;
        }, { replace: true });

        handleEditProduct(product);
      }
    }
  }, [searchParams, products, setSearchParams]);

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-on-surface">
      {/* Shared Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Unified Inventory Header block (Consistent with all other inventory pages) */}
        <InventoryHeader />

        {/* Page Content View Scroll container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background px-4 py-6 sm:px-6 lg:px-8 relative">



          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header controls section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-on-surface sm:text-2xl">
                  Supermarket Product Catalog
                </h1>
                <p className="text-xs text-outline mt-1 font-medium">
                  Add, edit, delete, and visual search through all supermarket catalog nodes, brands registry, and suppliers.
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setEditingProduct(null); setIsNewProductModalOpen(true); }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add New Product
              </button>
            </div>

            {/* Segment Controls Navigation Tab Bar */}
            <div className="border-b border-outline-variant pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="inline-flex p-1 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs font-medium w-full sm:w-auto overflow-x-auto gap-1">
                  <button
                    type="button"
                    onClick={() => handleTabChange('products')}
                    className={`px-4 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === 'products' ? 'bg-white text-primary shadow-sm font-black' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    Products Registry
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('categories')}
                    className={`px-4 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === 'categories' ? 'bg-white text-primary shadow-sm font-black' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    Category Registry
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('brands')}
                    className={`px-4 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === 'brands' ? 'bg-white text-primary shadow-sm font-black' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    Brands
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('discounts')}
                    className={`px-4 py-1.5 rounded-md transition-all whitespace-nowrap ${activeTab === 'discounts' ? 'bg-white text-primary shadow-sm font-black' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    Discounts
                  </button>
                </div>
              </div>
            </div>

            {/* Active view state router */}
            {activeTab === 'products' && (
              <ProductsRegistry
                products={products}
                loading={loading}
                onEdit={handleEditProduct}
                onArchive={handleArchiveProduct}
                categories={categoryNamesList}
                suppliers={supplierNamesList}
                initialSearch={initialSearch}
                initialCategory={initialCategory}
                initialBrand={initialBrand}
                showConfirm={showConfirm}
              />
            )}

            {activeTab === 'categories' && (
              <CategoryRegistry
                categories={categories}
                products={products}

                onAddCategory={handleAddCategoryNode}
                onEditCategory={handleEditCategoryNode}
                onEditSubcategory={handleEditSubcategoryNode}
                onAddSubcategory={() => { }}
                onArchiveCategory={(id) => handleToggleCategoryStatus(id, 'Inactive')}
                onRestoreCategory={(id) => handleToggleCategoryStatus(id, 'Active')}
                onArchiveSubcategory={(parentId, subId) => handleToggleSubcategoryStatus(parentId, subId, 'Inactive')}
                onRestoreSubcategory={(parentId, subId) => handleToggleSubcategoryStatus(parentId, subId, 'Active')}
                onEditProduct={(p) => {
                  setEditingProduct(p);
                  setIsNewProductModalOpen(true);
                }}
                onArchiveProduct={handleArchiveProduct}
              />
            )}

            {activeTab === 'brands' && (
              <BrandRegistry
                brands={brands}
                products={products}
                onAddBrand={handleAddBrand}
                onEditBrand={handleEditBrand}
                onArchiveBrand={(id) => handleToggleBrandStatus(id, 'Inactive')}
                onRestoreBrand={(id) => handleToggleBrandStatus(id, 'Active')}
              />
            )}

            {activeTab === 'discounts' && (
              <DiscountRegistry
                products={products}
                showToast={showToast}
                showConfirm={showConfirm}
              />
            )}

            {isNewProductModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
                <div className="bg-background rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-lowest rounded-t-2xl shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[24px]">
                        {editingProduct ? 'edit' : 'add_box'}
                      </span>
                      <h2 className="text-lg font-black text-on-surface">
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewProductModalOpen(false);
                        setEditingProduct(null);
                      }}
                      className="p-1.5 text-outline hover:text-on-surface hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    <NewProductForm
                      categories={categories}
                      suppliers={suppliers}
                      brands={brands}
                      onSave={handleSaveProduct}
                      onCancel={(discarded) => {
                        if (discarded) showToast('Product form discarded.', 'info');
                        setIsNewProductModalOpen(false);
                        setEditingProduct(null);
                      }}
                      initialProduct={editingProduct}
                    />
                  </div>
                </div>
              </div>
            )}

            {confirmConfig && confirmConfig.isOpen && (() => {
              const isDeleteAction = /delete|archive|remove/i.test(confirmConfig.title) || (typeof confirmConfig.message === 'string' && /delete|archive|remove/i.test(confirmConfig.message));
              const iconColor = isDeleteAction ? 'text-rose-600 bg-rose-50' : 'text-primary bg-primary-50';
              const iconName = isDeleteAction ? 'warning' : 'help';
              const confirmBtnBg = isDeleteAction ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-primary text-white';

              return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                    <div className="p-6 flex gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${iconColor}`}>
                        <span className="material-symbols-outlined text-[28px]">{iconName}</span>
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <h3 className="text-sm font-extrabold text-on-surface leading-6">{confirmConfig.title}</h3>
                        <div className="text-xs text-outline leading-relaxed">{confirmConfig.message}</div>
                      </div>
                    </div>
                    <div className="bg-slate-50/80 px-6 py-4 flex justify-end gap-2 border-t border-outline-variant/60">
                      <button
                        type="button"
                        onClick={() => setConfirmConfig(null)}
                        className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmConfig.onConfirm}
                        className={`px-5 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm ${confirmBtnBg}`}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

        </main>
      </div>

    </div>
  );
}
