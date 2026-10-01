import { OrderDetails } from '../types';

const TOKEN_KEY = 'solo_admin_token';

export const getAdminToken = () => sessionStorage.getItem(TOKEN_KEY) || '';
export const setAdminToken = (t: string) => sessionStorage.setItem(TOKEN_KEY, t);
export const clearAdminToken = () => sessionStorage.removeItem(TOKEN_KEY);

export async function adminLogin(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) { setAdminToken(data.token); return { ok: true }; }
    return { ok: false, error: data.error || "Parol noto'g'ri" };
  } catch {
    return { ok: false, error: 'Serverga ulanib bo\'lmadi' };
  }
}

export interface DispatchResult {
  success: boolean;
  status: 'dispatched' | 'processing' | 'insufficient_funds' | 'stuck' | 'error';
  message: string;
  orderId?: number | string;
  amountUsd?: number;
}

const authHeaders = () => ({ 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() });

/** Haqiqiy CoinDrop balansi (faqat admin). Soxta/keshlangan qiymat yo'q. */
export async function fetchCoinDropLiveBalance(): Promise<{ balanceUsd: number | null; error?: string }> {
  try {
    const res = await fetch('/api/coindrop/balance', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { balanceUsd: null, error: 'Admin sessiyasi tugagan — qayta kiring' };
    if (!res.ok) return { balanceUsd: null, error: data.detail || data.error || `Xato ${res.status}` };
    const bal = Number(data.balance ?? data.balance_usd ?? data.amount_usd ?? data.account?.balance ?? data.account?.balance_usd);
    return Number.isFinite(bal) ? { balanceUsd: bal } : { balanceUsd: null, error: "Balans javobi noto'g'ri" };
  } catch {
    return { balanceUsd: null, error: 'API ga ulanib bo\'lmadi' };
  }
}

function buildPayload(order: OrderDetails) {
  const player_id = order.recipientUsername.replace(/^@/, '').trim();
  const external_ref = order.id; // takroriy yuborishdan himoya
  if (order.item.category === 'stars')
    return { game_key: 'telegram-stars', amount: order.item.quantity, player_id, external_ref };
  if (order.item.category === 'premium') {
    const map: Record<string, string> = { '3 Months': 'prem_3m', '6 Months': 'prem_6m', '12 Months': 'prem_12m' };
    return { game_key: 'telegram-premium', product_id: map[order.item.title], player_id, external_ref };
  }
  return { game_key: 'pubg-mobile', uc: order.item.quantity, player_id, external_ref };
}

/** Buyurtmani CoinDrop orqali yuborish. Faqat admin tasdiqlagandan keyin chaqiriladi. Hech qachon soxta muvaffaqiyat qaytarmaydi. */
export async function dispatchOrderViaApi(order: OrderDetails): Promise<DispatchResult> {
  const payload = buildPayload(order);
  if (order.item.category === 'premium' && !(payload as any).product_id)
    return { success: false, status: 'error', message: "Bu mahsulot API orqali yuborilmaydi — qo'lda bajaring." };
  try {
    const res = await fetch('/api/coindrop/orders', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const detail = String(data.detail || data.error || data.message || '');
    if (res.status === 401) return { success: false, status: 'error', message: 'Admin sessiyasi tugagan — qayta kiring' };
    if (res.ok) {
      const st = String(data.status || '').toLowerCase();
      if (st === 'delivered')
        return { success: true, status: 'dispatched', message: data.message || 'API orqali yetkazildi', orderId: data.order_id, amountUsd: data.amount_usd };
      if (st === 'failed')
        return { success: false, status: 'error', message: `CoinDrop bajara olmadi: ${detail || 'failed'}` };
      // processing/pending: hali yetkazilmagan — "bajarildi" deb belgilanmaydi
      return { success: false, status: 'processing', message: `CoinDrop buyurtmasi #${data.order_id ?? '?'} jarayonda (${st || 'noma\'lum'}). CoinDrop panelida tekshiring.`, orderId: data.order_id };
    }
    if (res.status === 422 && /balance/i.test(detail))
      return { success: false, status: 'insufficient_funds', message: "CoinDrop balansida mablag' yetarli emas — qo'lda bajaring." };
    if (res.status === 429) return { success: false, status: 'stuck', message: `CoinDrop so'rov limiti: ${detail}` };
    if (res.status === 503 || res.status === 504) return { success: false, status: 'stuck', message: detail || "API ishlamayapti — qo'lda bajaring." };
    return { success: false, status: 'error', message: detail || `API xatosi (${res.status})` };
  } catch {
    return { success: false, status: 'stuck', message: "API ga ulanib bo'lmadi — qayta urinib ko'ring yoki qo'lda bajaring." };
  }
}
