import { useEffect, useState } from 'react';
import { api, inr } from '../lib';
import type { Gift } from '../types';

function downloadCsv(gifts: Gift[]) {
  const rows = [['Date', 'Guest', 'Phone', 'Gift', 'Type', 'Amount (INR)', 'Reference', 'Message', 'Received', 'Thanked']].concat(
    gifts.map(g => [
      new Date(g.createdAt).toLocaleDateString('en-IN'), g.guestName, g.phone, g.itemTitle, g.type, String(g.amount),
      g.orderRef || g.upiRef || '', g.message, g.received ? 'yes' : 'no', g.thanked ? 'yes' : 'no',
    ]));
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'registry-gifts.csv';
  a.click();
}

export default function ReceivedTab({ gifts: initial }: { gifts: Gift[] }) {
  const [gifts, setGifts] = useState(initial);
  useEffect(() => setGifts(initial), [initial]);

  async function toggle(g: Gift, field: 'received' | 'thanked') {
    const value = !g[field];
    setGifts(gs => gs.map(x => (x.id === g.id ? { ...x, [field]: value } : x)));   // optimistic
    try { await api(`/api/gifts/${g.id}`, { method: 'PATCH', body: { [field]: value } }); }
    catch { setGifts(gs => gs.map(x => (x.id === g.id ? { ...x, [field]: !value } : x))); }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted small">Cash amounts are what guests reported paying — match them against your UPI app.</span>
        <span className="spacer" />
        <button className="btn plain sm" onClick={() => downloadCsv(gifts)} disabled={!gifts.length}>Download CSV</button>
      </div>
      <div className="card table-scroll" style={{ padding: '8px 12px' }}>
        <table>
          <thead><tr><th>Guest</th><th>Gift</th><th>Amount</th><th>Message</th><th>Received</th><th>Thanked</th></tr></thead>
          <tbody>
            {gifts.length === 0 && <tr><td colSpan={6} className="muted">No gifts yet. Share your link to get started!</td></tr>}
            {gifts.map(g => (
              <tr key={g.id}>
                <td><b>{g.guestName}</b>{g.phone && <div className="small muted">{g.phone}</div>}</td>
                <td>
                  {g.itemTitle}
                  {g.orderRef && <div className="small muted">Order: {g.orderRef}</div>}
                  {g.upiRef && <div className="small muted">UPI ref: {g.upiRef}</div>}
                </td>
                <td>{g.amount ? inr(g.amount) : '—'}</td>
                <td className="small">{g.message || <span className="muted">—</span>}</td>
                <td><input type="checkbox" aria-label="Received" checked={g.received} onChange={() => toggle(g, 'received')} /></td>
                <td><input type="checkbox" aria-label="Thanked" checked={g.thanked} onChange={() => toggle(g, 'thanked')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
