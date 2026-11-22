import { useState, type FormEvent } from 'react';
import { Field, Modal, useToast } from '../components/ui';
import { api, toRupees } from '../lib';
import type { Item, ItemType } from '../types';

const HEADINGS: Record<ItemType, string> = { product: 'Add a product', fund: 'Add a cash fund', giftcard: 'Add a gift card' };

const FUND_PRESETS = [
  { label: '🏝️ Honeymoon', title: 'Honeymoon fund', description: 'Help us make memories on our first trip together.', target: 150000 },
  { label: '🏡 New home', title: 'Our first home', description: 'Help us set up our new home together.', target: 200000 },
  { label: '🧧 Shagun', title: 'Shagun', description: 'Send your blessings the traditional way.', target: 0 },
  { label: '🤲 Charity', title: 'Charity in our name', description: "We'll donate everything to a cause close to our hearts.", target: 50000 },
];

interface Props { type: ItemType; item?: Item; onClose: () => void; onSaved: () => void }

export default function ItemModal({ type, item, onClose, onSaved }: Props) {
  const editing = !!item;
  const [f, setF] = useState({
    url: item?.url ?? '', title: item?.title ?? '', description: item?.description ?? '', image: item?.image ?? '',
    store: item?.store ?? '', price: item?.price ? String(item.price) : '', qty: String(item?.qty ?? 1),
    target: item?.target ? String(item.target) : '', mostWanted: item?.mostWanted ?? false,
  });
  const [fetchMsg, setFetchMsg] = useState("We'll try to pull in the name, photo and price.");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const bind = (k: 'url' | 'title' | 'description' | 'image' | 'store' | 'price' | 'qty' | 'target') => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(prev => ({ ...prev, [k]: e.target.value })),
  });

  async function fetchDetails(url = f.url) {
    if (!url.trim()) return;
    setFetching(true); setFetchMsg('Fetching…');
    try {
      const d = await api<{ title: string; image: string; price: number; store: string }>('/api/preview', { body: { url: url.trim() } });
      setF(prev => ({
        ...prev, url,
        title: d.title || prev.title, image: d.image || prev.image,
        price: d.price ? String(d.price) : prev.price, store: d.store || prev.store,
      }));
      setFetchMsg(d.title ? '✓ Got it — check the details below.' : "The store didn't share details — please fill them in.");
    } catch (err) { setFetchMsg((err as Error).message); }
    finally { setFetching(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const body = {
      type, title: f.title, description: f.description, image: f.image, mostWanted: f.mostWanted,
      ...(type === 'product'
        ? { url: f.url, store: f.store, price: toRupees(f.price), qty: Math.max(1, toRupees(f.qty)) }
        : { target: toRupees(f.target) }),
    };
    try {
      await api(editing ? `/api/items/${item!.id}` : '/api/items', { method: editing ? 'PUT' : 'POST', body });
      toast(editing ? 'Saved' : 'Added to your registry');
      onSaved();
      onClose();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <Modal title={editing ? 'Edit gift' : HEADINGS[type]} onClose={onClose}>
      <form onSubmit={submit}>
        {type === 'product' && (
          <>
            <label htmlFor="url">Product link</label>
            <div className="row">
              <input id="url" {...bind('url')} style={{ flex: 1 }} placeholder="Paste a link from Amazon, Flipkart, Myntra, Pepperfry…"
                onPaste={e => { const text = e.clipboardData.getData('text'); setTimeout(() => fetchDetails(text), 0); }} />
              <button type="button" className="btn sm" onClick={() => fetchDetails()} disabled={fetching}>Fetch</button>
            </div>
            <div className="small muted">{fetchMsg}</div>
          </>
        )}

        {type === 'fund' && !editing && (
          <>
            <label>Quick start</label>
            <div className="chips">
              {FUND_PRESETS.map(p => (
                <button type="button" key={p.label} className="chip"
                  onClick={() => setF(prev => ({ ...prev, title: p.title, description: p.description, target: p.target ? String(p.target) : '' }))}>
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        <Field label={type === 'giftcard' ? 'Gift card (brand)' : 'Name'}>
          <input {...bind('title')} required placeholder={type === 'giftcard' ? 'Taj Hotels gift card' : type === 'fund' ? 'Honeymoon in Bali' : 'Philips air fryer'} />
        </Field>
        <Field label="Description" hint="(optional)"><textarea rows={2} {...bind('description')} /></Field>

        <div className="grid2">
          {type === 'product' ? (
            <>
              <Field label="Price (₹)"><input type="number" min={0} inputMode="numeric" {...bind('price')} /></Field>
              <Field label="Quantity wanted"><input type="number" min={1} max={50} {...bind('qty')} /></Field>
              <Field label="Store"><input {...bind('store')} placeholder="amazon.in" /></Field>
            </>
          ) : (
            <Field label="Goal (₹)" hint="— blank for no goal"><input type="number" min={0} inputMode="numeric" {...bind('target')} /></Field>
          )}
          <Field label="Image link" hint="(optional)"><input {...bind('image')} /></Field>
        </div>

        <label className="check">
          <input type="checkbox" checked={f.mostWanted} onChange={e => setF(prev => ({ ...prev, mostWanted: e.target.checked }))} />
          Mark as most wanted
        </label>
        <div className="err">{error}</div>
        <button className="btn" style={{ width: '100%', marginTop: 8 }}>{editing ? 'Save changes' : 'Add to registry'}</button>
      </form>
    </Modal>
  );
}
