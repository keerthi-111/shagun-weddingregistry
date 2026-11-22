// Shagun — a wedding gift registry for India. Zero-dependency Node server (Node 18+).
// Run: node server.js  → http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');

// ---------- tiny JSON "database" ----------
function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: [], sessions: {}, registries: [], items: [], gifts: [] }; }
}
let db = loadDb();
function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
const id = () => crypto.randomBytes(8).toString('hex');

// ---------- helpers ----------
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(h, 'hex'));
}
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object';
  res.writeHead(status, { 'Content-Type': isObj ? 'application/json' : 'text/plain', ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); } });
  });
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => {
    const i = c.indexOf('='); return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
}
function currentUser(req) {
  const uid = db.sessions[cookies(req).sid];
  return db.users.find(u => u.id === uid) || null;
}
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const rupees = v => Math.max(0, Math.round(Number(v) || 0));
function slugify(s) {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'registry';
  let slug = base, n = 2;
  while (db.registries.some(r => r.slug === slug)) slug = `${base}-${n++}`;
  return slug;
}
function itemStats(item) {
  const gifts = db.gifts.filter(g => g.itemId === item.id);
  const raised = gifts.reduce((s, g) => s + (g.amount || 0), 0);
  const claimed = gifts.filter(g => g.type === 'purchase').reduce((s, g) => s + (g.qty || 1), 0);
  return { raised, claimed, contributors: gifts.length };
}
function publicRegistry(reg, forOwner) {
  const items = db.items.filter(i => i.registryId === reg.id).sort((a, b) => a.order - b.order)
    .map(i => ({ ...i, ...itemStats(i) }));
  const out = { ...reg, items };
  if (forOwner) out.gifts = db.gifts.filter(g => g.registryId === reg.id).sort((a, b) => b.createdAt - a.createdAt);
  else delete out.address; // never expose the delivery address publicly
  return out;
}

