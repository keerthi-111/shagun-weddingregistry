// Shared helpers for all pages
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Indian digit grouping: 168500 → ₹1,68,500
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');

async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function modal(html, onMount) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(m);
  onMount?.(m.firstElementChild, () => m.remove());
  m.querySelector('input,textarea,select')?.focus();
  return m;
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

const ICONS = { product: '🎁', fund: '🪔', giftcard: '💳' };
function itemVisual(i) {
  return i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${ICONS[i.type]}'))">` : (i.title === 'Shagun' ? '🧧' : ICONS[i.type]);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
// UPI deep link — opens GPay / PhonePe / Paytm / BHIM on phones
function upiLink({ pa, pn, am, tn }) {
  const q = new URLSearchParams({ pa, pn: pn || '', cu: 'INR' });
  if (am) q.set('am', String(am));
  if (tn) q.set('tn', tn.slice(0, 50));
  return 'upi://pay?' + q.toString().replace(/\+/g, '%20');
}
