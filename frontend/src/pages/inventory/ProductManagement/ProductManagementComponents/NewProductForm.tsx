import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImageUploader from './SubComponents/ProductImageUploader';
import BarcodeScannerModal from './SubComponents/BarcodeScannerModal';
import { MasterDataService } from '../../../../services/masterDataService';
import { toast } from 'sonner';

type SupplierOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
};

type BrandOption = {
  id: string;
  name: string;
};

type NewProductFormProps = {
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  brands: BrandOption[];
  onSave: (productData: any) => void;
  onCancel: (discarded?: boolean) => void;
  initialProduct?: any;
};

type ProductStructure = 'single' | 'variant';
type ProductStatus = 'Active' | 'Inactive' | 'Disconnected';
type VariantImageMode = 'different' | 'shared';

type VariantItem = {
  id: string;
  variantName: string;
  attributeType: 'Size' | 'Flavor' | 'Color';
  attributeValue: string;
  unit: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  targetCapacity?: number;
  imageUrl: string | null;
  mfgDate?: string;
  expiryDate?: string;
  batchNumber?: string;
};

const UNIT_OPTIONS = [
  'Piece (pcs)',
  'Packet',
  'Box',
  'Bottle',
  'Kg',
  'g',
  'L',
  'ml',
  'cm',
  'm'
];


const createBarcode = () => `479${Math.floor(1000000000 + Math.random() * 9000000000)}`;

const createVariantDraft = (barcode: string): Omit<VariantItem, 'id'> => ({
  variantName: '',
  attributeType: 'Flavor',
  attributeValue: '',
  unit: UNIT_OPTIONS[0],
  sku: '',
  barcode,
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  reorderLevel: 0,
  targetCapacity: 100,
  imageUrl: null,
  mfgDate: '',
  expiryDate: '',
  batchNumber: ''
});