// ---------- product link preview (best effort) ----------
async function isPublicHost(hostname) {
  try {
    const { address } = await dns.lookup(hostname);
    if (net.isIPv4(address)) {
      const [a, b] = address.split('.').map(Number);
      return !(a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254));
    }
    return !(address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80'));
  } catch { return false; }
}
function meta(html, ...keys) {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const val = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (val) return val.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  }
  return '';
}
async function previewLink(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('That does not look like a link'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) links are supported');
  if (!(await isPublicHost(u.hostname))) throw new Error('That link is not reachable');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9' } });
    const html = (await r.text()).slice(0, 600000);
    const title = meta(html, 'og:title', 'twitter:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    const image = meta(html, 'og:image', 'og:image:secure_url', 'twitter:image');
    let price = meta(html, 'product:price:amount', 'og:price:amount', 'price');
    if (!price) price = html.match(/"price"\s*:\s*"?([\d,.]+)"?/)?.[1] || '';
    return { title: title.slice(0, 200), image, price: rupees(String(price).replace(/,/g, '')), store: u.hostname.replace(/^www\./, '') };
  } finally { clearTimeout(t); }
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  const user = currentUser(req);
  const body = ['POST', 'PUT', 'PATCH'].includes(m) ? await readBody(req) : {};
  const need = () => { if (!user) { send(res, 401, { error: 'Please log in' }); return false; } return true; };
  const ownReg = () => db.registries.find(r => r.ownerId === user?.id);

  // auth
  if (p === '/api/signup' && m === 'POST') {
    const email = str(body.email, 120).toLowerCase(), name = str(body.name, 80);
    if (!email.includes('@') || str(body.password).length < 6 || !name) return send(res, 400, { error: 'Name, valid email and a 6+ character password are needed' });
    if (db.users.some(u => u.email === email)) return send(res, 409, { error: 'An account with this email exists — log in instead' });
    const u = { id: id(), email, name, pw: hashPw(str(body.password)), createdAt: Date.now() };
    db.users.push(u);
    const sid = id() + id(); db.sessions[sid] = u.id; save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000` });
  }
  if (p === '/api/login' && m === 'POST') {
    const u = db.users.find(x => x.email === str(body.email).toLowerCase());
    if (!u || !checkPw(str(body.password), u.pw)) return send(res, 401, { error: 'Email or password is wrong' });
    const sid = id() + id(); db.sessions[sid] = u.id; save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000` });
  }
  if (p === '/api/logout' && m === 'POST') {
    delete db.sessions[cookies(req).sid]; save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  }
  if (p === '/api/me' && m === 'GET') {
    if (!user) return send(res, 200, { user: null });
    const reg = ownReg();
    return send(res, 200, { user: { name: user.name, email: user.email }, registry: reg ? publicRegistry(reg, true) : null });
  }

  // couple: registry
  if (p === '/api/registry' && (m === 'POST' || m === 'PUT')) {
    if (!need()) return;
    let reg = ownReg();
    const fields = {
      partner1: str(body.partner1, 60), partner2: str(body.partner2, 60), date: str(body.date, 20),
      city: str(body.city, 60), venue: str(body.venue, 120), note: str(body.note, 1000),
      cover: str(body.cover, 500), theme: ['marigold', 'rani', 'peacock', 'mehendi'].includes(body.theme) ? body.theme : 'marigold',
      upiId: str(body.upiId, 80), upiName: str(body.upiName, 80), address: str(body.address, 500),
    };
    if (!fields.partner1 || !fields.partner2) return send(res, 400, { error: 'Both names are needed' });
    if (fields.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(fields.upiId)) return send(res, 400, { error: 'UPI ID should look like name@bank' });
    if (!reg) {
      reg = { id: id(), ownerId: user.id, slug: slugify(`${fields.partner1}-weds-${fields.partner2}`), createdAt: Date.now(), ...fields };
      db.registries.push(reg);
      // every Indian registry starts with a Shagun envelope
      db.items.push({ id: id(), registryId: reg.id, type: 'fund', title: 'Shagun', description: 'Send your blessings the traditional way — any amount, straight to our UPI.', target: 0, image: '', order: 0, createdAt: Date.now() });
    } else Object.assign(reg, fields);
    save();
    return send(res, 200, publicRegistry(reg, true));
  }

  // couple: items
  if (p === '/api/preview' && m === 'POST') {
    if (!need()) return;
    try { return send(res, 200, await previewLink(str(body.url, 2000))); }
    catch (e) { return send(res, 200, { error: e.name === 'AbortError' ? 'The store took too long — fill in the details yourself' : e.message }); }
  }
  if (p === '/api/items' && m === 'POST') {
    if (!need()) return;
    const reg = ownReg(); if (!reg) return send(res, 400, { error: 'Create your registry first' });
    const type = ['product', 'fund', 'giftcard'].includes(body.type) ? body.type : 'product';
    const item = {
      id: id(), registryId: reg.id, type, title: str(body.title, 200), description: str(body.description, 600),
      url: str(body.url, 2000), image: str(body.image, 2000), store: str(body.store, 80),
      price: rupees(body.price), qty: Math.max(1, Math.min(50, rupees(body.qty) || 1)), target: rupees(body.target),
      category: str(body.category, 40), mostWanted: !!body.mostWanted,
      order: Math.max(0, ...db.items.filter(i => i.registryId === reg.id).map(i => i.order)) + 1, createdAt: Date.now(),
    };
    if (!item.title) return send(res, 400, { error: 'Give the gift a name' });
    if (type === 'product' && item.url && !/^https?:\/\//.test(item.url)) return send(res, 400, { error: 'Store link must start with http(s)://' });
    db.items.push(item); save();
    return send(res, 200, item);
  }
  let mm;
  if ((mm = p.match(/^\/api\/items\/(\w+)$/))) {
    if (!need()) return;
    const reg = ownReg(); const item = db.items.find(i => i.id === mm[1] && i.registryId === reg?.id);
    if (!item) return send(res, 404, { error: 'Not found' });
    if (m === 'DELETE') { db.items = db.items.filter(i => i !== item); save(); return send(res, 200, { ok: true }); }
    if (m === 'PUT') {
      for (const k of ['title', 'description', 'url', 'image', 'store', 'category']) if (k in body) item[k] = str(body[k], 2000);
      for (const k of ['price', 'target', 'qty']) if (k in body) item[k] = rupees(body[k]);
      if ('mostWanted' in body) item.mostWanted = !!body.mostWanted;
      save(); return send(res, 200, item);
    }
  }
  if ((mm = p.match(/^\/api\/gifts\/(\w+)$/)) && m === 'PATCH') {
    if (!need()) return;
    const reg = ownReg(); const g = db.gifts.find(x => x.id === mm[1] && x.registryId === reg?.id);
    if (!g) return send(res, 404, { error: 'Not found' });
    if ('thanked' in body) g.thanked = !!body.thanked;
    if ('received' in body) g.received = !!body.received;
    save(); return send(res, 200, g);
  }

  // guests (no account)
  if ((mm = p.match(/^\/api\/r\/([\w-]+)$/)) && m === 'GET') {
    const reg = db.registries.find(r => r.slug === mm[1]);
    if (!reg) return send(res, 404, { error: 'Registry not found' });
    return send(res, 200, publicRegistry(reg, false));
  }
  if ((mm = p.match(/^\/api\/r\/([\w-]+)\/gift$/)) && m === 'POST') {
    const reg = db.registries.find(r => r.slug === mm[1]);
    const item = reg && db.items.find(i => i.id === body.itemId && i.registryId === reg.id);
    if (!item) return send(res, 404, { error: 'Gift not found' });
    const guestName = str(body.guestName, 80);
    if (!guestName) return send(res, 400, { error: 'Tell the couple who this is from' });
    const g = { id: id(), registryId: reg.id, itemId: item.id, itemTitle: item.title, guestName, phone: str(body.phone, 20),
      message: str(body.message, 600), createdAt: Date.now(), thanked: false, received: false };
    if (item.type === 'product') {
      const { claimed } = itemStats(item);
      if (claimed >= item.qty) return send(res, 409, { error: 'Someone has already bought this one — pick another gift' });
      Object.assign(g, { type: 'purchase', qty: 1, amount: item.price || 0, orderRef: str(body.orderRef, 80) });
    } else {
      const amount = rupees(body.amount);
      if (amount < 1) return send(res, 400, { error: 'Enter an amount' });
      Object.assign(g, { type: 'contribution', amount, upiRef: str(body.upiRef, 40) });
    }
    db.gifts.push(g); save();
    // the delivery address is only revealed to a guest who has reserved a product
    return send(res, 200, { ok: true, address: g.type === 'purchase' ? reg.address || '' : undefined });
  }
  send(res, 404, { error: 'Unknown endpoint' });
}

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
function serveStatic(res, file) {
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/') return serveStatic(res, 'index.html');
    if (url.pathname === '/app' || url.pathname === '/login') return serveStatic(res, 'app.html');
    if (/^\/r\/[\w-]+\/?$/.test(url.pathname)) return serveStatic(res, 'registry.html');
    return serveStatic(res, decodeURIComponent(url.pathname));
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Something went wrong' });
  }
}).listen(PORT, () => console.log(`Shagun registry running → http://localhost:${PORT}`));
