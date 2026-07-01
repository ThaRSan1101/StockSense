import React from 'react';
import { FileText, ShoppingCart } from 'lucide-react';

interface DraftBillsTabProps {
  draftBills: any[];
  restoreDraftBill: (id: string) => void;
}

export const DraftBillsTab: React.FC<DraftBillsTabProps> = ({
  draftBills,
  restoreDraftBill
}) => {
  return (
    <div className="flex-1 bg-[#f8f9fc] p-6 lg:p-8 flex flex-col items-center overflow-hidden h-screen">
      <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 w-full max-w-5xl flex flex-col overflow-hidden h-full">
        <div className="p-8 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Draft Bills</h2>
            <p className="text-sm text-gray-500 font-medium">Restore bills that were put on hold</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
          {draftBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FileText className="w-16 h-16 opacity-20 mb-4" />
              <p className="font-medium text-lg text-gray-500">No Draft Bills on Hold</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {draftBills.map((draft, index) => {
                const draftDate = new Date(draft.createdAt);
                return (
                  <div key={draft.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Token #{index + 1}</h3>
                        <p className="text-xs text-gray-500 font-semibold mt-1">{draft.billNumber}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{draftDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className="bg-orange-50 text-orange-700 font-bold text-xs px-2 py-1 rounded">Hold</span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Items</span>
                        <span className="text-gray-900 font-bold">{draft.totalQty} items</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Est. Value</span>
                        <span className="text-[#047857] font-bold">Rs. {draft.totalBill.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => restoreDraftBill(draft.id)}
                      className="w-full bg-orange-100 hover:bg-orange-200 text-orange-800 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" /> Move to Cart
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
