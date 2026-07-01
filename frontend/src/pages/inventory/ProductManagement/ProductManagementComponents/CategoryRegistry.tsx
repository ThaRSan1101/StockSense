import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CategoryTree from './SubComponents/CategoryTree';
import ProductImageUploader from './SubComponents/ProductImageUploader';
import { ProductItem } from './ProductsRegistry';
import { toast } from 'sonner';

type SubCategoryNode = {
  id: string;
  name: string;
  status?: string;
  productsCount?: number;
};

type CategoryItem = {
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

type CategoryRegistryProps = {
  categories: CategoryItem[];
  products: ProductItem[];

  onAddCategory: (newCategory: { name: string; description: string; hierarchy: 'parent' | 'sub'; parentId: string; image?: string | null }) => void;
  onEditCategory: (id: string, name: string, description: string, image?: string | null) => void;
  onEditSubcategory: (parentId: string, subId: string, name: string) => void;
  onAddSubcategory: (parentCat: CategoryItem) => void;
  onArchiveCategory: (id: string) => void;
  onRestoreCategory: (id: string) => void;
  onArchiveSubcategory: (parentId: string, subId: string) => void;
  onRestoreSubcategory: (parentId: string, subId: string) => void;
  onEditProduct?: (product: ProductItem) => void;
  onArchiveProduct?: (productId: string, productName: string) => void;
};

type ActiveView = 'parents' | 'children' | 'products';

type ArchivePromptData = {
  type: 'category' | 'subcategory';
  id: string;
  parentId?: string;
  name: string;
  activeSubcategories: string[];
  activeProducts: string[];
} | null;

export default function CategoryRegistry({
  categories,
  products,
  onAddCategory,
  onEditCategory,
  onEditSubcategory,
  onArchiveCategory,
  onRestoreCategory,
  onArchiveSubcategory,
  onRestoreSubcategory,
  onEditProduct
}: CategoryRegistryProps) {
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [hierarchy, setHierarchy] = useState<'parent' | 'sub'>('parent');
  const [parentCatId, setParentCatId] = useState('');
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{parent: CategoryItem, sub: SubCategoryNode} | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [categoryImage, setCategoryImage] = useState<string | null>(null);
  const [archivePrompt, setArchivePrompt] = useState<ArchivePromptData>(null);

  // Navigation states
  const [activeView, setActiveView] = useState<ActiveView>('parents');
  const [selectedParent, setSelectedParent] = useState<CategoryItem | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubCategoryNode | null>(null);

  // Product detail panel
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Product search
  const [productSearch, setProductSearch] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      const rt = searchParams.get('returnTo');
      if (rt) setReturnTo(rt);
      setIsModalOpen(true);
      setHierarchy('parent');
      searchParams.delete('action');
      searchParams.delete('returnTo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (categories.length > 0 && !parentCatId) {
      setParentCatId(categories[0].id);
    }
  }, [categories, parentCatId]);

  // Filter products for current view
  const filteredProducts = useMemo(() => {
    if (activeView !== 'products' || !selectedParent) return [];
    const query = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = p.category === selectedParent.name;
      const matchesSub = !selectedSubcategory || p.subcategory === selectedSubcategory.name;
      const matchesSearch = !query || p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query) || p.barcode.toLowerCase().includes(query);
      return matchesCategory && matchesSub && matchesSearch;
    });
  }, [products, activeView, selectedParent, selectedSubcategory, productSearch]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalCategories = categories.length;
    const totalSubcategories = categories.reduce((sum, cat) => sum + cat.children.length, 0);
    const categorizedProducts = categories.reduce((sum, cat) => sum + cat.skus, 0);
    return { totalCategories, totalSubcategories, categorizedProducts };
  }, [categories]);

  // Product KPIs for products view
  const productKpis = useMemo(() => {
    if (!filteredProducts.length) return null;
    const total = filteredProducts.length;
    const active = filteredProducts.filter(p => p.status === 'Active').length;
    const lowStock = filteredProducts.filter(p => p.stock > 0 && p.stock <= (p.reorderLevel || 25)).length;
    const outOfStock = filteredProducts.filter(p => p.stock === 0).length;
    const totalValue = filteredProducts.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
    return { total, active, lowStock, outOfStock, totalValue };
  }, [filteredProducts]);

  const handleOpenAddModal = (mode: 'parent' | 'sub', defaultParentId?: string) => {
    setEditingCategory(null);
    setEditingSubcategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryImage(null);
    setDuplicateError(null);
    setHierarchy(mode);
    if (defaultParentId) setParentCatId(defaultParentId);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setEditingSubcategory(null);
    setHierarchy('parent');
    setCategoryName(cat.name);
    setCategoryDescription(cat.description || '');
    setCategoryImage(cat.image || null);
    setDuplicateError(null);
    setIsModalOpen(true);
  };

  const handleOpenSubcategoryEditModal = (parent: CategoryItem, sub: SubCategoryNode) => {
    setEditingCategory(null);
    setEditingSubcategory({parent, sub});
    setHierarchy('sub');
    setParentCatId(parent.id);
    setCategoryName(sub.name);
    setCategoryDescription('');
    setCategoryImage(null);
    setDuplicateError(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const trimmed = categoryName.trim();
    if (!trimmed) { toast.error('Please enter a valid category name.'); return; }
    if (trimmed.length > 50) {
      toast.error('Category name must be 50 characters or less.');
      return;
    }
    if (categoryDescription.trim().length > 250) {
      toast.error('Category description must be 250 characters or less.');
      return;
    }
    let isDuplicate = false;
    if (editingCategory) {
      isDuplicate = categories.some(c => c.id !== editingCategory.id && c.name.toLowerCase() === trimmed.toLowerCase());
    } else if (editingSubcategory) {
      isDuplicate = editingSubcategory.parent.children.some(c => c.id !== editingSubcategory.sub.id && c.name.toLowerCase() === trimmed.toLowerCase());
    } else {
      if (hierarchy === 'parent') {
        isDuplicate = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
      } else {
        const parent = categories.find(c => c.id === parentCatId);
        isDuplicate = parent ? parent.children.some(sub => sub.name.toLowerCase() === trimmed.toLowerCase()) : false;
      }
    }
    if (isDuplicate) { setDuplicateError(`The category "${trimmed}" already exists.`); return; }

    if (editingCategory) {
      onEditCategory(editingCategory.id, trimmed, categoryDescription.trim(), categoryImage);
    } else if (editingSubcategory) {
      onEditSubcategory(editingSubcategory.parent.id, editingSubcategory.sub.id, trimmed);
    } else {
      onAddCategory({ name: trimmed, description: categoryDescription.trim(), hierarchy, parentId: hierarchy === 'sub' ? parentCatId : '', image: categoryImage });
    }
    setCategoryName(''); setCategoryDescription(''); setCategoryImage(null);
    setDuplicateError(null); setEditingCategory(null); setEditingSubcategory(null); setIsModalOpen(false);
    if (!editingCategory && !editingSubcategory && returnTo) navigate(`/manage-products?tab=${returnTo}`);
  };

  const handleInitiateCategoryArchive = (category: CategoryItem) => {
    const activeSubs = category.children.filter(c => c.status !== 'Inactive').map(c => c.name);
    const activeProds = products.filter(p => p.category === category.name && p.status === 'Active').map(p => p.name);
    setArchivePrompt({
      type: 'category',
      id: category.id,
      name: category.name,
      activeSubcategories: activeSubs,
      activeProducts: activeProds
    });
  };

  const handleInitiateSubcategoryArchive = (parent: CategoryItem, sub: SubCategoryNode) => {
    const activeProds = products.filter(p => p.category === parent.name && p.subcategory === sub.name && p.status === 'Active').map(p => p.name);
    setArchivePrompt({
      type: 'subcategory',
      id: sub.id,
      parentId: parent.id,
      name: sub.name,
      activeSubcategories: [],
      activeProducts: activeProds
    });
  };

  const getStockLabel = (p: ProductItem) => {
    if (p.stock === 0) return { label: 'Out of Stock', cls: 'bg-red-50 text-red-600' };
    if (p.stock <= (p.reorderLevel || 25)) return { label: 'Low Stock', cls: 'bg-amber-50 text-amber-700' };
    return { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700' };
  };

  // Navigate to products view
  const goToProducts = (parent: CategoryItem, sub?: SubCategoryNode) => {
    setSelectedParent(parent);
    setSelectedSubcategory(sub || null);
    setActiveView('products');
    setSelectedProduct(null);
    setProductSearch('');
  };

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Total Categories</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-on-surface leading-none">{kpis.totalCategories}</span>
            <span className="text-xs font-bold text-outline-variant mb-0.5">departments</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Total Subcategories</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-on-surface leading-none">{kpis.totalSubcategories}</span>
            <span className="text-xs font-bold text-outline-variant mb-0.5">shelves</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Categorized Products</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-primary leading-none">{kpis.categorizedProducts}</span>
            <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full mb-0.5">Active</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left: Hierarchy Tree */}
        <div className="lg:col-span-1">
          <CategoryTree
            categories={categories}
            onSelectSubcategory={(parentName, subName) => {
              const cat = categories.find(c => c.name === parentName);
              if (cat) {
                const sub = cat.children.find(c => c.name === subName);
                goToProducts(cat, sub);
              }
            }}
          />
        </div>

        {/* Right: Dynamic View */}
        <div className="lg:col-span-3 space-y-4">

          {/* Breadcrumb Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
              <button
                onClick={() => { setActiveView('parents'); setSelectedParent(null); setSelectedSubcategory(null); setSelectedProduct(null); }}
                className={`transition-colors ${activeView === 'parents' ? 'text-primary font-black' : 'text-outline hover:text-on-surface'}`}
              >
                All Categories
              </button>
              {(activeView === 'children' || activeView === 'products') && selectedParent && (
                <>
                  <span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
                  <button
                    onClick={() => { setActiveView('children'); setSelectedSubcategory(null); setSelectedProduct(null); }}
                    className={`transition-colors ${activeView === 'children' ? 'text-on-surface font-black' : 'text-outline hover:text-on-surface'}`}
                  >
                    {selectedParent.name} sub-shelves
                  </button>
                </>
              )}
              {activeView === 'products' && (
                <>
                  <span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
                  <span className="text-on-surface font-black">
                    {selectedSubcategory ? selectedSubcategory.name : selectedParent?.name} Products
                  </span>
                </>
              )}
            </div>

            {activeView !== 'products' && (
              <button
                onClick={() => handleOpenAddModal(activeView === 'parents' ? 'parent' : 'sub', selectedParent?.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add {activeView === 'parents' ? 'Category' : 'Sub-category'}
              </button>
            )}
          </div>

          {/* ── VIEW: All Category Cards ── */}
          {activeView === 'parents' && (() => {
            const activeCategories = categories.filter(c => c.status !== 'Inactive');
            const archivedCategories = categories.filter(c => c.status === 'Inactive');
            return (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeCategories.map((category) => (
                    <div
                      key={category.id}
                      className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-primary/40 transition-all duration-200 group"
                    >
                  <div className="h-28 relative">
                    <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className={`absolute bottom-3 left-3 ${category.statusClass} text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider`}>
                      {category.status}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5 truncate">
                          <span>{category.icon}</span>
                          <span className="truncate">{category.name}</span>
                        </h4>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleOpenEditModal(category)} title="Edit" className="p-1 rounded text-outline-variant hover:text-primary hover:bg-primary/5 transition-colors">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => handleInitiateCategoryArchive(category)} title="Archive" className="p-1 rounded text-outline-variant hover:text-red-600 hover:bg-red-50 transition-colors">
                            <span className="material-symbols-outlined text-sm">archive</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-outline mt-1">{category.children.length} subcategories registered</p>
                      <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1.5 leading-relaxed">
                        {category.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-on-surface-variant mb-1">
                          <span>Department Skus</span>
                          <span>{category.skus} Products</span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${category.statusClass} rounded-full`} style={{ width: category.health }} />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1 border-t border-slate-50">
                        <button
                          type="button"
                          onClick={() => { setSelectedParent(category); setActiveView('children'); }}
                          className="flex-1 bg-secondary-container hover:bg-secondary-container/80 text-primary py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">segment</span>
                          Sub-shelves
                        </button>
                        <button
                          type="button"
                          onClick={() => goToProducts(category)}
                          className="flex-1 bg-primary text-white py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          Products
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

                  <button
                    type="button"
                    onClick={() => handleOpenAddModal('parent')}
                    className="border-2 border-dashed border-outline-variant hover:border-primary/60 rounded-xl flex flex-col items-center justify-center p-6 text-center text-outline hover:text-primary hover:bg-primary/5 transition-all duration-200 min-h-[220px]"
                  >
                    <span className="material-symbols-outlined text-3xl text-outline-variant hover:text-primary mb-2">add</span>
                    <span className="text-xs font-bold text-on-surface-variant">Add Parent Category</span>
                    <span className="text-[10px] text-outline mt-1 max-w-[140px]">Create top-level inventory departments.</span>
                  </button>
                </div>
                
                {archivedCategories.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-outline-variant uppercase tracking-wider mb-4 border-b border-outline-variant/30 pb-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">inventory_2</span>
                      Archived Departments
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
                      {archivedCategories.map((category) => (
                        <div
                          key={category.id}
                          className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col transition-all duration-200"
                        >
                          <div className="h-28 relative">
                            <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <span className="absolute bottom-3 left-3 bg-slate-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                              Inactive
                            </span>
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-4 bg-slate-50">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5 truncate">
                                  <span>{category.icon}</span>
                                  <span className="truncate">{category.name}</span>
                                </h4>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => onRestoreCategory(category.id)} title="Restore" className="p-1 rounded text-outline-variant hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                    <span className="material-symbols-outlined text-sm">unarchive</span>
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-outline mt-1">{category.children.length} subcategories registered</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── VIEW: Sub-shelves ── */}
          {activeView === 'children' && selectedParent && (() => {
            const currentParent = categories.find(c => c.id === selectedParent.id) || selectedParent;
            const activeSubcategories = currentParent.children.filter(c => c.status !== 'Inactive');
            const archivedSubcategories = currentParent.children.filter(c => c.status === 'Inactive');
            return (
              <div className="space-y-6 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => setActiveView('parents')}
                  className="flex items-center gap-1 text-xs text-outline hover:text-on-surface font-bold mb-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back to Departments
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeSubcategories.map((child) => (
                    <div
                      key={child.id}
                      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors"
                    >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="w-9 h-9 bg-primary/5 text-primary rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm">category</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleOpenSubcategoryEditModal(currentParent, child)} className="p-1 rounded text-outline-variant hover:text-primary hover:bg-primary/5">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button onClick={() => handleInitiateSubcategoryArchive(currentParent, child)} className="p-1 rounded text-outline-variant hover:text-red-600 hover:bg-red-50">
                            <span className="material-symbols-outlined text-[16px]">archive</span>
                          </button>
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-on-surface">{child.name}</h4>
                      <p className="text-[10px] text-outline mt-1">BELONGS TO: {currentParent.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToProducts(currentParent, child)}
                      className="mt-6 w-full border border-outline-variant py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      Browse Products
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                ))}

                  <button
                    type="button"
                    onClick={() => handleOpenAddModal('sub', currentParent?.id)}
                    className="border-2 border-dashed border-outline-variant hover:border-primary/60 rounded-xl flex flex-col items-center justify-center p-6 text-center text-outline hover:text-primary hover:bg-primary/5 transition-all duration-200 min-h-[140px]"
                  >
                    <span className="material-symbols-outlined text-2xl mb-1">add</span>
                    <span className="text-xs font-bold text-on-surface-variant">Add Subcategory</span>
                  </button>
                </div>
                
                {archivedSubcategories.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-outline-variant uppercase tracking-wider mb-4 border-b border-outline-variant/30 pb-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">inventory_2</span>
                      Archived Sub-shelves
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
                      {archivedSubcategories.map((child) => (
                        <div
                          key={child.id}
                          className="bg-slate-50 border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between transition-colors"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <div className="w-9 h-9 bg-slate-200 text-outline-variant rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-sm">category</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => onRestoreSubcategory(currentParent.id, child.id)} title="Restore" className="p-1 rounded text-outline-variant hover:text-emerald-600 hover:bg-emerald-50">
                                  <span className="material-symbols-outlined text-[16px]">unarchive</span>
                                </button>
                              </div>
                            </div>
                            <h4 className="text-sm font-bold text-on-surface">{child.name}</h4>
                            <span className="mt-1 inline-block bg-slate-200 text-on-surface-variant text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                              Inactive
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── VIEW: Products Table + Right Panel ── */}
          {activeView === 'products' && selectedParent && (
            <div className="animate-in fade-in duration-150">

              {/* Product KPI mini-cards */}
              {productKpis && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                  {[
                    { label: 'Total Products', value: productKpis.total, cls: 'text-on-surface' },
                    { label: 'Active', value: productKpis.active, cls: 'text-emerald-600' },
                    { label: 'Low Stock', value: productKpis.lowStock, cls: 'text-amber-600' },
                    { label: 'Out of Stock', value: productKpis.outOfStock, cls: 'text-red-600' },
                    { label: 'Inventory Value', value: `Rs.${productKpis.totalValue.toLocaleString()}`, cls: 'text-primary text-sm' },
                  ].map(k => (
                    <div key={k.label} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] font-bold text-outline uppercase tracking-wider mb-1">{k.label}</p>
                      <p className={`text-xl font-extrabold leading-none ${k.cls}`}>{k.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Search bar */}
              <div className="flex items-center gap-3 mb-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-sm">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search by Name, SKU, Barcode..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <span className="text-xs font-bold text-outline shrink-0">{filteredProducts.length} items</span>
              </div>

              {/* Table + Right Panel */}
              <div className={`flex gap-4 transition-all duration-300 ${selectedProduct ? '' : ''}`}>

                {/* Products Table */}
                <div className={`flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${selectedProduct ? 'w-[55%]' : 'w-full'}`}>
                  {filteredProducts.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-outlined text-4xl text-outline-variant mb-3">inventory_2</span>
                      <p className="text-sm font-bold text-on-surface mb-1">No Products Found</p>
                      <p className="text-xs text-outline">
                        {productSearch ? 'No products match your search. Try clearing it.' : `No products are registered under "${selectedSubcategory?.name || selectedParent.name}".`}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-outline-variant text-[10px] font-bold text-outline uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 min-w-[180px]">Product Details</th>
                            <th className="px-3 py-3">SKU / Barcode</th>
                            <th className="px-3 py-3">Unit</th>
                            <th className="px-3 py-3 text-right">Stock / Cap</th>
                            <th className="px-3 py-3 text-right">Selling</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Updated</th>
                            <th className="px-3 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-on-surface-variant">
                          {filteredProducts.map((p) => {
                            const stock = getStockLabel(p);
                            const isSelected = selectedProduct?.id === p.id;
                            return (
                              <tr
                                key={p.id}
                                onClick={() => setSelectedProduct(isSelected ? null : p)}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-slate-50/70'}`}
                              >
                                {/* Product Details */}
                                <td className="px-4 py-3 min-w-[180px]">
                                  <div className="flex items-center gap-2.5">
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                                    ) : (
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 ${p.category.includes('Beverage') ? 'bg-indigo-600' : p.category.includes('Dairy') ? 'bg-teal-600' : p.category.includes('Grocery') ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                                        {p.name.charAt(0)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <span className="block font-bold text-on-surface text-xs truncate">{p.name}</span>
                                      <span className="block text-[9px] text-outline mt-0.5">{p.brand ? `${p.brand} • ` : ''}{p.subcategory || 'General'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <span className="block font-bold text-on-surface">{p.sku}</span>
                                  <span className="block text-[9px] text-outline mt-0.5">{p.barcode}</span>
                                </td>
                                <td className="px-3 py-3 font-bold text-[10px] whitespace-nowrap">{p.unitType}</td>
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                  <span className={`block font-black text-xs ${p.stock === 0 ? 'text-red-600' : p.stock <= (p.reorderLevel || 25) ? 'text-amber-600' : 'text-on-surface'}`}>
                                    {p.stock} / {p.targetCapacity || 100}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${stock.cls}`}>{stock.label}</span>
                                </td>
                                <td className="px-3 py-3 text-right whitespace-nowrap font-extrabold text-on-surface text-[10px]">Rs.{p.sellingPrice.toFixed(2)}</td>
                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : p.status === 'Inactive' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-800'}`}>{p.status}</span>
                                </td>
                                <td className="px-3 py-3 text-center text-[9px] text-outline whitespace-nowrap">{p.lastUpdated}</td>
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditProduct?.(p);
                                      }}
                                      className="w-7 h-7 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-primary hover:bg-primary/5 hover:border-primary/20 flex items-center justify-center transition-colors"
                                      title="Edit Product"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right-side Product Detail Panel */}
                {selectedProduct && (
                  <div className="w-72 shrink-0 bg-white border border-outline-variant rounded-xl shadow-lg overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Product Details</p>
                      <button onClick={() => setSelectedProduct(null)} className="p-1 rounded-lg hover:bg-slate-200 text-outline transition-colors">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Image & Name */}
                      <div className="text-center">
                        {selectedProduct.imageUrl ? (
                          <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm mx-auto mb-3" />
                        ) : (
                          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-sm ${selectedProduct.category.includes('Beverage') ? 'bg-indigo-600' : selectedProduct.category.includes('Dairy') ? 'bg-teal-600' : selectedProduct.category.includes('Grocery') ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                            {selectedProduct.name.charAt(0)}
                          </div>
                        )}
                        <h3 className="text-sm font-black text-on-surface leading-tight">{selectedProduct.name}</h3>
                        <p className="text-[10px] text-outline mt-1">{selectedProduct.brand && `${selectedProduct.brand} • `}{selectedProduct.subcategory || 'General'}</p>
                        <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${selectedProduct.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{selectedProduct.status}</span>
                      </div>

                      {/* SKU & Barcode */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                        <div>
                          <p className="text-[9px] font-bold text-outline uppercase">SKU</p>
                          <p className="text-xs font-bold text-on-surface">{selectedProduct.sku}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-outline uppercase">Barcode</p>
                          <p className="text-xs font-mono text-on-surface-variant">{selectedProduct.barcode}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-outline uppercase">Supplier</p>
                          <p className="text-xs font-bold text-on-surface">{selectedProduct.supplier}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-outline uppercase">Unit Type</p>
                          <p className="text-xs font-bold text-on-surface">{selectedProduct.unitType}</p>
                        </div>
                      </div>

                      {/* Stock */}
                      <div className={`rounded-xl p-3 border ${selectedProduct.stock === 0 ? 'bg-red-50 border-red-100' : selectedProduct.stock <= (selectedProduct.reorderLevel || 25) ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <p className="text-[9px] font-bold text-outline uppercase mb-1">Stock / Capacity</p>
                        <p className={`text-xl font-black ${selectedProduct.stock === 0 ? 'text-red-600' : selectedProduct.stock <= (selectedProduct.reorderLevel || 25) ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {selectedProduct.stock} <span className="text-sm font-normal text-outline">/ {selectedProduct.targetCapacity || 100}</span>
                        </p>
                        <p className="text-[9px] text-outline mt-1">Reorder at {selectedProduct.reorderLevel} units</p>
                      </div>

                      {/* Pricing */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-[9px] font-bold text-outline uppercase mb-1">Cost</p>
                          <p className="text-sm font-black text-on-surface">Rs.{selectedProduct.costPrice.toFixed(2)}</p>
                        </div>
                        <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                          <p className="text-[9px] font-bold text-primary uppercase mb-1">Selling</p>
                          <p className="text-sm font-black text-primary">Rs.{selectedProduct.sellingPrice.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Margin */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-outline uppercase mb-1">Margin</p>
                          <p className="text-sm font-bold text-emerald-700">{selectedProduct.sellingPrice > 0 ? (((selectedProduct.sellingPrice - selectedProduct.costPrice) / selectedProduct.sellingPrice) * 100).toFixed(1) : '0.0'}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-outline uppercase mb-1">Markup</p>
                          <p className="text-sm font-bold text-blue-700">{selectedProduct.costPrice > 0 ? (((selectedProduct.sellingPrice - selectedProduct.costPrice) / selectedProduct.costPrice) * 100).toFixed(1) : '0.0'}%</p>
                        </div>
                      </div>

                      {/* Expiry */}
                      {(selectedProduct.mfgDate || selectedProduct.expiryDate) && (
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-1.5">
                          <p className="text-[9px] font-bold text-outline uppercase">Expiry Info</p>
                          {selectedProduct.mfgDate && <p className="text-[10px] text-on-surface-variant">Mfg: <span className="font-bold">{selectedProduct.mfgDate}</span></p>}
                          {selectedProduct.expiryDate && <p className="text-[10px] text-amber-700 font-bold">Exp: {selectedProduct.expiryDate}</p>}
                        </div>
                      )}

                      <p className="text-[9px] text-outline text-center">Last updated: {selectedProduct.lastUpdated}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">category</span>
                <h2 className="text-lg font-bold text-on-surface">
                  {editingCategory ? 'Edit Category Node' : editingSubcategory ? 'Edit Subcategory' : 'Manage Category Nodes'}
                </h2>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setCategoryName(''); setCategoryDescription(''); setEditingCategory(null); setEditingSubcategory(null); if (returnTo) navigate(`/manage-products?tab=${returnTo}`); }}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Category Name *</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => { setCategoryName(e.target.value); if (duplicateError) setDuplicateError(null); }}
                  placeholder="e.g. Soft Drinks, Fresh Pastas, Laundry"
                  className={`w-full px-4 py-2.5 bg-background border rounded-lg text-sm text-on-surface outline-none focus:ring-2 transition-colors ${duplicateError ? 'border-red-500 focus:ring-red-500' : 'border-outline-variant focus:ring-primary'}`}
                />
                {duplicateError && (
                  <p className="text-[10px] font-bold text-red-500 mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {duplicateError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Category Description</label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder="Describe shelves, aisle locations, temperature setups..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-background border border-outline-variant rounded-lg text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary placeholder:text-outline-variant resize-none"
                />
              </div>
              {hierarchy === 'parent' && !editingSubcategory && (
                <div>
                  <label className="block text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Department Image</label>
                  <ProductImageUploader imageUrl={categoryImage} setImageUrl={setCategoryImage} />
                </div>
              )}
              {!editingCategory && !editingSubcategory && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Hierarchy Placement</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setHierarchy('parent')} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-colors ${hierarchy === 'parent' ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-outline'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${hierarchy === 'parent' ? 'border-primary' : 'border-outline'}`}>
                          {hierarchy === 'parent' && <div className="w-2 h-2 bg-primary rounded-full" />}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-on-surface">Parent Node</h5>
                          <p className="text-[10px] text-outline mt-0.5">Top-level department</p>
                        </div>
                      </button>
                      <button type="button" onClick={() => setHierarchy('sub')} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-colors ${hierarchy === 'sub' ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-outline'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${hierarchy === 'sub' ? 'border-primary' : 'border-outline'}`}>
                          {hierarchy === 'sub' && <div className="w-2 h-2 bg-primary rounded-full" />}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-on-surface">Subcategory</h5>
                          <p className="text-[10px] text-outline mt-0.5">Fits under a parent</p>
                        </div>
                      </button>
                    </div>
                  </div>
                  {hierarchy === 'sub' && (
                    <div>
                      <label className="block text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Select Parent Department</label>
                      <div className="relative">
                        <select value={parentCatId} onChange={(e) => setParentCatId(e.target.value)} className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-outline-variant rounded-lg text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary transition-all">
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-outline-variant/60">
              <button type="button" onClick={() => { setIsModalOpen(false); setCategoryName(''); setCategoryDescription(''); setEditingCategory(null); setEditingSubcategory(null); if (returnTo) navigate(`/manage-products?tab=${returnTo}`); }} className="px-4 py-2 bg-white border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-colors shadow-sm">Cancel</button>
              <button type="button" onClick={handleSave} className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm">
                {editingCategory || editingSubcategory ? 'Save Changes' : 'Save Category Node'}
              </button>
            </div>
          </div>
        </div>
      )}

      {archivePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-600 text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Archive {archivePrompt.type === 'category' ? 'Category' : 'Subcategory'}</h3>
                <p className="text-sm text-slate-500 mt-0.5">You are about to archive "{archivePrompt.name}".</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 text-sm text-slate-700 space-y-5">
              <p className="text-slate-600 text-[15px]">
                By archiving this {archivePrompt.type}, the following active items will be affected:
              </p>
              
              {archivePrompt.type === 'category' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex justify-between items-center text-[15px]">
                    <span>Active Subcategories</span>
                    <span className="bg-[#e0ece5] text-[#103e2c] font-black w-6 h-6 flex items-center justify-center rounded-full text-[11px]">{archivePrompt.activeSubcategories.length}</span>
                  </h4>
                  <ul className="list-disc pl-5 text-slate-500 text-[14px] max-h-24 overflow-y-auto space-y-1">
                    {archivePrompt.activeSubcategories.length > 0 
                      ? archivePrompt.activeSubcategories.map(name => <li key={name}>{name}</li>)
                      : <li>No active subcategories</li>}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 flex justify-between items-center text-[15px]">
                  <span>Active Products</span>
                  <span className="bg-[#e0ece5] text-[#103e2c] font-black w-6 h-6 flex items-center justify-center rounded-full text-[11px]">{archivePrompt.activeProducts.length}</span>
                </h4>
                <ul className="list-disc pl-5 text-slate-500 text-[14px] max-h-24 overflow-y-auto space-y-1">
                  {archivePrompt.activeProducts.length > 0 
                    ? archivePrompt.activeProducts.map(name => <li key={name}>{name}</li>)
                    : <li>No active products</li>}
                </ul>
              </div>
              
              <div className="border-t border-slate-200 pt-4 mt-2">
                <p className="font-bold text-red-600 text-[15px]">
                  Do you want to archive these products and {archivePrompt.type === 'category' ? 'subcategories' : 'related items'} as well?
                </p>
              </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setArchivePrompt(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (archivePrompt.type === 'category') {
                    onArchiveCategory(archivePrompt.id);
                  } else if (archivePrompt.type === 'subcategory' && archivePrompt.parentId) {
                    onArchiveSubcategory(archivePrompt.parentId, archivePrompt.id);
                  }
                  setArchivePrompt(null);
                }}
                className="px-5 py-2.5 bg-[#dc2626] text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
              >
                Yes, Archive All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
