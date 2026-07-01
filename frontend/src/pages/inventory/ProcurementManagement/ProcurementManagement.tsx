import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from "../Shared/Sidebar";
import InventoryHeader from '../Shared/InventoryHeader';
import { toast } from 'sonner';

import { Supplier } from './constants/supplierConstants';
import SupplierList from './components/SupplierList';
import SupplierFormModal from './components/SupplierFormModal';
import { MasterDataService } from '../../../services/masterDataService';

export default function ProcurementManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Active Datasets State
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  const loadSuppliersData = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        MasterDataService.getSuppliers(),
        MasterDataService.getProducts()
      ]);

      if (supRes.success) {
        const dbSuppliers = supRes.data;
        const productsData = prodRes.success ? prodRes.data : [];

        const mapped = dbSuppliers.map((s: any) => {
          const allocatedProductsCount = productsData.filter((p: any) => p.masterClass?.supplier?.id === s.id).length;

          return {
            id: s.id,
            name: s.name,
            companyName: s.companyName || s.name,
            email: s.email || '',
            phone: s.phone || '',
            address: s.address || '',
            products: allocatedProductsCount,
            lastPurchaseDate: new Date(s.createdAt || Date.now()).toISOString().split('T')[0],
            totalPurchases: 0,
            totalValue: 'Rs. 0.00',
            reliability: 100,
            onTime: 100,
            rating: 5.0
          };
        });
        setSuppliersList(mapped);
      }
    } catch (err) {
      console.error('Failed to load supplier registry data', err);
    }
  };

  useEffect(() => {
    loadSuppliersData();
  }, []);

  // Supplier Details Popup State
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  // General Filter State
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Selected details State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Forms Field States for Supplier Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
  });

  const [formErrors, setFormErrors] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
  });

  // Filtered Suppliers List
  const filteredSuppliers = useMemo(() => {
    return suppliersList.filter(s => {
      const matchesSearch =
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.address.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [suppliersList, searchTerm]);



  // Validate Individual Fields as the User Types
  const validateField = (name: string, value: string, ignoreId?: string | null) => {
    let error = '';
    const trimmedVal = value.trim();

    switch (name) {
      case 'companyName':
        if (!trimmedVal) {
          error = 'Company name is required';
        } else if (trimmedVal.length > 100) {
          error = 'Company name must be 100 characters or less';
        } else if (!/^[a-zA-Z0-9\s.,&'()-]+$/.test(value)) {
          error = 'Company name can only contain letters, numbers, and basic punctuation';
        }
        break;

      case 'name':
        if (!trimmedVal) {
          error = 'Supplier name is required';
        } else if (trimmedVal.length > 100) {
          error = 'Supplier name must be 100 characters or less';
        } else if (!/^[a-zA-Z\s]+$/.test(value)) {
          error = 'Supplier name must contain letters only';
        }
        break;

      case 'phone':
        if (!trimmedVal) {
          error = 'Phone number is required';
        } else if (!/^\d{10}$/.test(value)) {
          error = 'Phone number must be exactly 10 digits';
        }
        break;

      case 'email':
        if (trimmedVal) {
          if (trimmedVal.length > 100) {
            error = 'Email must be 100 characters or less';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedVal)) {
            error = 'Enter a valid email address';
          } else {
            // Uniqueness check for email locally
            const currentIgnoreId = ignoreId !== undefined ? ignoreId : (selectedSupplier?.id || null);
            const emailExists = suppliersList.some(
              (s) => s.email.toLowerCase() === trimmedVal.toLowerCase() && s.id !== currentIgnoreId
            );
            if (emailExists) {
              error = 'This email address is already registered';
            }
          }
        }
        break;

      case 'address':
        if (!trimmedVal) {
          error = 'Warehouse address is required';
        } else if (trimmedVal.length > 300) {
          error = 'Address must be 300 characters or less';
        }
        break;
    }

    setFormErrors((prev) => ({ ...prev, [name]: error }));
    return error;
  };

  // Handle Input Changes for Suppliers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  // Validation Form for Suppliers
  const validateForm = (ignoreId?: string | null) => {
    const currentIgnoreId = ignoreId !== undefined ? ignoreId : (selectedSupplier?.id || null);
    
    // Validate each field
    const companyNameErr = validateField('companyName', formData.companyName, currentIgnoreId);
    const nameErr = validateField('name', formData.name, currentIgnoreId);
    const phoneErr = validateField('phone', formData.phone, currentIgnoreId);
    const emailErr = validateField('email', formData.email, currentIgnoreId);
    const addressErr = validateField('address', formData.address, currentIgnoreId);

    let hasErrors = Boolean(companyNameErr || nameErr || phoneErr || emailErr || addressErr);

    // Duplicate Name check
    if (formData.name.trim() && !nameErr) {
      const isDuplicate = suppliersList.some(s =>
        s.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        s.id !== currentIgnoreId
      );
      if (isDuplicate) {
        setFormErrors(prev => ({ ...prev, name: `Supplier "${formData.name.trim()}" already exists.` }));
        hasErrors = true;
      }
    }

    return !hasErrors;
  };

  // CRUD for Suppliers
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      address: '',
    });
    setFormErrors({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      address: '',
    });
    setIsAddModalOpen(true);
  };

  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const res = await MasterDataService.createSupplier({
        name: formData.name,
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address
      });

      if (res.success) {
        toast.success(`Supplier "${formData.name}" added successfully.`);
        setIsAddModalOpen(false);
        await loadSuppliersData();

        if (returnTo) {
          navigate(returnTo);
        }
      } else {
        toast.error(res.message || 'Failed to add supplier.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving supplier.');
    }
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      companyName: supplier.companyName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
    });
    setFormErrors({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      address: '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(selectedSupplier?.id)) return;
    if (!selectedSupplier) return;

    try {
      const res = await MasterDataService.updateSupplier(selectedSupplier.id, {
        name: formData.name,
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address
      });

      if (res.success) {
        toast.success('Supplier details updated successfully.');
        setIsEditModalOpen(false);
        
        // Reload all data and also refresh active profile if open currently
        await loadSuppliersData();
        
        // Find updated supplier data from backend sync
        const updatedRaw = {
          ...selectedSupplier,
          ...formData,
          id: selectedSupplier.id,
          products: selectedSupplier.products,
          lastPurchaseDate: selectedSupplier.lastPurchaseDate,
          totalPurchases: selectedSupplier.totalPurchases,
          totalValue: selectedSupplier.totalValue,
          reliability: selectedSupplier.reliability,
          onTime: selectedSupplier.onTime,
          rating: selectedSupplier.rating
        };
        if (viewingSupplier && viewingSupplier.id === selectedSupplier.id) {
          setViewingSupplier(updatedRaw);
        }
      } else {
        toast.error(res.message || 'Failed to update supplier.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating supplier.');
    }
  };




  const handleConfirmDeleteSupplier = async () => {
    if (supplierToDelete) {
      try {
        const res = await MasterDataService.deleteSupplier(supplierToDelete.id);
        if (res.success) {
          toast.success(`Supplier "${supplierToDelete.name}" deleted successfully.`);
          if (viewingSupplier && viewingSupplier.id === supplierToDelete.id) {
            setViewingSupplier(null);
          }
          setIsDeleteConfirmOpen(false);
          setSupplierToDelete(null);
          await loadSuppliersData();
        } else {
          toast.error(res.message || 'Failed to delete supplier.');
        }
      } catch (err: any) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Error deleting supplier.';
        toast.error(errMsg);
      }
    }
  };

  useEffect(() => {
    const action = searchParams.get('action');
    const returnToParam = searchParams.get('returnTo');
    
    if (action === 'new-supplier') {
      if (returnToParam) {
        setReturnTo(returnToParam);
      }
      handleOpenAddModal();
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        next.delete('returnTo');
        return next;
      }, { replace: true });
    }
  }, [searchParams]);

  return (
    <div className="flex h-screen bg-background text-on-surface font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <InventoryHeader />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background">
          <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-on-surface">
                  Procurement Management
                </h1>
                <p className="text-xs text-outline mt-1 font-medium">
                  Manage your partner suppliers and supply chain directory.
                </p>
              </div>
            </div>

            <SupplierList
              suppliersList={suppliersList}
              filteredSuppliers={filteredSuppliers}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSupplierClick={setViewingSupplier}
              onEditClick={handleOpenEditModal}
              onAddClick={handleOpenAddModal}
            />

          </div>
        </main>
      </div>

      {/* Add Supplier Modal */}
      <SupplierFormModal
        isOpen={isAddModalOpen}
        mode="add"
        formData={formData}
        formErrors={formErrors}
        onClose={() => {
          setIsAddModalOpen(false);
          if (returnTo) navigate(returnTo);
        }}
        onChange={handleInputChange}
        onSubmit={handleAddSupplierSubmit}
      />

      {/* Edit Supplier Modal */}
      <SupplierFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        formData={formData}
        formErrors={formErrors}
        onClose={() => setIsEditModalOpen(false)}
        onChange={handleInputChange}
        onSubmit={handleEditSupplierSubmit}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && supplierToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f8fafc] border border-outline-variant rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-black text-on-surface">Delete Supplier</h3>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Are you sure you want to delete supplier <strong className="text-on-surface">{supplierToDelete.name} ({supplierToDelete.id})</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setSupplierToDelete(null);
                }}
                className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Details Popup Modal */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[24px]">local_shipping</span>
                <div>
                  <h2 className="text-base font-extrabold text-on-surface">Supplier Details</h2>
                  <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">{viewingSupplier.companyName}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingSupplier(null)}
                className="p-1 text-outline hover:text-on-surface hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Main Info Card */}
              <div className="bg-slate-50 border border-outline-variant/40 rounded-xl p-4 flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-on-surface">{viewingSupplier.name}</h3>
                  <p className="text-xs text-outline mt-0.5">{viewingSupplier.companyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-outline">Products Supplied</p>
                  <p className="text-lg font-black text-primary mt-1">{viewingSupplier.products} items</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Phone Number</p>
                  <p className="mt-1 font-semibold text-slate-700">{viewingSupplier.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Email Address</p>
                  <p className="mt-1 font-semibold text-slate-700 truncate">{viewingSupplier.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Last Purchase Date</p>
                  <p className="mt-1 font-semibold text-slate-700">{viewingSupplier.lastPurchaseDate}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1.5">Warehouse Address</p>
                <div className="bg-slate-50 border border-outline-variant/30 rounded-xl p-3 text-xs text-slate-600 font-semibold leading-relaxed">
                  {viewingSupplier.address || '—'}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-outline-variant/60 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setViewingSupplier(null);
                  handleOpenEditModal(viewingSupplier);
                }}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                Edit Details
              </button>
              <button
                onClick={() => setViewingSupplier(null)}
                className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
