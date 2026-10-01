import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config({ path: ['.env.local', '.env'] });

let fdb: ReturnType<typeof getFirestore> | null = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    fdb = getFirestore();
  }
} catch (e) { console.error('Firebase admin xatosi:', e); }
const needDb: express.RequestHandler = (_q, res, next) => {
  if (!fdb) { res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT sozlanmagan' }); return; }
  next();
};

const app = express();
app.use(express.json({ limit: '4mb' }));

const COINDROP_BASE = process.env.COINDROP_BASE_URL || 'https://coindrop.uz/api/v1';
const COINDROP_KEY = process.env.COINDROP_API_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// --- oddiy admin token (HMAC) ---
const sign = (exp: number) =>
  `${exp}.${crypto.createHmac('sha256', SESSION_SECRET).update(String(exp)).digest('hex')}`;
const verify = (t?: string) => {
  if (!t) return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(Number(exp)).split('.')[1];
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
};
const requireAdmin: express.RequestHandler = (req, res, next) => {
  if (!verify(req.header('x-admin-token') || undefined)) {
    res.status(401).json({ error: 'Admin ruxsati kerak' });
    return;
  }
  next();
};

const attempts = new Map<string, { n: number; t: number }>();
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'x';
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60_000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 5) { res.status(429).json({ error: "Juda ko'p urinish. 15 daqiqadan so'ng urining." }); return; }
  if (!ADMIN_PASSWORD) { res.status(500).json({ error: 'ADMIN_PASSWORD serverda sozlanmagan' }); return; }
  const ok = typeof req.body?.password === 'string' &&
    req.body.password.length === ADMIN_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(req.body.password), Buffer.from(ADMIN_PASSWORD));
  if (!ok) { a.n++; attempts.set(ip, a); res.status(401).json({ error: "Parol noto'g'ri" }); return; }
  attempts.delete(ip);
  res.json({ token: sign(Date.now() + 8 * 3600_000) });
});

// --- Buyurtmalar (Firestore faqat server orqali) ---
const PUBLIC_FIELDS = ['status', 'apiResponseMsg', 'apiDispatchStatus'];
app.post('/api/orders', needDb, async (req, res) => {
  const o = req.body || {};
  if (!/^SS-\d{6}$/.test(o.id) || !o.item || typeof o.recipientUsername !== 'string' || o.recipientUsername.length > 64) {
    res.status(400).json({ error: "Noto'g'ri buyurtma" }); return;
  }
  const ref = fdb!.collection('orders').doc(o.id);
  if ((await ref.get()).exists) { res.status(409).json({ error: 'Buyurtma allaqachon bor' }); return; }
  await ref.set({
    orderId: o.id, item: o.item, recipientUsername: o.recipientUsername.trim(),
    paymentMethod: 'card', phoneNumber: o.phoneNumber || null, status: 'verifying',
    createdAtStr: String(o.createdAt || ''), totalSum: Number(o.item.price) || 0,
    receiptImageUrl: typeof o.receiptImageUrl === 'string' ? o.receiptImageUrl.slice(0, 3_000_000) : null,
    apiResponseMsg: o.apiResponseMsg || null, timestamp: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true });
});
app.post('/api/orders/status', needDb, async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 10).filter((i: unknown) => typeof i === 'string') : [];
  const out: Record<string, Record<string, unknown>> = {};
  for (const id of ids) {
    const d = await fdb!.collection('orders').doc(id).get();
    if (d.exists) { const x = d.data()!; out[id] = Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, x[k] ?? null])); }
  }
  res.json(out);
});
app.get('/api/admin/orders', requireAdmin, needDb, async (_req, res) => {
  const snap = await fdb!.collection('orders').orderBy('timestamp', 'desc').limit(100).get();
  res.json(snap.docs.map((d) => { const { timestamp, ...x } = d.data(); return x; }));
});
app.post('/api/admin/orders/:id/status', requireAdmin, needDb, async (req, res) => {
  const { status, ...extra } = req.body || {};
  const allowed = ['status', 'apiResponseMsg', 'apiDispatchStatus', 'coindropOrderId', 'retryCount'];
  const upd: Record<string, unknown> = { status, reviewedByAdmin: true };
  for (const k of allowed) if (k in extra) upd[k] = extra[k] ?? null;
  await fdb!.collection('orders').doc(req.params.id).set(upd, { merge: true });
  res.json({ ok: true });
});

// --- CoinDrop proksi (kalit faqat serverda) ---
app.get('/api/coindrop/balance', requireAdmin, async (_req, res) => {
  if (!COINDROP_KEY) { res.status(503).json({ error: 'COINDROP_API_KEY sozlanmagan' }); return; }
  try {
    const r = await fetch(`${COINDROP_BASE}/balance`, {
      headers: { 'X-API-Key': COINDROP_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    res.status(504).json({ error: 'CoinDrop javob bermadi' });
  }
});

const PUBG_KEY = process.env.COINDROP_PUBG_GAME_KEY || 'pubg-mobile';
/** PUBG product_id CoinDrop'da noaniq raqam (masalan "12345"): mahsulotlar ro'yxatidan "60 UC" nomi bo'yicha topiladi */
async function resolvePubgProduct(uc: number): Promise<string | null> {
  const r = await fetch(`${COINDROP_BASE}/games/${PUBG_KEY}/products`, {
    headers: { 'X-API-Key': COINDROP_KEY }, signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return null;
  const d: any = await r.json().catch(() => null);
  const list: any[] = Array.isArray(d) ? d : d?.products || d?.data || d?.items || [];
  const re = new RegExp(`^\\s*${uc}\\s*UC\\b`, 'i');
  const p = list.find((x) => re.test(String(x.name ?? x.title ?? x.product_name ?? '')));
  return p ? String(p.id ?? p.product_id) : null;
}

app.post('/api/coindrop/orders', requireAdmin, async (req, res) => {
  if (!COINDROP_KEY) { res.status(503).json({ detail: 'COINDROP_API_KEY sozlanmagan' }); return; }
  try {
    const body = { ...req.body };
    if (body.uc) {
      const pid = await resolvePubgProduct(Number(body.uc));
      if (!pid) { res.status(404).json({ detail: `PUBG ${body.uc} UC mahsuloti CoinDrop ro'yxatida topilmadi` }); return; }
      body.product_id = pid; body.game_key = PUBG_KEY; delete body.uc;
    }
    const r = await fetch(`${COINDROP_BASE}/orders`, {
      method: 'POST',
      headers: { 'X-API-Key': COINDROP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(50000), // CoinDrop ~30s gacha bajaradi
    });
    res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    res.status(504).json({ detail: 'CoinDrop javob bermadi (buyurtma yetkazilgan bo\'lishi mumkin — CoinDrop panelida tekshiring)' });
  }
});

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, coindropKey: !!COINDROP_KEY, adminPassword: !!ADMIN_PASSWORD, firebase: !!fdb }));

async function start() {
  const port = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve('dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => console.log(`SOLO STARS: http://localhost:${port}`));
}
start();
