import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ItemVisual, Nav, ProgressBar, useTheme } from '../components/ui';
import AuthCard from '../dashboard/AuthCard';
import ItemModal from '../dashboard/ItemModal';
import ReceivedTab from '../dashboard/ReceivedTab';
import RegistryForm from '../dashboard/RegistryForm';
import ShareTab from '../dashboard/ShareTab';
import { api, fmtDate, inr, plural } from '../lib';
import type { Item, ItemType, Me, Registry } from '../types';

type Tab = 'list' | 'received' | 'share' | 'settings';
const TABS: [Tab, string][] = [['list', 'My list'], ['received', 'Received & thank-yous'], ['share', 'Share'], ['settings', 'Settings']];

export default function Dashboard({ startWithLogin }: { startWithLogin?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const navigate = useNavigate();
  const load = useCallback(() => api<Me>('/api/me').then(setMe), []);
  useEffect(() => { load(); }, [load]);
  useTheme(me?.registry?.theme);

  async function logout() {
    await api('/api/logout', { body: {} });
    navigate('/');
  }

  if (!me) return null;
  const reg = me.registry;

  return (
    <>
      <div className="toran" />
      <div className="wrap">
        <Nav>
          {reg && <a className="btn ghost sm" href={`/r/${reg.slug}`} target="_blank" rel="noopener">View as guest ↗</a>}
          {me.user && <button className="btn plain sm" onClick={logout}>Log out</button>}
        </Nav>

        {!me.user && <AuthCard startWithLogin={startWithLogin} onDone={load} />}

        {me.user && !reg && (
          <div style={{ maxWidth: 640, margin: '20px auto 60px' }}>
            <div className="card">
              <h2>Tell us about your wedding 💍</h2>
              <RegistryForm initial={{ partner1: me.user.name }} onSaved={load} />
            </div>
          </div>
        )}

        {me.user && reg && <RegistryDashboard reg={reg} reload={load} />}
      </div>
    </>
  );
}

function RegistryDashboard({ reg, reload }: { reg: Registry; reload: () => void }) {
  const [tab, setTab] = useState<Tab>('list');
  const [editing, setEditing] = useState<{ type: ItemType; item?: Item } | null>(null);
  const gifts = reg.gifts ?? [];
  const cash = gifts.filter(g => g.type === 'contribution').reduce((s, g) => s + g.amount, 0);
  const guests = new Set(gifts.map(g => g.guestName.toLowerCase())).size;
  const needsUpi = !reg.upiId && reg.items.some(i => i.type !== 'product');

  async function remove(item: Item) {
    if (!confirm(`Remove "${item.title}" from your registry?`)) return;
    await api(`/api/items/${item.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <h1 style={{ marginTop: 12 }}>{reg.partner1} <span className="amp-gold">&amp;</span> {reg.partner2}</h1>
      <div className="muted">{[fmtDate(reg.date), reg.city].filter(Boolean).join(' · ')}</div>

      <div className="stats" style={{ marginTop: 20 }}>
        <div className="card stat"><b>{reg.items.length}</b><span className="small muted">gifts on your list</span></div>
        <div className="card stat"><b>{gifts.filter(g => g.type === 'purchase').length}</b><span className="small muted">gifts bought by guests</span></div>
        <div className="card stat"><b>{inr(cash)}</b><span className="small muted">cash pledged via UPI</span></div>
        <div className="card stat"><b>{guests}</b><span className="small muted">guests who gifted</span></div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn" onClick={() => setEditing({ type: 'product' })}>+ Add product from link</button>
            <button className="btn ghost" onClick={() => setEditing({ type: 'fund' })}>+ Cash fund</button>
            <button className="btn ghost" onClick={() => setEditing({ type: 'giftcard' })}>+ Gift card</button>
          </div>
          {needsUpi && (
            <div className="card" style={{ background: 'var(--soft)', marginBottom: 16 }}>
              ⚠️ Add your UPI ID in <a href="#" onClick={e => { e.preventDefault(); setTab('settings'); }}>Settings</a> so guests can send cash gifts.
            </div>
          )}
          {reg.items.length === 0 && <p className="muted">Your list is empty — add your first gift.</p>}
          <div className="items">
            {reg.items.map(i => (
              <div key={i.id} className="card item">
                <div className="ph"><ItemVisual item={i} /></div>
                <div className="body">
                  <div className="row" style={{ gap: 6 }}>
                    {i.mostWanted && <span className="tag">★ Most wanted</span>}
                    <span className="tag">{i.type === 'fund' ? 'Cash fund' : i.type === 'giftcard' ? 'Gift card' : i.store || 'Product'}</span>
                  </div>
                  <h3>{i.title}</h3>
                  {i.type === 'product' ? (
                    <div className="price">{i.price ? inr(i.price) : ''} <span className="small muted">· {i.claimed}/{i.qty} bought</span></div>
                  ) : (
                    <>
                      {i.target > 0 && <ProgressBar value={i.raised} max={i.target} />}
                      <div className="small"><b>{inr(i.raised)}</b> <span className="muted">{i.target ? 'of ' + inr(i.target) : 'received'} · {plural(i.contributors, 'guest')}</span></div>
                    </>
                  )}
                  <div className="actions">
                    <button className="btn plain sm" onClick={() => setEditing({ type: i.type, item: i })}>Edit</button>
                    <button className="btn plain sm" onClick={() => remove(i)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'received' && <ReceivedTab gifts={gifts} />}
      {tab === 'share' && <ShareTab registry={reg} />}
      {tab === 'settings' && (
        <div className="card" style={{ maxWidth: 640 }}>
          <RegistryForm initial={reg} onSaved={reload} />
        </div>
      )}

      {editing && <ItemModal type={editing.type} item={editing.item} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}
