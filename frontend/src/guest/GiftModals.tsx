import { useState, type FormEvent } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Field, Modal } from '../components/ui';
import { api, inr, toRupees, upiLink } from '../lib';
import type { Item, Registry } from '../types';

interface Props { registry: Registry; item: Item; onClose: () => void; onGifted: () => void }

function GuestFields({ v, set }: { v: GuestInfo; set: (v: GuestInfo) => void }) {
  return (
    <>
      <div className="grid2">
        <Field label="Your name">
          <input required value={v.guestName} onChange={e => set({ ...v, guestName: e.target.value })} placeholder="Sharma Uncle & family" />
        </Field>
        <Field label="Phone" hint="(optional)">
          <input type="tel" inputMode="tel" value={v.phone} onChange={e => set({ ...v, phone: e.target.value })} placeholder="+91" />
        </Field>
      </div>
      <Field label="Blessing / message">
        <textarea rows={2} value={v.message} onChange={e => set({ ...v, message: e.target.value })} placeholder="Wishing you a lifetime of happiness!" />
      </Field>
    </>
  );
}
interface GuestInfo { guestName: string; phone: string; message: string }
const emptyGuest: GuestInfo = { guestName: '', phone: '', message: '' };

/** Products: reserve first (prevents duplicates), then reveal delivery address + store link. */
export function ProductGiftModal({ registry: r, item, onClose, onGifted }: Props) {
  const [guest, setGuest] = useState(emptyGuest);
  const [error, setError] = useState('');
  const [reserved, setReserved] = useState<{ address?: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ address?: string }>(`/api/r/${r.slug}/gift`, { body: { ...guest, itemId: item.id } });
      setReserved(res);
      onGifted();
    } catch (err) { setError((err as Error).message); }
  }

  if (reserved)
    return (
      <Modal title="Reserved for you 🎉" onClose={onClose}>
        <p>Now buy it on the store and ship it to the couple{reserved.address ? ':' : ', or bring it along to the wedding.'}</p>
        {reserved.address && (
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none', whiteSpace: 'pre-line' }}>
            <b>Deliver to {r.partner1} &amp; {r.partner2}</b>{'\n'}{reserved.address}
          </div>
        )}
        {item.url && (
          <a className="btn" style={{ width: '100%', marginTop: 16 }} href={item.url} target="_blank" rel="noopener noreferrer">
            Buy on {item.store || 'the store'} ↗
          </a>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>Tip: tick "This is a gift" at checkout so the price isn't on the invoice.</p>
      </Modal>
    );

  return (
    <Modal title={`Gift: ${item.title}`} onClose={onClose}>
      <p className="small muted">Reserve it first so nobody else buys the same thing. You'll then see where to send it.</p>
      <form onSubmit={submit}>
        <GuestFields v={guest} set={setGuest} />
        <div className="err">{error}</div>
        <button className="btn" style={{ width: '100%', marginTop: 8 }}>Reserve this gift</button>
      </form>
    </Modal>
  );
}

/** Cash funds & shagun: pick amount → pay via UPI link/QR → record the blessing. */
export function CashGiftModal({ registry: r, item, onClose, onGifted }: Props) {
  const amounts = item.title === 'Shagun' ? [501, 1101, 2100, 5100, 11000] : [1100, 2100, 5100, 11000, 21000];
  const [amount, setAmount] = useState('');
  const [guest, setGuest] = useState(emptyGuest);
  const [step, setStep] = useState<'details' | 'pay' | 'done'>('details');
  const [upiRef, setUpiRef] = useState('');
  const [error, setError] = useState('');

  const am = toRupees(amount);
  const link = upiLink({ pa: r.upiId, pn: r.upiName || r.partner1, am, tn: `${item.title} from ${guest.guestName}` });

  function next(e: FormEvent) {
    e.preventDefault();
    if (am < 1) return setError('Enter an amount');
    setError(''); setStep('pay');
  }

  async function confirmPaid() {
    try {
      await api(`/api/r/${r.slug}/gift`, { body: { ...guest, itemId: item.id, amount: am, upiRef } });
      setStep('done');
      onGifted();
    } catch (err) { setError((err as Error).message); }
  }

  if (step === 'done')
    return (
      <Modal onClose={onClose}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>🙏</div>
          <h2>Thank you, {guest.guestName}!</h2>
          <p className="muted">{r.partner1} &amp; {r.partner2} will see your blessing.</p>
          <button className="btn" onClick={onClose}>Back to registry</button>
        </div>
      </Modal>
    );

  if (step === 'pay')
    return (
      <Modal title={item.title} onClose={onClose}>
        <div style={{ textAlign: 'center' }}>
          <p>Pay <b>{inr(am)}</b> to <b>{r.upiName || r.partner1}</b><br /><span className="small muted">{r.upiId}</span></p>
          <a className="btn" href={link} style={{ width: '100%' }}>Pay with GPay / PhonePe / Paytm</a>
          <p className="small muted" style={{ margin: '14px 0 6px' }}>On a computer? Scan with any UPI app:</p>
          <div style={{ display: 'inline-block', padding: 10, background: '#fff', borderRadius: 10 }}>
            <QRCodeCanvas value={link} size={180} marginSize={1} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <Field label="UPI transaction ID" hint="(optional — helps the couple match it)">
              <input value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="e.g. 4123 5678 9012" />
            </Field>
          </div>
          <div className="err">{error}</div>
          <button className="btn ghost" style={{ width: '100%' }} onClick={confirmPaid}>I've paid — send my blessing</button>
          <button className="btn plain sm" style={{ marginTop: 10 }} onClick={() => setStep('details')}>← Change amount</button>
          <p className="small muted" style={{ marginBottom: 0 }}>Money goes directly to the couple's bank via UPI. Shagun never handles it.</p>
        </div>
      </Modal>
    );

  return (
    <Modal title={item.title} onClose={onClose}>
      <form onSubmit={next}>
        <label>Amount</label>
        <div className="chips">
          {amounts.map(a => (
            <button type="button" key={a} className={'chip' + (am === a ? ' on' : '')} onClick={() => setAmount(String(a))}>{inr(a)}</button>
          ))}
        </div>
        <input type="number" min={1} inputMode="numeric" required value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Or enter any amount (₹)" style={{ marginTop: 10 }} aria-label="Amount" />
        <GuestFields v={guest} set={setGuest} />
        <div className="err">{error}</div>
        <button className="btn" style={{ width: '100%', marginTop: 8 }}>Continue to pay</button>
      </form>
    </Modal>
  );
}
