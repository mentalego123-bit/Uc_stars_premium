import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Send,
  ArrowLeft,
  Flame,
  Cloud,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Wallet,
  PlusCircle
} from 'lucide-react';
import { OrderDetails } from '../types';
import { fetchUserOrders, updateOrderStatus } from '../services/firebase';
import { getUserWalletBalance } from '../services/walletService';
import { ADMIN_TELEGRAM_USERNAME } from '../data/products';
import { sfx } from '../utils/sfx';
import { SpendingChart } from './SpendingChart';

interface MyOrdersViewProps {
  onBackToShop: () => void;
  onOpenReceipt: (order: OrderDetails) => void;
  onOpenAdminModal: () => void;
  onOpenTopUpModal?: () => void;
}

export const MyOrdersView: React.FC<MyOrdersViewProps> = ({
  onBackToShop,
  onOpenReceipt,
  onOpenAdminModal,
  onOpenTopUpModal,
}) => {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verifying' | 'processing' | 'admin' | 'stuck' | 'completed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const userBalance = getUserWalletBalance();

  const loadOrders = async (queryText?: string) => {
    setLoading(true);
    try {
      const data = await fetchUserOrders(queryText);
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleRefresh = () => {
    sfx.playSelect();
    loadOrders(searchQuery);
  };

  const handleRetryApi = async (_order: OrderDetails) => {
    // Foydalanuvchi API ni chaqira olmaydi: faqat holat yangilanadi
    setRetryingId(_order.id);
    sfx.playSelect();
    await loadOrders(searchQuery);
    setRetryingId(null);
  };

  const handleCopyReceipt = (order: OrderDetails) => {
    const text = `★ SOLO STARS XARID CHEKI ★\nOrder ID: ${order.id}\nMahsulot: ${order.item.title}\nNarxi: ${order.item.formattedPrice}\nQabul qiluvchi: ${order.recipientUsername}\nHolati: ${order.status}\nVaqti: ${order.createdAt}`;
    navigator.clipboard.writeText(text);
    setCopiedId(order.id);
    sfx.playSuccess();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'verifying' && o.status !== 'verifying') return false;
    if (statusFilter === 'processing' && o.status !== 'processing') return false;
    if (statusFilter === 'admin' && o.status !== 'admin_action_required') return false;
    if (statusFilter === 'stuck' && o.status !== 'api_stuck') return false;
    if (statusFilter === 'completed' && o.status !== 'completed') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace(/^@/, '');
    return (
      o.recipientUsername.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.item.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner with Balance and Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.playSelect();
              onBackToShop();
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Do'kon</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight flex items-center gap-2">
              <span>Mening Buyurtmalarim</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                {filteredOrders.length} ta
              </span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firebase Cloud & CoinDrop API</span>
            </div>
          </div>
        </div>

        {/* User Balance Box + Topup Button */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="px-3.5 py-2 rounded-2xl bg-black/50 border border-amber-500/30 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            <div className="text-left text-xs">
              <span className="text-[10px] text-slate-400 block">Balansingiz:</span>
              <span className="font-bold text-amber-300 font-display">
                {userBalance.toLocaleString('uz-UZ')} so'm
              </span>
            </div>
          </div>

          {onOpenTopUpModal && (
            <button
              onClick={() => {
                sfx.playSelect();
                onOpenTopUpModal();
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-black text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>To'ldirish</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 30-Day Spending History Visualization using Recharts */}
      <SpendingChart orders={orders} />

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 overflow-x-auto">
          {[
            { id: 'all' as const, label: 'Barchasi' },
            { id: 'verifying' as const, label: 'Tekshirilmoqda' },
            { id: 'stuck' as const, label: 'API Qotgan' },
            { id: 'admin' as const, label: 'Admin Bilan' },
            { id: 'completed' as const, label: 'Bajarilgan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                sfx.playSelect();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Username yoki Order ID bo'yicha..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-mono">Buyurtmalar yuklanmoqda...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const isVerifying = order.status === 'verifying';
            const isStuck = order.status === 'api_stuck';
            const is1MonthAdmin = order.status === 'admin_action_required' || order.item.requiresAdmin;
            const isDone = order.status === 'completed';
            const isRetrying = retryingId === order.id;

            return (
              <div
                key={order.id}
                className={`relative rounded-2xl p-5 transition-all shadow-md overflow-hidden flex flex-col justify-between group ${
                  isVerifying
                    ? 'bg-slate-900/90 border-2 border-amber-500/50'
                    : isStuck
                    ? 'bg-red-950/20 border-2 border-red-500/50'
                    : 'bg-slate-900/80 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Shimmer animation bar if verifying */}
                {isVerifying && (
                  <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-40" />
                )}

                <div className="relative z-10">
                  {/* Top line: ID and status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      ID: <span className="text-cyan-400">{order.id}</span>
                    </span>

                    {/* Status Badge with Visual Animation */}
                    {isVerifying ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        <span>Tekshirilmoqda</span>
                      </span>
                    ) : isStuck ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-500/25 text-red-300 border border-red-500/50">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span>API Qotib Qoldi</span>
                      </span>
                    ) : is1MonthAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Flame className="w-3 h-3 text-amber-400 animate-flame-pulse" />
                        <span>Admin javobini kuting</span>
                      </span>
                    ) : isDone ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Bajarildi</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <Clock className="w-3 h-3 text-cyan-400 animate-spin" />
                        <span>Bajarilmoqda</span>
                      </span>
                    )}
                  </div>

                  {/* Product title and price */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                        {order.item.title}
                      </h3>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Qabul qiluvchi: <span className="text-amber-400 font-mono font-semibold">{order.recipientUsername}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-cyan-400 font-display">
                        {order.item.formattedPrice}
                      </div>
                      <div className="text-[10px] uppercase font-mono text-slate-500">
                        {order.paymentMethod === 'balance' ? 'Balansdan' : 'Karta (9860)'}
                      </div>
                    </div>
                  </div>

                  {/* API response message if any */}
                  {order.apiResponseMsg && (
                    <div className="mt-2.5 p-2 rounded-xl bg-black/40 border border-slate-800 text-xs text-slate-300 font-mono">
                      <span>ℹ {order.apiResponseMsg}</span>
                    </div>
                  )}

                  {/* Timestamp & info */}
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span>Vaqti: {order.createdAt}</span>
                    {order.receiptImageUrl && (
                      <span className="text-cyan-400 font-semibold">✓ Chek yuklangan</span>
                    )}
                  </div>
                </div>

                {/* Actions: Retry button if stuck */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-2 relative z-10">
                  {/* If API is stuck or in verifying, provide "Qayta Tekshirish" button */}
                  {(isStuck || isVerifying) && (
                    <button
                      onClick={() => handleRetryApi(order)}
                      disabled={isRetrying}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 hover:from-red-500 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                      <span>{isRetrying ? 'Tekshirilmoqda...' : 'Holatni yangilash'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenReceipt(order)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer text-center"
                  >
                    Chek
                  </button>

                  <button
                    onClick={() => handleCopyReceipt(order)}
                    title="Chekni nusxalash"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedId === order.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <a
                    href={`https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(
                      `Salom admin, buyurtmam statusini tekshirmoqchiman:\nID: ${order.id}\nMahsulot: ${order.item.title}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sfx.playFireWhoosh()}
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Adminga</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Buyurtmalar topilmadi</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mt-1">
            Ushbu filtr bo'yicha hech qanday buyurtma mavjud emas.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={onBackToShop}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 transition-all shadow-lg cursor-pointer"
            >
              Do'konga O'tish
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
