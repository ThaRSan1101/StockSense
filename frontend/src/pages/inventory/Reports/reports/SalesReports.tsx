import { useState, useEffect } from 'react';
import { downloadReport, ViewState } from './reportUtils';
import { inventoryOperationsService, ProductItem } from '../../StockOperations/operations/inventoryOperationsService';
import { SalesService } from '../../../../services/salesService';

export default function SalesReports({ onViewChange }: { onViewChange: (view: ViewState) => void }) {
  const [period, setPeriod] = useState<'Today' | 'Week' | 'Month' | 'Year' | 'Custom Range'>('Month');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All Departments');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Live Database States
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, period]);

  useEffect(() => {
    let active = true;
    async function loadSalesData() {
      try {
        const [loadedProducts, loadedBillsResponse] = await Promise.all([
          inventoryOperationsService.getProducts(),
          SalesService.getSalesHistory(),
        ]);
        if (!active) return;
        setProducts(loadedProducts);
        setBills(loadedBillsResponse.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load live sales reports data', err);
        if (!active) return;
        setLoading(false);
      }
    }
    loadSalesData();
    return () => { active = false; };
  }, []);

  const handlePeriodChange = (tab: any) => {
    if (tab === 'Custom Range') {
      setShowCustomModal(true);
    } else {
      setPeriod(tab);
    }
  };

  const applyCustomRange = () => {
    setPeriod('Custom Range');
    setShowCustomModal(false);
  };

  const reportName = period === 'Custom Range' && dateRange.start && dateRange.end
    ? `Sales_Report_${dateRange.start}_to_${dateRange.end}`
    : `Sales_Report_${period}`;

  // Period Date Range calculation
  const getPeriodDateRange = () => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (period === 'Today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Week') {
      start.setDate(now.getDate() - 7);
    } else if (period === 'Month') {
      start.setDate(now.getDate() - 30);
    } else if (period === 'Year') {
      start.setDate(now.getDate() - 365);
    } else if (period === 'Custom Range') {
      if (dateRange.start) start = new Date(dateRange.start);
      if (dateRange.end) {
        end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
      }
    }
    return { start, end };
  };

  const { start, end } = getPeriodDateRange();
  const periodBills = bills.filter(bill => {
    const entryDate = new Date(bill.createdAt);
    return entryDate >= start && entryDate <= end;
  });

  // Calculate units sold, price, and revenue for each product in the selected period
  const salesItems = products.map(product => {
    let qty = 0;
    let revenue = 0;

    periodBills.forEach(bill => {
      bill.billItems?.forEach((item: any) => {
        if (item.sku === product.sku) {
          qty += item.qty;
          revenue += item.total;
        }
      });
    });

    return {
      name: product.name,
      cat: product.category,
      sku: product.sku,
      qty,
      price: `Rs. ${product.sellingPrice.toFixed(2)}`,
      numericPrice: product.sellingPrice,
      rev: `Rs. ${revenue.toFixed(2)}`,
      numericRev: revenue,
      icon: product.category === 'Produce' ? 'eco' :
            product.category === 'Dairy' ? 'kitchen' :
            product.category === 'Meat' ? 'local_dining' : 'shopping_bag'
    };
  });

  // Unique categories list
  const categoriesList = ['All Departments', ...Array.from(new Set(products.map(p => p.category)))];

  // Filtering products
  const filteredProducts = salesItems.filter(item => {
    const matchCat = categoryFilter === 'All Departments' || item.cat === categoryFilter;
    return matchCat;
  });

  // Sort: display those with sales first, or alphabetical if equal
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (b.qty !== a.qty) return b.qty - a.qty;
    return a.name.localeCompare(b.name);
  });

  // Pagination Logic
  const itemsPerPage = 8;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedProducts.length);
  const paginatedItems = sortedProducts.slice(startIndex, endIndex);
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));

  // KPIs
  const totalSalesValue = periodBills.reduce((sum, bill) => sum + bill.totalBill, 0);
  const totalOrders = periodBills.length;
  
  // Find top selling product
  const sortedAll = [...salesItems].sort((a, b) => b.qty - a.qty);
  const topProduct = sortedAll[0] && sortedAll[0].qty > 0 ? sortedAll[0] : null;

  const reportHeaders = ['Product Name', 'Category', 'SKU', 'Qty Sold', 'Price', 'Revenue'];
  const reportRows = sortedProducts.map(p => [p.name, p.cat, p.sku, p.qty, p.price, p.rev]);
  const reportData = { headers: reportHeaders, rows: reportRows };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      
      {/* Custom Range Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0b8252]">date_range</span>
                Custom Date Range
              </h3>
              <button onClick={() => setShowCustomModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Start Date</label>
                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full bg-[#f8f9fa] border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">End Date</label>
                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full bg-[#f8f9fa] border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-all" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowCustomModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={applyCustomRange} className="px-5 py-2.5 text-sm font-bold text-white bg-[#0b8252] hover:bg-[#096b43] rounded-lg shadow-sm transition-colors">Apply Range</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sales Reports</h2>
          <p className="text-slate-500 text-sm mt-1">
            Analyze performance metrics and revenue streams across periods.
            {period === 'Custom Range' && dateRange.start && dateRange.end && (
              <span className="ml-2 font-bold text-[#0b8252]">({dateRange.start} to {dateRange.end})</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => downloadReport(reportName, 'pdf', reportData, 'Sales')} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all">
            <span className="material-symbols-outlined text-[18px] text-slate-500">picture_as_pdf</span>
            Export PDF
          </button>
          <button onClick={() => downloadReport(reportName, 'excel', reportData, 'Sales')} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all">
            <span className="material-symbols-outlined text-[18px] text-slate-500">table_chart</span>
            Export Excel
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex bg-[#f1f5f9] p-1 rounded-lg border border-slate-200 w-fit">
        {['Today', 'Week', 'Month', 'Year', 'Custom Range'].map(tab => {
          let tabLabel = tab;
          if (tab === 'Custom Range' && period === 'Custom Range' && dateRange.start && dateRange.end) {
            tabLabel = `${dateRange.start} to ${dateRange.end}`;
          }
          return (
            <button 
              key={tab}
              onClick={() => handlePeriodChange(tab)}
              className={`px-5 py-1.5 text-sm font-medium rounded-md flex items-center gap-1 transition-colors ${period === tab ? 'bg-white text-[#0b8252] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {tab === 'Custom Range' && <span className="material-symbols-outlined text-[16px]">calendar_today</span>}
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Sales */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center transition-all duration-300">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <span className="material-symbols-outlined text-[16px]">payments</span>
            <p className="text-xs font-bold uppercase tracking-wider">Total Sales</p>
          </div>
          <h3 className="text-4xl font-bold text-slate-800 tracking-tight">
            Rs. {totalSalesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-1">
            Real-time sales value
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center transition-all duration-300">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
            <p className="text-xs font-bold uppercase tracking-wider">Total Orders</p>
          </div>
          <h3 className="text-4xl font-bold text-slate-800 tracking-tight">{totalOrders}</h3>
          <p className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-1">
            Sales transactions logged
          </p>
        </div>

        {/* Top Selling Product */}
        <div className="bg-[#eef8f2] rounded-xl border border-[#bbf7d0] p-6 shadow-sm flex flex-col justify-center relative overflow-hidden transition-all duration-300">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[#0b8252] mb-1">
              <span className="material-symbols-outlined text-[16px]">stars</span>
              <p className="text-xs font-bold uppercase tracking-wider">Top Selling Product</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 leading-tight truncate">
              {topProduct ? topProduct.name : 'No sales'}
            </h3>
            <div className="mt-3">
              <p className="text-xs text-slate-600 mb-0.5">{topProduct ? topProduct.qty : 0} Units Sold</p>
              <p className="text-sm font-bold text-[#0b8252]">
                Revenue: {topProduct ? topProduct.rev : 'Rs. 0.00'}
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[120px] text-[#0b8252] opacity-10">
            shopping_basket
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-lg text-slate-800">Inventory Sales Detail</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-[#f8f9fa] border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#0b8252]/20 focus:border-[#0b8252]"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product Name</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Quantity Sold</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Unit Price</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">Loading live sales records...</td>
                </tr>
              ) : paginatedItems.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#eef8f2] flex items-center justify-center text-[#0b8252]">
                      <span className="material-symbols-outlined">{item.icon}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">SKU: {item.sku}</p>
                    </div>
                  </td>
                  <td className="p-4 text-center font-medium text-slate-700">{item.qty}</td>
                  <td className="p-4 text-center font-medium text-slate-700">{item.price}</td>
                  <td className="p-4 text-right font-bold text-slate-800">{item.rev}</td>
                </tr>
              ))}
              {!loading && paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No products found in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-bold text-slate-500">
            Showing {sortedProducts.length > 0 ? startIndex + 1 : 0}-{endIndex} of {sortedProducts.length} items
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-slate-600">Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
