import React from 'react';
import { Download, Filter, FileText, Banknote, Receipt, ChevronRight } from 'lucide-react';

interface OrdersTabProps {
  completedOrders: any[];
  statusFilter: 'ALL' | 'COMPLETED' | 'REFUNDED';
  setStatusFilter: (filter: 'ALL' | 'COMPLETED' | 'REFUNDED') => void;
  selectedOrder: any | null;
  setSelectedOrder: (order: any | null) => void;
  handlePrint: (order: any) => void;
  setShowRefundModal: (show: boolean) => void;
  setRefundQuantities: (quantities: any) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  completedOrders,
  statusFilter,
  setStatusFilter,
  selectedOrder,
  setSelectedOrder,
  handlePrint,
  setShowRefundModal,
  setRefundQuantities
}) => {
  const totalOrdersCount = completedOrders.length;
  const netSales = completedOrders.reduce((sum, o) => sum + o.totalBill, 0);
  const cashPayments = completedOrders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.totalBill, 0);
  const avgTicket = totalOrdersCount > 0 ? netSales / totalOrdersCount : 0;

  const filteredCompletedOrders = completedOrders.filter(order => {
    const hasRefund = order.refunds && order.refunds.length > 0;
    if (statusFilter === 'COMPLETED') return !hasRefund;
    if (statusFilter === 'REFUNDED') return hasRefund;
    return true;
  });

  return (
    <div className="flex-1 flex bg-[#f8f9fc] overflow-hidden h-screen">
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Order History</h1>
            <p className="text-gray-500 mt-2 font-medium">Today • {totalOrdersCount} Transactions</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-gray-300 rounded-xl pl-4 pr-10 py-2 text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer appearance-none hover:bg-gray-50 transition-colors"
              >
                <option value="ALL">All Orders</option>
                <option value="COMPLETED">Completed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-gray-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 tracking-wider mb-2">NET SALES</p>
            <h2 className="text-3xl font-extrabold text-[#166534]">Rs. {netSales.toFixed(2)}</h2>
            <p className="text-xs text-green-600 font-semibold mt-2 flex items-center">
              <span className="mr-1">↗</span> Live from Database
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 tracking-wider mb-2">TOTAL ORDERS</p>
            <h2 className="text-3xl font-extrabold text-gray-900">{totalOrdersCount}</h2>
            <p className="text-xs text-gray-500 font-semibold mt-2 flex items-center">
              <FileText className="w-3 h-3 mr-1" /> Average Rs. {avgTicket.toFixed(2)}/ticket
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 tracking-wider mb-2">CASH PAYMENTS</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Rs. {cashPayments.toFixed(2)}</h2>
            <p className="text-xs text-gray-500 font-semibold mt-2 flex items-center">
              <Banknote className="w-3 h-3 mr-1" /> Payment Type breakdown
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8f9fc] border-b border-gray-200 text-gray-500 font-bold text-xs">
              <tr>
                <th className="py-4 px-6">ORDER ID</th>
                <th className="py-4 px-6">TIME</th>
                <th className="py-4 px-6">ITEMS</th>
                <th className="py-4 px-6">METHOD</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCompletedOrders.map(order => {
                const orderDate = new Date(order.createdAt);
                const isRefunded = order.refunds && order.refunds.length > 0;
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'bg-[#f0fdf4]' : ''}`}
                  >
                    <td className="py-4 px-6 font-bold text-gray-900">{order.billNumber}</td>
                    <td className="py-4 px-6 text-gray-500 font-medium">
                      {orderDate.toLocaleDateString()} {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-medium">{order.totalQty} {order.totalQty === 1 ? 'Item' : 'Items'}</td>
                    <td className="py-4 px-6 font-semibold text-gray-500">{order.paymentMethod}</td>
                    <td className="py-4 px-6">
                      {isRefunded ? (
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Refunded
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-extrabold text-lg text-gray-900">
                      Rs. {order.totalBill.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-4 text-center border-t border-gray-100 bg-[#f8f9fc]">
            <button className="text-sm font-bold text-[#166534] hover:underline">Load older transactions</button>
          </div>
        </div>
      </div>

      {/* Right Details Panel */}
      {selectedOrder && (
        <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-2xl font-extrabold text-gray-900">Order {selectedOrder.billNumber}</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {new Date(selectedOrder.createdAt).toLocaleDateString()} {new Date(selectedOrder.createdAt).toLocaleTimeString()} • Counter 1
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-8 bg-[#f8f9fc]">
            {/* Receipt Preview */}
            <div className="bg-white border border-gray-200 rounded shadow-sm mx-auto max-w-[340px] p-6 flex flex-col font-mono text-[13px] text-black leading-snug">
              <div className="text-center mb-5 space-y-0.5">
                <div className="font-bold text-base">Sales Receipt</div>
                <div className="font-bold text-base">CHAMSON MULTI SHOP</div>
                <div>Hospital road, Mannar</div>
                <div>0774847867</div>
              </div>

              <div className="mb-2 space-y-0.5">
                <div>Receipt {selectedOrder.billNumber}</div>
                <div>Date: {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')} {new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div>Cashier: {selectedOrder.cashier?.name || 'POS System'}</div>
              </div>

              {selectedOrder.refunds && selectedOrder.refunds.length > 0 && (
                <div className="text-center my-2 bg-amber-50 text-amber-800 font-bold border border-dashed border-amber-300 py-1.5 rounded uppercase text-[10px] tracking-wider font-sans">
                  *** REFUNDED ***
                  {selectedOrder.refunds.map((r: any, idx: number) => (
                    <div key={idx} className="text-[9px] font-semibold text-amber-700 capitalize mt-0.5">
                      Rs. {r.refundAmount.toFixed(2)} returned
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex font-bold pb-1 text-[11px]">
                <div className="flex-1">Item</div>
                <div className="w-8 text-right">Qty</div>
                <div className="w-12 text-right">Price</div>
                <div className="w-12 text-right">Disc.</div>
                <div className="w-12 text-right">Total</div>
              </div>

              {(() => {
                const returnedQtyMap: Record<string, number> = {};
                selectedOrder.refunds?.forEach((r: any) => {
                  r.refundItems?.forEach((ri: any) => {
                    returnedQtyMap[ri.sku] = (returnedQtyMap[ri.sku] || 0) + ri.qty;
                  });
                });

                return selectedOrder.billItems?.map((item: any) => {
                  const itemTotal = item.qty * item.unitPrice;
                  const itemDiscount = itemTotal - item.total;
                  const returnedQty = returnedQtyMap[item.sku] || 0;
                  const netQty = item.qty - returnedQty;

                  return (
                    <div key={item.id} className="flex flex-col pb-1.5 text-[11px]">
                      <div className="flex">
                        <div className="flex-1 truncate pr-1">{item.product?.name || item.sku}</div>
                        <div className="w-8 text-right">
                          {returnedQty > 0 ? `${netQty} (${item.qty})` : item.qty}
                        </div>
                        <div className="w-12 text-right">Rs. {item.unitPrice.toFixed(2)}</div>
                        <div className="w-12 text-right">Rs. {itemDiscount.toFixed(2)}</div>
                        <div className="w-12 text-right">Rs. {item.total.toFixed(2)}</div>
                      </div>
                      {returnedQty > 0 && (
                        <div className="text-[10px] text-amber-700 font-semibold italic pl-2">
                          * Returned: {returnedQty} unit(s)
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {selectedOrder.subtotal.toFixed(2)}</span>
              </div>
              {selectedOrder.totalDiscount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-Rs. {selectedOrder.totalDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>Rs. {selectedOrder.totalBill.toFixed(2)}</span>
              </div>

              <div className="border-t border-dashed border-black my-2"></div>

              <div className="flex justify-between">
                <span>Paid Amount:</span>
                <span>Rs. {selectedOrder.paidAmount !== null && selectedOrder.paidAmount !== undefined ? selectedOrder.paidAmount.toFixed(2) : selectedOrder.totalBill.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span>Rs. {selectedOrder.changeAmount !== null && selectedOrder.changeAmount !== undefined ? selectedOrder.changeAmount.toFixed(2) : '0.00'}</span>
              </div>

              <div className="text-center mt-6">
                Thank You Come Again!
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-gray-200 bg-white space-y-3">
            <button 
              onClick={() => handlePrint(selectedOrder)}
              className="w-full py-3 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center transition-colors"
            >
              <Receipt className="w-5 h-5 mr-2" /> Print Receipt
            </button>
            <button
              onClick={() => {
                setRefundQuantities({});
                setShowRefundModal(true);
              }}
              className="w-full py-4 bg-[#111827] text-white rounded-xl font-bold hover:bg-black flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5 mr-2 rotate-180" /> Refund Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
