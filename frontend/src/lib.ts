// API client + India-specific formatting helpers

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || 'Something went wrong — please try again');
  return data as T;
}

/** Indian digit grouping: 168500 → ₹1,68,500 */
export const inr = (n: number | undefined) => '₹' + Number(n || 0).toLocaleString('en-IN');

export function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** UPI deep link — opens GPay / PhonePe / Paytm / BHIM on phones, or encode it as a QR for desktops. */
export function upiLink(p: { pa: string; pn: string; am?: number; tn?: string }) {
  const q = new URLSearchParams({ pa: p.pa, pn: p.pn, cu: 'INR' });
  if (p.am) q.set('am', String(p.am));
  if (p.tn) q.set('tn', p.tn.slice(0, 50));
  return 'upi://pay?' + q.toString().replace(/\+/g, '%20');
}

/** Converts a form field to whole rupees (empty → 0). */
export const toRupees = (v: string | number) => Math.max(0, Math.round(Number(v) || 0));

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
