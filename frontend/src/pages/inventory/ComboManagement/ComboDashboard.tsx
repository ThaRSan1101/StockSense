import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { comboService } from '../../../services/comboService';
import { useAuth } from '../../../hooks/useAuth';
import Sidebar from '../Shared/Sidebar';
import InventoryHeader from '../Shared/InventoryHeader';

export default function ComboDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const [stats, setStats] = useState({
    slowMoving: 0,
    deadStock: 0,
    nearExpiry: 0,
    overstock: 0,
    seasonal: 0
  });

  const totalPages = Math.ceil(opportunities.length / pageSize) || 1;
  const paginatedOpportunities = opportunities.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch opportunities
      const oppData = await comboService.getOpportunities({
        type: filterType || undefined,
        status: filterStatus || undefined
      });

      if (oppData.success) {
        setOpportunities(oppData.data);
        
        // Re-calculate basic type stats if not filtering
        if (!filterType) {
          const data = oppData.data;
          setStats({
            slowMoving: data.filter((o: any) => o.opportunityType === 'SLOW_MOVING').length,
            deadStock: data.filter((o: any) => o.opportunityType === 'DEAD_STOCK').length,
            nearExpiry: data.filter((o: any) => o.opportunityType === 'NEAR_EXPIRY').length,
            overstock: data.filter((o: any) => o.opportunityType === 'OVERSTOCK').length,
            seasonal: data.filter((o: any) => o.opportunityType === 'SEASONAL').length
          });
        }
      }

      // 2. Fetch created combos
      const comboData = await comboService.getCombosList();
      if (comboData.success) {
        setCombos(comboData.data);
      }
    } catch (error) {
      console.error('Failed to load combo dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchDashboardData();
  }, [filterType, filterStatus]);

  const handleRunAnalysis = async () => {
    try {
      setRunningAnalysis(true);
      const data = await comboService.runComboAnalysis();
      if (data.success) {
        toast.success('AI association rules mining and suggestions generation pipeline finished successfully!');
        fetchDashboardData();
      } else {
        toast.error(data.message || 'Failed to execute AI suggestions pipeline.');
      }
    } catch (error: any) {
      // Axios interceptor already shows toast for non-401 server errors, only handle connection failures
      if (!error?.response) {
        toast.error('AI service is unreachable. Please ensure the AI engine is running on port 8000.');
      }
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleQuickApprove = async (comboId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await comboService.approveCombo(comboId);
      if (res.success) {
        toast.success('Combo campaign approved and activated successfully!');
        fetchDashboardData();
      } else {
        toast.error(res.message || 'Failed to approve combo.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error approving combo campaign.');
    }
  };

  const handleQuickReject = async (comboId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const comment = prompt('Enter rejection reason for this combo:');
    if (comment === null) return;
    try {
      const res = await comboService.rejectCombo(comboId, comment);
      if (res.success) {
        toast.success('Combo campaign rejected.');
        fetchDashboardData();
      } else {
        toast.error(res.message || 'Failed to reject combo.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error rejecting combo campaign.');
    }
  };

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; comboId: string | null; comboName: string; deleting: boolean }>({
    isOpen: false,
    comboId: null,
    comboName: '',
    deleting: false
  });

  const confirmDeleteCombo = async () => {
    if (!deleteModal.comboId) return;
    setDeleteModal(prev => ({ ...prev, deleting: true }));
    try {
      const res = await comboService.deleteCombo(deleteModal.comboId);
      if (res.success) {
        toast.success('Combo draft deleted successfully.');
        setDeleteModal({ isOpen: false, comboId: null, comboName: '', deleting: false });
        fetchDashboardData();
      } else {
        toast.error(res.message || 'Failed to delete combo.');
        setDeleteModal(prev => ({ ...prev, deleting: false }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error deleting combo draft.');
      setDeleteModal(prev => ({ ...prev, deleting: false }));
    }
  };

  const getPriorityBadge = (score: number) => {
    const rounded = Math.round(score);
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          High ({rounded})
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Medium ({rounded})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        Low ({rounded})
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'APPROVED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'PENDING_APPROVAL':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CHANGES_REQUESTED':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <InventoryHeader />

        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight">AI Combo & Discount Suggester</h1>
          <p className="text-gray-500 text-sm mt-1">Classified inventory opportunities backed by consumer basket association metrics.</p>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={runningAnalysis}
          className="flex items-center gap-2 bg-[#103e2c] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#165a40] disabled:bg-gray-400 transition-all shadow-sm hover:scale-[1.02] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">{runningAnalysis ? 'sync' : 'auto_awesome'}</span>
          {runningAnalysis ? 'Executing AI Engine...' : 'Run AI Analysis'}
        </button>
      </div>

      {/* Admin Pending Approval Notification Banner */}
      {isAdmin && combos.some(c => c.status === 'PENDING_APPROVAL') && (
        <div className="bg-gradient-to-r from-emerald-950 via-[#103e2c] to-emerald-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between gap-4 border border-emerald-700/50 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/30">
              <span className="material-symbols-outlined text-[24px]">notifications_active</span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                {combos.filter(c => c.status === 'PENDING_APPROVAL').length} Combo Campaign(s) Pending Admin Approval
              </h4>
              <p className="text-xs text-emerald-200 mt-0.5">
                Review and click "Approve & Convert" below to activate the campaign and mark target opportunities as CONVERTED.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div 
          onClick={() => setFilterType(filterType === 'SLOW_MOVING' ? '' : 'SLOW_MOVING')}
          className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterType === 'SLOW_MOVING' ? 'bg-[#103e2c] text-white shadow-md border-transparent' : 'bg-white text-gray-800 border-gray-100 hover:shadow-md'}`}
        >
          <p className={`text-xs font-bold uppercase tracking-wider ${filterType === 'SLOW_MOVING' ? 'text-emerald-200' : 'text-gray-400'}`}>Slow-Moving</p>
          <h3 className="text-3xl font-black mt-2">{stats.slowMoving}</h3>
        </div>
        <div 
          onClick={() => setFilterType(filterType === 'DEAD_STOCK' ? '' : 'DEAD_STOCK')}
          className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterType === 'DEAD_STOCK' ? 'bg-[#103e2c] text-white shadow-md border-transparent' : 'bg-white text-gray-800 border-gray-100 hover:shadow-md'}`}
        >
          <p className={`text-xs font-bold uppercase tracking-wider ${filterType === 'DEAD_STOCK' ? 'text-emerald-200' : 'text-gray-400'}`}>Dead-Stock</p>
          <h3 className="text-3xl font-black mt-2">{stats.deadStock}</h3>
        </div>
        <div 
          onClick={() => setFilterType(filterType === 'NEAR_EXPIRY' ? '' : 'NEAR_EXPIRY')}
          className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterType === 'NEAR_EXPIRY' ? 'bg-[#103e2c] text-white shadow-md border-transparent' : 'bg-white text-gray-800 border-gray-100 hover:shadow-md'}`}
        >
          <p className={`text-xs font-bold uppercase tracking-wider ${filterType === 'NEAR_EXPIRY' ? 'text-emerald-200' : 'text-gray-400'}`}>Near-Expiry</p>
          <h3 className="text-3xl font-black mt-2">{stats.nearExpiry}</h3>
        </div>
        <div 
          onClick={() => setFilterType(filterType === 'OVERSTOCK' ? '' : 'OVERSTOCK')}
          className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterType === 'OVERSTOCK' ? 'bg-[#103e2c] text-white shadow-md border-transparent' : 'bg-white text-gray-800 border-gray-100 hover:shadow-md'}`}
        >
          <p className={`text-xs font-bold uppercase tracking-wider ${filterType === 'OVERSTOCK' ? 'text-emerald-200' : 'text-gray-400'}`}>Overstock</p>
          <h3 className="text-3xl font-black mt-2">{stats.overstock}</h3>
        </div>
        <div 
          onClick={() => setFilterType(filterType === 'SEASONAL' ? '' : 'SEASONAL')}
          className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterType === 'SEASONAL' ? 'bg-[#103e2c] text-white shadow-md border-transparent' : 'bg-white text-gray-800 border-gray-100 hover:shadow-md'}`}
        >
          <p className={`text-xs font-bold uppercase tracking-wider ${filterType === 'SEASONAL' ? 'text-emerald-200' : 'text-gray-400'}`}>Seasonal Excess</p>
          <h3 className="text-3xl font-black mt-2">{stats.seasonal}</h3>
        </div>
      </div>

      {/* Main Grid: Opportunities & Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
        {/* Left 2 Columns: Opportunities List */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[640px] space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Classified Inventory Opportunities</h2>
                <p className="text-xs text-gray-400 mt-0.5">Found {opportunities.length} target items ready for bundle clearance</p>
              </div>
              <div className="flex gap-2">
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg text-xs font-bold px-3 py-1.5 outline-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="UNCOVERED">Uncovered (0% in Combo)</option>
                  <option value="PARTIALLY_CONVERTED">Partially Converted (1-99%)</option>
                  <option value="FULLY_CONVERTED">Fully Converted (100%)</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-400">Loading opportunities...</div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-20 text-gray-400">No opportunities matches found. Run AI analysis.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                      <th className="py-3 px-2">Target Product</th>
                      <th className="py-3 px-2">Reason</th>
                      <th className="py-3 px-2 min-w-[200px]">Stock Clearance Progress</th>
                      <th className="py-3 px-2">Priority</th>
                      <th className="py-3 px-2 text-right">Clearance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedOpportunities.map((opp) => (
                      <tr 
                        key={opp.id} 
                        onClick={() => navigate(`/inventory-combo/opportunity/${opp.id}`)}
                        className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-2">
                          <p className="font-bold text-gray-900 line-clamp-1">{opp.targetProduct?.name || opp.targetProductName || opp.targetProductId}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{opp.targetProduct?.sku ? `SKU: ${opp.targetProduct.sku}` : opp.targetProductId}</p>
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="bg-gray-100 text-gray-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {opp.opportunityType}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 min-w-[200px]">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-gray-800">{opp.committedStock || 0} / {opp.targetExcessStock || opp.currentStock} Units in Combo</span>
                              <span className={`font-black text-[11px] ${opp.coveragePercentage >= 100 ? 'text-emerald-700' : opp.coveragePercentage > 0 ? 'text-teal-700' : 'text-gray-400'}`}>
                                {opp.coveragePercentage || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  opp.coveragePercentage >= 100 
                                    ? 'bg-emerald-500' 
                                    : opp.coveragePercentage > 0 
                                    ? 'bg-teal-500' 
                                    : 'bg-transparent'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(opp.coveragePercentage || 0, opp.committedStock > 0 ? 5 : 0))}%` }}
                              />
                            </div>
                            <p className="text-[10px]">
                              {(opp.remainingExcessStock || 0) > 0 ? (
                                <span className="text-amber-700 font-medium flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px] shrink-0 text-amber-600">warning</span>
                                  <span>{opp.remainingExcessStock} units remaining at risk</span>
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px] shrink-0 text-emerald-600">check_circle</span>
                                  <span>100% clearance covered</span>
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-2">
                          {getPriorityBadge(opp.priorityScore)}
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {opp.coveragePercentage >= 100 ? (
                              <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-lg shadow-xs">
                                <span className="material-symbols-outlined text-[13px]">verified</span>
                                <span>Fully Converted</span>
                              </div>
                            ) : opp.coveragePercentage > 0 ? (
                              <div className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-lg shadow-xs">
                                <span className="material-symbols-outlined text-[13px]">donut_large</span>
                                <span>{opp.coveragePercentage}% Converted</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-lg shadow-xs hover:bg-blue-100 transition-colors">
                                <span>Detected (0%)</span>
                                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {opportunities.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              <span>
                Showing <strong className="text-gray-800">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-gray-800">{Math.min(currentPage * pageSize, opportunities.length)}</strong> of{' '}
                <strong className="text-gray-800">{opportunities.length}</strong> opportunities
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#103e2c] text-white shadow-xs'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column: Created Campaigns */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[640px] space-y-4">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center pb-1">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Combo Campaigns</h2>
                <p className="text-xs text-gray-400 mt-0.5">{combos.length} total campaigns</p>
              </div>
              <button 
                onClick={() => navigate('/inventory-combo/builder')}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/60"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> Custom
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-400">Loading campaigns...</div>
            ) : combos.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No active combo campaigns drafted yet.</div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[520px] pr-1">
                {combos.map((combo) => (
                  <div 
                    key={combo.id}
                    onClick={() => navigate(`/inventory-combo/builder?id=${combo.id}`)}
                    className="p-3.5 rounded-xl border border-gray-100 hover:border-emerald-700/30 hover:shadow-sm cursor-pointer transition-all space-y-2.5 bg-gray-50/30 group"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 line-clamp-1 text-xs sm:text-sm">{combo.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{combo.comboCode}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getStatusBadge(combo.status)}`}>
                          {combo.status}
                        </span>
                        {(combo.status === 'DRAFT' || combo.status === 'REJECTED' || combo.status === 'CANCELLED' || combo.status === 'CHANGES_REQUESTED') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal({ isOpen: true, comboId: combo.id, comboName: combo.name, deleting: false });
                            }}
                            className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                            title="Delete combo draft"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Price: <strong>Rs. {combo.comboPrice.toFixed(0)}</strong></span>
                      <span>Margin: <strong className="text-emerald-800">{combo.expectedMarginPercentage.toFixed(1)}%</strong></span>
                    </div>

                    {isAdmin && combo.status === 'PENDING_APPROVAL' && (
                      <div className="pt-2 border-t border-gray-100 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleQuickReject(combo.id, e)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickApprove(combo.id, e)}
                          className="px-3 py-1 rounded-lg text-[10px] font-extrabold text-white bg-[#103e2c] hover:bg-[#165a40] transition-all shadow-sm cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                          Approve & Convert
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

{/* Sleek In-App Delete Confirmation Modal */}
{deleteModal.isOpen && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <span className="material-symbols-outlined text-[24px]">delete</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900">Delete Combo Draft</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Are you sure you want to permanently delete <strong className="text-gray-800">"{deleteModal.comboName}"</strong>? This action cannot be undone.
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          disabled={deleteModal.deleting}
          onClick={() => setDeleteModal({ isOpen: false, comboId: null, comboName: '', deleting: false })}
          className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={deleteModal.deleting}
          onClick={confirmDeleteCombo}
          className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          {deleteModal.deleting ? 'Deleting...' : 'Delete Draft'}
        </button>
      </div>
    </div>
  </div>
)}
</div>
  );
}