export default function NewProductForm({
  categories,
  suppliers,
  brands,
  onSave,
  onCancel,
  initialProduct
}: NewProductFormProps) {
  const navigate = useNavigate();
  const categoryPickerRef = useRef<HTMLDivElement | null>(null);
  const [productName, setProductName] = useState(initialProduct?.name || '');
  const [category, setCategory] = useState(initialProduct?.category || categories[0]?.name || '');
  const [subcategory, setSubcategory] = useState(initialProduct?.subcategory || '');
  const [brand, setBrand] = useState(initialProduct?.brand || brands[0]?.name || '');
  const [supplier, setSupplier] = useState(initialProduct?.supplier || suppliers[0]?.name || '');
  const [manufacturer] = useState(initialProduct?.manufacturer || '');
  const [description] = useState(initialProduct?.description || '');

  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(
    initialProduct?.frontImageUrl || initialProduct?.imageUrl || null
  );
  const [additionalImages] = useState<string[]>(initialProduct?.additionalImages || []);

  const [structure, setStructure] = useState<ProductStructure>(initialProduct?.variants?.length ? 'variant' : 'single');

  const [singleCostPrice, setSingleCostPrice] = useState<number | ''>(initialProduct?.costPrice !== undefined ? initialProduct.costPrice : 0);
  const [singleSellingPrice, setSingleSellingPrice] = useState<number | ''>(initialProduct?.sellingPrice !== undefined ? initialProduct.sellingPrice : 0);
  const [singleDiscountPrice, setSingleDiscountPrice] = useState<number | ''>(initialProduct?.discountPrice !== undefined ? initialProduct.discountPrice : 0);
  const [singleStock, setSingleStock] = useState<number | ''>(initialProduct?.stock !== undefined ? initialProduct.stock : 0);
  const [singleTargetCapacity, setSingleTargetCapacity] = useState<number | ''>(
    initialProduct?.targetCapacity !== undefined ? initialProduct.targetCapacity : 100
  );
  const [singleUnit, setSingleUnit] = useState(initialProduct?.unitType || UNIT_OPTIONS[0]);
  const [singleSku, setSingleSku] = useState<string>(initialProduct?.sku || '');
  const [singleBarcode, setSingleBarcode] = useState<string>(initialProduct?.barcode || createBarcode());

  // Existing SKUs database for uniqueness validation
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [isVariantSkuManuallyEdited, setIsVariantSkuManuallyEdited] = useState(false);

  useEffect(() => {
    const fetchExistingSkus = async () => {
      try {
        const res = await MasterDataService.getProducts();
        if (res?.success && Array.isArray(res.data)) {
          const skus = res.data.map((p: any) => p.sku).filter(Boolean);
          setExistingSkus(skus);
        }
      } catch (err) {
        console.error('Failed to fetch existing SKUs for validation:', err);
      }
    };
    fetchExistingSkus();
  }, []);

  // Intelligent SKU Generator
  const generateSkuCode = (
    name: string,
    catName: string,
    subName: string,
    brandName: string,
    existingSkusList: string[]
  ): string => {
    const catCode = (catName || 'GEN').trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const subCode = (subName || 'GEN').trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const brandCode = (brandName || name || 'PRD').trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    let extraCode = '';
    const match = name.match(/\b(\d+(?:g|kg|ml|l|oz|pcs))\b/i);
    if (match) {
      extraCode = '-' + match[1].toUpperCase();
    }

    const basePrefix = `${catCode}-${subCode}-${brandCode}${extraCode}`;
    let sequence = 1;
    let candidate = `${basePrefix}-${String(sequence).padStart(3, '0')}`;
    
    while (existingSkusList.includes(candidate)) {
      sequence++;
      candidate = `${basePrefix}-${String(sequence).padStart(3, '0')}`;
    }
    return candidate;
  };

  useEffect(() => {
    if (!initialProduct && !isSkuManuallyEdited && productName.trim() && category) {
      const suggestion = generateSkuCode(productName, category, subcategory, brand, existingSkus);
      setSingleSku(suggestion);
    }
  }, [productName, category, subcategory, brand, existingSkus, isSkuManuallyEdited, initialProduct]);

  const [reorderPercent, setReorderPercent] = useState<number>(25);
  useEffect(() => {
    const configStr = localStorage.getItem('stocksense_settings_config');
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        if (config.defaultReorderLevel) {
          setReorderPercent(parseInt(config.defaultReorderLevel, 10) || 25);
        }
      } catch (e) {
        // keep 25
      }
    }
  }, []);

  const calculatedReorderPoint = Math.round((reorderPercent / 100) * (singleTargetCapacity === '' ? 100 : singleTargetCapacity));

  const [variantImageMode] = useState<VariantImageMode>('different');
  const [autoVariantBarcode] = useState(true);

  const [variants, setVariants] = useState<VariantItem[]>(initialProduct?.variants || []);

  const [showBarcodeScanner, setShowBarcodeScanner] = useState<'single' | 'variant' | null>(null);

  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantDraft, setVariantDraft] = useState<Omit<VariantItem, 'id'>>(createVariantDraft(createBarcode()));

  const [mfgDate, setMfgDate] = useState(initialProduct?.mfgDate || '');
  const [expiryDate, setExpiryDate] = useState(initialProduct?.expiryDate || '');
  const [batchNumber, setBatchNumber] = useState(initialProduct?.batchNumber || '');

  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status || 'Active');
  const promotionEligible = Boolean(initialProduct?.promotionEligible);
  const seasonalProduct = Boolean(initialProduct?.seasonalProduct);

  const [fastMoving] = useState<boolean>(Boolean(initialProduct?.fastMoving));
  const [lowStockAlertThreshold] = useState<number>(
    initialProduct?.lowStockAlertThreshold || 0
  );
  const [demandForecastTag] = useState<string>(initialProduct?.demandForecastTag || 'Stable');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const selectedCategoryLabel = subcategory ? `${category} / ${subcategory}` : category;

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(event.target as Node)) {
        setIsCategoryPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scrollTo') === 'reorder') {
      const timer = setTimeout(() => {
        const el = document.getElementById('reorder-point-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight with a nice green glow/ring
          el.classList.add('ring-4', 'ring-[#0b8252]', 'ring-offset-4', 'rounded-xl', 'bg-emerald-50/20');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-[#0b8252]', 'ring-offset-4', 'bg-emerald-50/20');
          }, 3000);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCategorySelect = (parentName: string, childName?: string) => {
    setCategory(parentName);
    setSubcategory(childName || '');
    setIsCategoryPickerOpen(false);
  };

  const singleMetrics = useMemo(() => {
    const cost = singleCostPrice === '' ? 0 : Number(singleCostPrice);
    const sell = singleSellingPrice === '' ? 0 : Number(singleSellingPrice);
    const profit = sell - cost;
    const margin = sell > 0 ? (profit / sell) * 100 : 0;
    const markup = cost > 0 ? (profit / cost) * 100 : 0;
    return { profit, margin, markup };
  }, [singleCostPrice, singleSellingPrice]);

  const variantBarcodes = useMemo(() => variants.map((item) => item.barcode), [variants]);

  const isFormDirty = useMemo(() => {
    return (
      Boolean(productName.trim()) ||
      Boolean(description.trim()) ||
      Boolean(frontImageUrl) ||
      additionalImages.length > 0 ||
      structure !== 'single' ||
      (singleCostPrice !== '' && Number(singleCostPrice) > 0) ||
      (singleSellingPrice !== '' && Number(singleSellingPrice) > 0) ||
      (singleStock !== '' && Number(singleStock) > 0) ||
      variants.length > 0 ||
      mfgDate !== '' ||
      expiryDate !== '' ||
      batchNumber.trim() !== ''
    );
  }, [
    productName,
    description,
    frontImageUrl,
    additionalImages.length,
    structure,
    singleCostPrice,
    singleSellingPrice,
    singleStock,
    variants.length,
    mfgDate,
    expiryDate,
    batchNumber
  ]);

  const resetVariantDraft = () => {
    setVariantDraft(createVariantDraft(autoVariantBarcode ? createBarcode() : ''));
    setEditingVariantId(null);
  };

  const openNewVariantModal = () => {
    resetVariantDraft();
    setIsVariantSkuManuallyEdited(false);
    setIsVariantModalOpen(true);
  };

  const openEditVariantModal = (variant: VariantItem) => {
    setEditingVariantId(variant.id);
    setVariantDraft({ ...variant });
    setIsVariantSkuManuallyEdited(true);
    setIsVariantModalOpen(true);
  };

  const handleVariantSave = () => {
    const trimmedName = variantDraft.variantName.trim();
    const trimmedSku = variantDraft.sku.trim();
    const trimmedBarcode = variantDraft.barcode.trim();

    if (!trimmedName) {
      toast.error('Variant Name is required.');
      return;
    }
    if (!trimmedSku) {
      toast.error('Variant SKU is required.');
      return;
    }
    if (!trimmedBarcode) {
      toast.error('Variant Barcode is required.');
      return;
    }
    if (variantImageMode === 'different' && !variantDraft.imageUrl) {
      toast.error('Variant image is required when "different images" is enabled.');
      return;
    }

    if (variantDraft.mfgDate && variantDraft.expiryDate) {
      const mfg = new Date(variantDraft.mfgDate);
      const exp = new Date(variantDraft.expiryDate);
      if (exp <= mfg) {
        toast.error('Variant Expiry Date must be after Manufacturing Date.');
        return;
      }
    }

    const vCost = Number(variantDraft.costPrice);
    const vSell = Number(variantDraft.sellingPrice);
    const vStock = Number(variantDraft.stock || 0);
    const vCapacity = Number(variantDraft.targetCapacity || 50);

    if (isNaN(vCost) || vCost <= 0) {
      toast.error('Variant Cost Price must be a positive number.');
      return;
    }
    if (isNaN(vSell) || vSell <= 0) {
      toast.error('Variant Selling Price must be a positive number.');
      return;
    }
    if (vSell < vCost) {
      toast.error('Variant Selling Price cannot be less than Cost Price.');
      return;
    }
    if (isNaN(vStock) || vStock < 0 || !Number.isInteger(vStock)) {
      toast.error('Variant Stock must be a non-negative integer.');
      return;
    }
    if (isNaN(vCapacity) || vCapacity <= 0 || !Number.isInteger(vCapacity)) {
      toast.error('Variant Target Capacity must be a positive integer.');
      return;
    }

    const duplicate = variants.some(
      (item) => item.barcode === trimmedBarcode && item.id !== editingVariantId
    );
    if (duplicate) {
      toast.error('Each variant must have a unique barcode.');
      return;
    }

    const payload: VariantItem = {
      id: editingVariantId || `var_${Date.now()}`,
      ...variantDraft,
      variantName: trimmedName,
      sku: trimmedSku,
      barcode: trimmedBarcode
    };

    if (editingVariantId) {
      setVariants((prev) => prev.map((item) => (item.id === editingVariantId ? payload : item)));
    } else {
      setVariants((prev) => [...prev, payload]);
    }

    setIsVariantModalOpen(false);
    resetVariantDraft();
  };





  const validateBeforeSave = (draftMode = false) => {
    if (!productName.trim()) {
      toast.error('Product Name is required.');
      return false;
    }


    if (structure === 'single') {
      if (!frontImageUrl) {
        toast.error('Front Image is required.');
        return false;
      }
      if (!singleSku.trim()) {
        toast.error('SKU ID is required for single product.');
        return false;
      }
      if (!singleBarcode.trim()) {
        toast.error('Barcode Number is required for single product.');
        return false;
      }
      if (!singleUnit) {
        toast.error('Unit of Measurement is required.');
        return false;
      }

      // Validate required dates when NOT saving as draft
      if (!draftMode) {
        if (!mfgDate) {
          toast.error('Manufacturing Date is required.');
          return false;
        }
        if (!expiryDate) {
          toast.error('Expiry Date is required.');
          return false;
        }
      }

      const cost = singleCostPrice === '' ? 0 : Number(singleCostPrice);
      const sell = singleSellingPrice === '' ? 0 : Number(singleSellingPrice);
      const stock = singleStock === '' ? 0 : Number(singleStock);
      const capacity = singleTargetCapacity === '' ? 100 : Number(singleTargetCapacity);

      if (isNaN(cost) || cost <= 0) {
        toast.error('Cost Price must be a positive number.');
        return false;
      }
      if (isNaN(sell) || sell <= 0) {
        toast.error('Selling Price must be a positive number.');
        return false;
      }
      if (sell < cost) {
        toast.error('Selling Price cannot be less than Cost Price.');
        return false;
      }
      if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
        toast.error('Stock must be a non-negative integer.');
        return false;
      }
      if (isNaN(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
        toast.error('Target Capacity must be a positive integer.');
        return false;
      }
      if (mfgDate && expiryDate) {
        const mfg = new Date(mfgDate);
        const exp = new Date(expiryDate);
        if (exp <= mfg) {
          toast.error('Expiry Date must be after Manufacturing Date.');
          return false;
        }
      }
    }

    if (structure === 'variant') {
      if (variants.length === 0) {
        toast.error('Add at least one variant.');
        return false;
      }
      const uniqueCount = new Set(variantBarcodes).size;
      if (uniqueCount !== variants.length) {
        toast.error('Each variant must have a unique barcode.');
        return false;
      }
      if (variantImageMode === 'different' && variants.some((item) => !item.imageUrl)) {
        toast.error('Every variant must include an image when different images are enabled.');
        return false;
      }

      // Validate required dates when NOT saving as draft for variants
      if (!draftMode) {
        for (const v of variants) {
          if (!v.mfgDate) {
            toast.error(`Manufacturing Date is required for variant "${v.variantName}".`);
            return false;
          }
          if (!v.expiryDate) {
            toast.error(`Expiry Date is required for variant "${v.variantName}".`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent, draftMode = false) => {
    e.preventDefault();
    if (!validateBeforeSave(draftMode)) return;

    onSave({
      id: initialProduct?.id || `prod_${Date.now()}`,
      productStructure: structure,
      name: productName.trim(),
      category,
      subcategory,
      brand,
      supplier,
      manufacturer: manufacturer.trim(),
      description: description.trim(),
      frontImageUrl,
      additionalImages:
        structure === 'single' ? additionalImages.filter((item) => item.trim() !== '') : [],

      sku: structure === 'single' ? singleSku.trim() : null,
      barcode: structure === 'single' ? singleBarcode.trim() : null,
      unitType: structure === 'single' ? singleUnit : null,
      stock: structure === 'single' ? (singleStock === '' ? 0 : Number(singleStock)) : null,
      reorderLevel: structure === 'single' ? calculatedReorderPoint : null,
      targetCapacity: structure === 'single' ? (singleTargetCapacity === '' ? 100 : Number(singleTargetCapacity)) : null,
      costPrice: structure === 'single' ? (singleCostPrice === '' ? 0 : Number(singleCostPrice)) : null,
      sellingPrice: structure === 'single' ? (singleSellingPrice === '' ? 0 : Number(singleSellingPrice)) : null,
      discountPrice: structure === 'single' ? (singleDiscountPrice === '' ? 0 : Number(singleDiscountPrice)) : null,

      variants: structure === 'variant' ? variants : [],
      variantSettings:
        structure === 'variant'
          ? {
            imageMode: variantImageMode,
            autoGenerateBarcode: autoVariantBarcode
          }
          : null,

      mfgDate,
      expiryDate,
      batchNumber: batchNumber.trim(),

      status: draftMode ? 'Inactive' : status,
      promotionEligible,
      seasonalProduct,

      fastMoving,
      lowStockAlertThreshold,
      demandForecastTag,
      lastUpdated: new Date().toISOString()
    });
  };

  return (
    <form onSubmit={(e) => handleSubmit(e)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Product Name *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Anchor Milk Powder 400g"
                  className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div className="relative" ref={categoryPickerRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Category *</label>
                  <button
                    type="button"
                    onClick={() => { onCancel(); navigate('/manage-products?tab=categories&action=add&returnTo=new-product'); }}
                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-xs">add_link</span>
                    Quick Add Category
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryPickerOpen((prev) => !prev)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 bg-background border rounded-xl text-left shadow-sm transition-all ${isCategoryPickerOpen ? 'border-primary ring-2 ring-primary/15' : 'border-outline-variant hover:border-primary/60'
                    }`}
                >
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">Selected Category</span>
                    <span className="block truncate text-sm font-medium text-on-surface">{selectedCategoryLabel || 'Select a category'}</span>
                  </div>
                  <span className={`material-symbols-outlined text-outline-variant text-[20px] transition-transform ${isCategoryPickerOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {isCategoryPickerOpen && (
                  <div className="absolute z-30 mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl overflow-hidden">
                    <div className="max-h-72 overflow-auto py-2">
                      {categories.map((parentCategory) => (
                        <div key={parentCategory.id} className="px-2 pb-2 last:pb-0">
                          <button
                            type="button"
                            onClick={() => handleCategorySelect(parentCategory.name)}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${category === parentCategory.name && !subcategory
                              ? 'bg-primary text-white shadow-sm'
                              : 'hover:bg-slate-50 text-on-surface'
                              }`}
                          >
                            <span className="flex items-center gap-2 font-semibold text-sm">
                              <span className={`material-symbols-outlined text-[17px] ${category === parentCategory.name && !subcategory ? 'text-white' : 'text-primary'}`}>
                                category
                              </span>
                              {parentCategory.name}
                            </span>
                            {category === parentCategory.name && !subcategory && (
                              <span className="material-symbols-outlined text-[18px]">check</span>
                            )}
                          </button>

                          {parentCategory.children.length > 0 && (
                            <div className="mt-1 ml-2 border-l border-outline-variant/40 pl-3 space-y-1">
                              {parentCategory.children.map((childCategory) => {
                                const isSelected = category === parentCategory.name && subcategory === childCategory.name;
                                return (
                                  <button
                                    key={childCategory.id}
                                    type="button"
                                    onClick={() => handleCategorySelect(parentCategory.name, childCategory.name)}
                                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${isSelected ? 'bg-primary/10 text-primary shadow-sm' : 'hover:bg-slate-50 text-on-surface-variant'
                                      }`}
                                  >
                                    <span className="flex items-center gap-2 text-sm">
                                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-outline-variant'}`} />
                                      {childCategory.name}
                                    </span>
                                    {isSelected && <span className="material-symbols-outlined text-[18px]">check</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Brand *</label>
                  <button
                    type="button"
                    onClick={() => { onCancel(); navigate('/manage-products?tab=brands&action=add&returnTo=new-product'); }}
                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-xs">add_link</span>
                    Quick Add Brand
                  </button>
                </div>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {brands.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-[34px] text-outline-variant text-[20px] pointer-events-none">expand_more</span>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Supplier *</label>
                  <button
                    type="button"
                    onClick={() => { onCancel(); navigate(`/procurement?action=new-supplier&returnTo=${encodeURIComponent('/manage-products?tab=new-product')}`); }}
                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-xs">add_link</span>
                    Quick Add Supplier
                  </button>
                </div>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {suppliers.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-[34px] text-outline-variant text-[20px] pointer-events-none">expand_more</span>
              </div>
            </div>
          </div>



          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">schema</span>
              Product Structure Selection
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`border rounded-lg p-3 cursor-pointer ${structure === 'single' ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="product-structure"
                    checked={structure === 'single'}
                    onChange={() => setStructure('single')}
                  />
                  <span className="font-bold text-sm">Single Product</span>
                </div>
                <p className="text-xs text-outline mt-1">Simple stock model with one barcode and one inventory stream.</p>
              </label>

              <label className={`border rounded-lg p-3 cursor-pointer ${structure === 'variant' ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="product-structure"
                    checked={structure === 'variant'}
                    onChange={() => {
                      setStructure('variant');
                      if (variants.length === 0) {
                        setVariants([
                          {
                            id: `var_${Date.now()}`,
                            variantName: productName || 'Original',
                            attributeType: 'Flavor',
                            attributeValue: 'Original',
                            unit: singleUnit,
                            sku: singleSku || `VAR-${Date.now()}`,
                            barcode: singleBarcode,
                            costPrice: singleCostPrice === '' ? 0 : Number(singleCostPrice),
                            sellingPrice: singleSellingPrice === '' ? 0 : Number(singleSellingPrice),
                            stock: singleStock === '' ? 0 : Number(singleStock),
                            reorderLevel: calculatedReorderPoint,
                            targetCapacity: singleTargetCapacity === '' ? 100 : Number(singleTargetCapacity),
                            imageUrl: frontImageUrl,
                            mfgDate: mfgDate,
                            expiryDate: expiryDate,
                            batchNumber: batchNumber
                          }
                        ]);
                      }
                    }}
                  />
                  <span className="font-bold text-sm">Has Variants</span>
                </div>
                <p className="text-xs text-outline mt-1">Multi-SKU model for flavors, sizes, and per-variant pricing/stock.</p>
              </label>
            </div>
          </div>

          {structure === 'single' ? (
            <>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">photo_library</span>
                  Product Images
                </h3>
                <div>
                  <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Front Image *</p>
                  <ProductImageUploader imageUrl={frontImageUrl} setImageUrl={setFrontImageUrl} />
                  <p className="text-xs text-outline mt-2">
                    Image scope: Product-level and single item display.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">payments</span>
                  Pricing (Single Product)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Cost Price *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={singleCostPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleCostPrice(val === '' ? '' : Math.max(0, parseFloat(val) || 0));
                      }}
                      className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Selling Price *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={singleSellingPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleSellingPrice(val === '' ? '' : Math.max(0, parseFloat(val) || 0));
                      }}
                      className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Discount Price (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={singleDiscountPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleDiscountPrice(val === '' ? '' : Math.max(0, parseFloat(val) || 0));
                      }}
                      className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-outline">Gross Margin</p>
                    <p className="text-xs font-bold text-emerald-700 mt-1">{singleMetrics.margin.toFixed(2)}%</p>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <p className="text-[9px] font-bold uppercase text-outline">Markup</p>
                    <p className="text-xs font-bold text-blue-700 mt-1">{singleMetrics.markup.toFixed(2)}%</p>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <p className="text-[9px] font-bold uppercase text-outline">Net Profit</p>
                    <p className="text-xs font-bold text-emerald-700 mt-1">Rs. {singleMetrics.profit.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">store</span>
                  Inventory, Unit & Barcode (Single Product)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Target Stock Capacity *</label>
                    <input
                      type="number"
                      min="1"
                      value={singleTargetCapacity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleTargetCapacity(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                      }}
                      className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-[9px] text-outline mt-1 font-medium">100% capacity limit of the product.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Current Stock *</label>
                    <input
                      type="number"
                      min="0"
                      value={singleStock}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleStock(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                      }}
                      className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-[9px] text-outline mt-1 font-medium">Current physical stock quantity.</p>
                  </div>
                  <div id="reorder-point-section" className="transition-all duration-300">
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Calculated Reorder Point</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        disabled
                        value={`${calculatedReorderPoint} units (${reorderPercent}%)`}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-outline-variant rounded-lg text-sm text-on-surface-variant font-bold outline-none"
                      />
                      <span className="absolute right-3 text-xs font-bold text-[#0b8252] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/60 select-none">Auto</span>
                    </div>
                    <p className="text-[9px] text-outline mt-1 font-medium">Triggers alert at {reorderPercent}% of Target Capacity.</p>
                  </div>
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Unit of Measurement *</label>
                    <select
                      value={singleUnit}
                      onChange={(e) => setSingleUnit(e.target.value)}
                      className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    >
                      {UNIT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-[34px] text-outline-variant text-[20px] pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-bold text-outline uppercase tracking-wider">SKU ID *</label>
                      {!initialProduct && (
                        <button
                          type="button"
                          onClick={() => {
                            const suggestion = generateSkuCode(productName, category, subcategory, brand, existingSkus);
                            setSingleSku(suggestion);
                            setIsSkuManuallyEdited(false);
                          }}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">autorenew</span>
                          Generate Suggestion
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={singleSku}
                      onChange={(e) => {
                        setSingleSku(e.target.value);
                        setIsSkuManuallyEdited(true);
                      }}
                      placeholder="e.g. DAI-005"
                      disabled={Boolean(initialProduct)}
                      className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:text-on-surface-variant/80 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Barcode Number *</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowBarcodeScanner('single')}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                          Scan Barcode
                        </button>
                        <button
                          type="button"
                          onClick={() => setSingleBarcode(createBarcode())}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">autorenew</span>
                          Generate Barcode
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        value={singleBarcode}
                        onChange={(e) => setSingleBarcode(e.target.value)}
                        placeholder="e.g. 4791029384729"
                        className="flex-1 px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                      {singleBarcode && (
                        <div className="flex flex-col items-center justify-center p-1.5 border border-outline-variant rounded-lg bg-white h-[42px] min-w-[70px] shrink-0">
                          <div className="flex items-center justify-center h-4 gap-[0.5px] overflow-hidden select-none">
                            {singleBarcode.split('').map((char, index) => {
                              const num = parseInt(char, 10) || 0;
                              const widthClass = num % 3 === 0 ? 'w-[2px]' : 'w-[1px]';
                              const colorClass = index % 3 === 0 && num > 4 ? 'bg-transparent' : 'bg-black';
                              return <div key={`${char}-Rs. {index}`} className={`h-full ${widthClass} ${colorClass}`} />;
                            })}
                          </div>
                          <span className="text-[7px] font-mono tracking-widest text-outline mt-0.5">{singleBarcode.substring(0, 8)}...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[20px]">table_view</span>
                    Variant Table
                  </h3>
                  <button
                    type="button"
                    onClick={openNewVariantModal}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold"
                  >
                    + Add Variant
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full min-w-[700px] text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-[10px] text-outline uppercase tracking-wider border-b border-slate-200">
                        <th className="px-3 py-2.5 font-bold">#</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Variant Name</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Attribute</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">SKU</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Barcode</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Stock</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Selling Price</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Expiry Date</th>
                        <th className="px-3 py-2.5 font-bold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-outline">
                            <span className="material-symbols-outlined text-[32px] block mb-1 opacity-30">category</span>
                            No variants added yet. Click "+ Add Variant" to begin.
                          </td>
                        </tr>
                      )}
                      {variants.map((item, idx) => (
                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors group">
                          <td className="px-3 py-3 text-outline font-bold">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.variantName} className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[14px] text-outline">image</span>
                                </div>
                              )}
                              <span className="font-bold text-on-surface">{item.variantName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary w-fit">{item.attributeType}</span>
                              <span className="text-on-surface-variant">{item.attributeValue || '-'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-[10px] font-bold text-on-surface">{item.sku}</td>
                          <td className="px-3 py-3 font-mono text-[10px] text-outline">{item.barcode}</td>
                          <td className="px-3 py-3">
                            <span className={`font-bold ${item.stock <= item.reorderLevel ? 'text-red-600' : 'text-on-surface'}`}>
                              {item.stock}
                              <span className="text-outline font-normal"> / {item.targetCapacity || 100}</span>
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold text-primary">Rs. {item.sellingPrice.toFixed(2)}</td>
                          <td className="px-3 py-3">
                            {item.expiryDate ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 whitespace-nowrap">
                                {item.expiryDate}
                              </span>
                            ) : <span className="text-outline">-</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditVariantModal(item)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-on-surface-variant transition-colors"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </>
          )}

          {structure === 'single' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">event</span>
                Expiry Management
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Manufacturing Date</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Expiry Date (Recommended)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Batch Number</label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g. BAT-2026-050"
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">toggle_on</span>
              Status & Flags
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Status</p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input type="radio" checked={status === 'Active'} onChange={() => setStatus('Active')} />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input type="radio" checked={status === 'Inactive'} onChange={() => setStatus('Inactive')} />
                    Inactive
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input type="radio" checked={status === 'Disconnected'} onChange={() => setStatus('Disconnected')} />
                    Disconnected
                  </label>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <span className="text-xs font-bold text-outline">
          {isFormDirty ? 'Unsaved changes in this form' : 'No unsaved changes'}
        </span>
        <div className="flex gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onCancel(isFormDirty)}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-on-surface rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            Save Draft
          </button>
          <button
            type="submit"
            className="flex-1 sm:flex-none px-6 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-colors shadow-sm"
          >
            Save Product
          </button>
        </div>
      </div>

      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/60 shrink-0">
              <h3 className="text-sm font-bold text-on-surface">
                {editingVariantId ? 'Edit Variant' : 'Add Variant'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsVariantModalOpen(false);
                  resetVariantDraft();
                }}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Variant Name *</label>
                  <input
                    type="text"
                    value={variantDraft.variantName}
                    onChange={(e) => {
                      const nameVal = e.target.value;
                      setVariantDraft((prev) => {
                        const next = { ...prev, variantName: nameVal };
                        if (!isVariantSkuManuallyEdited) {
                          const parentSku = singleSku || 'PROD';
                          const suffix = nameVal.trim().substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
                          next.sku = suffix ? `${parentSku}-${suffix}` : parentSku;
                        }
                        return next;
                      });
                    }}
                    placeholder="e.g. Chocolate"
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="relative">
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Attribute Type</label>
                  <select
                    value={variantDraft.attributeType}
                    onChange={(e) =>
                      setVariantDraft((prev) => ({
                        ...prev,
                        attributeType: e.target.value as VariantItem['attributeType']
                      }))
                    }
                    className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Size">Size</option>
                    <option value="Flavor">Flavor</option>
                    <option value="Color">Color</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-[34px] text-outline-variant text-[20px] pointer-events-none">expand_more</span>
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Unit *</label>
                  <select
                    value={variantDraft.unit}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, unit: e.target.value }))}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    {UNIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-[34px] text-outline-variant text-[20px] pointer-events-none">expand_more</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-wider">SKU ID *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const parentSku = singleSku || 'PROD';
                        const suffix = variantDraft.variantName.trim().substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
                        const suggestion = suffix ? `${parentSku}-${suffix}` : parentSku;
                        setVariantDraft((prev) => ({ ...prev, sku: suggestion }));
                        setIsVariantSkuManuallyEdited(false);
                      }}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">autorenew</span>
                      Generate Sku
                    </button>
                  </div>
                  <input
                    type="text"
                    value={variantDraft.sku}
                    onChange={(e) => {
                      setVariantDraft((prev) => ({ ...prev, sku: e.target.value }));
                      setIsVariantSkuManuallyEdited(true);
                    }}
                    placeholder="e.g. VAR-001"
                    disabled={editingVariantId ? !editingVariantId.startsWith('var_') : false}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:text-on-surface-variant/80 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Barcode *</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner('variant')}
                        className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                        Scan Barcode
                      </button>
                      <button
                        type="button"
                        onClick={() => setVariantDraft((prev) => ({ ...prev, barcode: createBarcode() }))}
                        className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <span className="material-symbols-outlined text-[14px]">autorenew</span>
                        Generate
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={variantDraft.barcode}
                    onChange={(e) => setVariantDraft((prev) => ({ ...prev, barcode: e.target.value }))}
                    placeholder="e.g. 4791029384729"
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Target Stock Capacity *</label>
                  <input
                    type="number"
                    min="1"
                    value={variantDraft.targetCapacity}
                    onChange={(e) => {
                      const val = e.target.value;
                      const capacity = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1);
                      const reorderVal = capacity === '' ? 0 : Math.round((reorderPercent / 100) * capacity);
                      setVariantDraft((prev) => ({
                        ...prev,
                        targetCapacity: capacity as any,
                        reorderLevel: reorderVal
                      }));
                    }}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={variantDraft.stock}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVariantDraft((prev) => ({
                        ...prev,
                        stock: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0) as any
                      }));
                    }}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Calculated Reorder Point</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      disabled
                      value={`${Math.round((reorderPercent / 100) * (variantDraft.targetCapacity || 100))} units (${reorderPercent}%)`}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-outline-variant rounded-lg text-sm text-on-surface-variant font-bold outline-none"
                    />
                    <span className="absolute right-3 text-xs font-bold text-[#0b8252] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/60 select-none">Auto</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Cost Price *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={variantDraft.costPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVariantDraft((prev) => ({
                        ...prev,
                        costPrice: val === '' ? '' : Math.max(0, parseFloat(val) || 0) as any
                      }));
                    }}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Selling Price *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={variantDraft.sellingPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVariantDraft((prev) => ({
                        ...prev,
                        sellingPrice: val === '' ? '' : Math.max(0, parseFloat(val) || 0) as any
                      }));
                    }}
                    className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
                 <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                   <span className="material-symbols-outlined text-[16px] text-primary">event_note</span>
                   Expiry Management & Batch
                 </h4>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Manufacturing Date</label>
                      <input
                        type="date"
                        value={variantDraft.mfgDate || ''}
                        onChange={(e) => setVariantDraft((prev) => ({ ...prev, mfgDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Expiry Date (Recommended)</label>
                      <input
                        type="date"
                        value={variantDraft.expiryDate || ''}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setVariantDraft((prev) => ({ ...prev, expiryDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">Batch Number</label>
                      <input
                        type="text"
                        value={variantDraft.batchNumber || ''}
                        onChange={(e) => setVariantDraft((prev) => ({ ...prev, batchNumber: e.target.value }))}
                        placeholder="e.g. BATCH-001"
                        className="w-full px-3 py-2 bg-background border border-outline-variant rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                 </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-2">
                  Variant Image {variantImageMode === 'different' ? '*' : '(Optional)'}
                </label>
                <ProductImageUploader
                  imageUrl={variantDraft.imageUrl}
                  setImageUrl={(value) => setVariantDraft((prev) => ({ ...prev, imageUrl: value }))}
                />
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsVariantModalOpen(false);
                  resetVariantDraft();
                }}
                className="px-4 py-2 bg-white border border-outline rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVariantSave}
                className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold"
              >
                Save Variant
              </button>
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={Boolean(showBarcodeScanner)}
        onClose={() => setShowBarcodeScanner(null)}
        onScan={(scannedBarcode) => {
          if (showBarcodeScanner === 'single') {
            setSingleBarcode(scannedBarcode);
          } else {
            setVariantDraft((prev) => ({ ...prev, barcode: scannedBarcode }));
          }
        }}
      />
    </form>
  );
}
