import { useEffect, useState, useMemo } from 'react';
import { comboService } from '../../services/comboService';
import { DiscountService } from '../../services/discountService';
import { Search } from 'lucide-react';

export default function CashierCombos() {
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPosCombos = async () => {
    try {
      setLoading(true);
      const [comboRes, discRes] = await Promise.all([
        comboService.getPosActiveCombos(),
        DiscountService.getDiscounts()
      ]);

      let all: any[] = [];
      const existingIds = new Set<string>();

      if (comboRes.success && Array.isArray(comboRes.data)) {
        all = [...comboRes.data];
        comboRes.data.forEach((c: any) => existingIds.add(c.id));
      }

      if (discRes.success && Array.isArray(discRes.data)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const mappedDiscounts = discRes.data
          .filter((d: any) => {
            if (d.type !== 'COMBO') return false;
            if (!d.isActive || d.approvalStatus !== 'APPROVED') return false;
            if (d.endDate && d.endDate < todayStr) return false;
            return !existingIds.has(d.id);
          })
          .map((d: any) => {
            const regularTotal = (d.comboItems || []).reduce((acc: number, item: any) => acc + (Number(item.sellingPrice || 0) * (Number(item.minQty) || 1)), 0);
            const comboPrice = d.comboPrice ? Number(d.comboPrice) : (regularTotal * (1 - (d.discountValue || 0) / 100));

            return {
              id: d.id,
              comboCode: d.label || `COMBO-${d.id.substring(0, 6).toUpperCase()}`,
              name: d.name,
              description: d.label ? `${d.name} (${d.label})` : `Store combo bundle (${d.discountValue}% OFF)`,
              comboType: 'STORE_BUNDLE',
              sourceSuggestionId: null,
              comboPrice,
              normalTotalPrice: regularTotal,
              discountPercentage: d.discountValue || 0,
              maximumQuantity: 100,
              soldQuantity: 0,
              startDate: d.startDate,
              endDate: d.endDate,
              items: (d.comboItems || []).map((item: any) => ({
                productId: item.productId,
                role: 'BUNDLE',
                quantity: item.minQty || 1,
                normalUnitPrice: item.sellingPrice || 0,
                product: {
                  name: item.productName || item.productId,
                  sku: item.productId
                }
              }))
            };
          });

        all = [...all, ...mappedDiscounts];
      }

      setCombos(all);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosCombos();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return combos.filter(c => {
      return !q || (
        c.name.toLowerCase().includes(q) || 
        c.comboCode.toLowerCase().includes(q) ||
        c.items.some((i: any) => (i.product?.name || '').toLowerCase().includes(q) || (i.product?.sku || '').toLowerCase().includes(q))
      );
    });
  }, [combos, search]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans text-gray-900 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            POS Active Combo Deals <span className="text-emerald-500">⚡</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Cashier lookup screen for active bundle discount codes and combo offers.</p>
        </div>

        {/* Search Filter */}
        <div className="w-full md:w-80 bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 pl-1" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search combo code, product..."
            className="w-full text-xs font-bold outline-none bg-transparent py-1.5"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <div className="bg-[#103e2c] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
          All Active Combos ({combos.length})
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 font-bold text-xs">Loading active cashier offers...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] text-gray-400 font-bold text-xs">
          No matching active combo promotions found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((combo) => {
            return (
              <div key={combo.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200 mb-1">
                      Combo Offer
                    </span>
                    <h3 className="font-extrabold text-gray-900 leading-snug text-sm">{combo.name}</h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase font-bold">CODE: {combo.comboCode}</p>
                  </div>
                  <span className="bg-emerald-800 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-xs">
                    {combo.discountPercentage.toFixed(0)}% OFF
                  </span>
                </div>

                {/* Items details */}
                <div className="space-y-2 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Required Items</p>
                  {combo.items.map((item: any, idx: number) => (
                    <div key={idx} className="text-xs flex justify-between items-baseline font-semibold text-gray-700">
                      <span className="line-clamp-1 w-2/3">• {item.quantity}x {item.product?.name || item.productId}</span>
                      <span className="text-gray-400 font-mono text-[10px]">({item.product?.sku})</span>
                    </div>
                  ))}
                </div>

                {/* Pricing detail */}
                <div className="flex justify-between items-end pt-2 border-t border-gray-100">
                  <div>
                    <span className="text-gray-400 line-through text-xs font-semibold">Rs. {combo.normalTotalPrice.toFixed(0)}</span>
                    <p className="text-lg font-black text-emerald-800">Rs. {combo.comboPrice.toFixed(0)}</p>
                  </div>
                  <div className="text-right text-[10px] text-gray-400 font-bold">
                    Ends: {new Date(combo.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
