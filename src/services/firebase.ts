import { OrderDetails, Advertisement } from '../types';
import { safeSetItem } from '../utils/safeStorage';
import { getAdminToken } from './starsApi';

const LOCAL_ORDERS_KEY = 'solo_stars_user_orders';
const LOCAL_AD_KEY = 'solo_stars_active_ad';

const DEFAULT_ADVERTISEMENT: Advertisement = {
  id: 'ad-welcome-1',
  title: "🔥 SOLO STARS: Telegram Stars & UC Super Chegirma!",
  description: "Eng arzon narxlarda 1 oylik Telegram Premium (48.100 so'm), Telegram Stars va PUBG Mobile UC rasmiy to'lov orqali tezkor yetkazib beriladi!",
  imageUrl: '/src/assets/images/solo_stars_hero_1790791988846.jpg',
  badgeText: 'Aksiya',
  buttonText: "Xarid Qilish",
  buttonUrl: '#shop',
  isActive: true,
  skipDurationSeconds: 3,
};

export async function saveOrderToFirebase(order: OrderDetails): Promise<void> {
  const existing = getLocalOrders();
  safeSetItem(LOCAL_ORDERS_KEY, JSON.stringify([order, ...existing.filter((o) => o.id !== order.id)].slice(0, 10)));
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    if (!r.ok) throw new Error(String(r.status));
  } catch (err) {
    console.warn('Buyurtma serverga yuborilmadi:', err);
    throw new Error("Buyurtmani yuborib bo'lmadi. Internetni tekshirib qayta urinib ko'ring.");
  }
}

export function getLocalOrders(): OrderDetails[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]'); } catch { return []; }
}

export async function updateOrderStatus(orderId: string, newStatus: OrderDetails['status'], extra?: Partial<OrderDetails>): Promise<void> {
  const r = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
    body: JSON.stringify({ status: newStatus, ...extra }),
  });
  if (!r.ok) console.warn('Holatni yangilab bo\'lmadi', r.status);
}

/** Admin: hamma buyurtmalar (server). Oddiy foydalanuvchi: faqat o'z buyurtmalari (statusi serverdan yangilanadi). */
export async function fetchUserOrders(usernameFilter?: string): Promise<OrderDetails[]> {
  let list = getLocalOrders();
  try {
    if (getAdminToken()) {
      const r = await fetch('/api/admin/orders', { headers: { 'x-admin-token': getAdminToken() } });
      if (r.ok) {
        const rows = await r.json();
        list = rows.map((d: any) => ({
          id: d.orderId, item: d.item, recipientUsername: d.recipientUsername, paymentMethod: d.paymentMethod || 'card',
          phoneNumber: d.phoneNumber || undefined, status: d.status || 'verifying', createdAt: d.createdAtStr || '',
          totalSum: d.totalSum || 0, receiptImageUrl: d.receiptImageUrl || undefined,
          apiDispatchStatus: d.apiDispatchStatus || undefined, apiResponseMsg: d.apiResponseMsg || undefined,
          reviewedByAdmin: !!d.reviewedByAdmin, coindropOrderId: d.coindropOrderId,
        }));
      }
    } else if (list.length) {
      const r = await fetch('/api/orders/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: list.map((o) => o.id) }) });
      if (r.ok) {
        const st = await r.json();
        list = list.map((o) => (st[o.id] ? { ...o, ...Object.fromEntries(Object.entries(st[o.id]).filter(([, v]) => v !== null)) } : o));
        safeSetItem(LOCAL_ORDERS_KEY, JSON.stringify(list));
      }
    }
  } catch (err) { console.warn('Server bilan aloqa yo\'q, lokal ro\'yxat:', err); }
  const q = usernameFilter?.trim().toLowerCase().replace(/^@/, '');
  return q ? list.filter((o) => o.recipientUsername.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : list;
}

/**
 * Advertisement storage
 */
export function getStoredAdvertisement(): Advertisement {
  if (typeof window === 'undefined') return DEFAULT_ADVERTISEMENT;
  try {
    const raw = localStorage.getItem(LOCAL_AD_KEY);
    if (!raw) return DEFAULT_ADVERTISEMENT;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ADVERTISEMENT;
  }
}

export function saveStoredAdvertisement(ad: Advertisement): void {
  safeSetItem(LOCAL_AD_KEY, JSON.stringify(ad));
}
