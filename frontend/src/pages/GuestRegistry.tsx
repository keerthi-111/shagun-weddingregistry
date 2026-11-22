import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ItemVisual, ProgressBar, useTheme } from '../components/ui';
import { CashGiftModal, ProductGiftModal } from '../guest/GiftModals';
import { api, fmtDate, inr, plural } from '../lib';
import type { Item, ItemType, Registry } from '../types';

type Filter = 'all' | ItemType;
const FILTERS: [Filter, string][] = [['all', 'All gifts'], ['fund', 'Cash & shagun'], ['product', 'Products'], ['giftcard', 'Gift cards']];

export default function GuestRegistry() {
  const { slug } = useParams();
  const [reg, setReg] = useState<Registry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [hideGone, setHideGone] = useState(false);
  const [gifting, setGifting] = useState<Item | null>(null);

  const load = useCallback(() => {
    api<Registry>(`/api/r/${slug}`).then(setReg).catch(() => setNotFound(true));
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  useTheme(reg?.theme);
  useEffect(() => { if (reg) document.title = `${reg.partner1} & ${reg.partner2} — Wedding Registry`; }, [reg]);

  if (notFound)
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '80px 16px' }}>
        <h1>Registry not found</h1>
        <p className="muted">Check the link with the couple.</p>
        <Link to="/" className="btn">Go home</Link>
      </div>
    );
  if (!reg) return null;

  const isGone = (i: Item) => i.type === 'product' && i.claimed >= i.qty;
  const items = reg.items
    .filter(i => filter === 'all' || i.type === filter)
    .filter(i => !(hideGone && isGone(i)))
    .sort((a, b) => Number(!!b.mostWanted) - Number(!!a.mostWanted) || a.order - b.order);

  return (
    <>
      <header className={'cover' + (reg.cover ? ' has-img' : '')} style={reg.cover ? { backgroundImage: `url("${encodeURI(reg.cover)}")` } : undefined}>
        <div className="small" style={{ letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.9 }}>✨ Shubh Vivah ✨</div>
        <h1>{reg.partner1} <span className="amp">&amp;</span> {reg.partner2}</h1>
        <div>{[fmtDate(reg.date), reg.venue, reg.city].filter(Boolean).join(' · ')}</div>
      </header>

      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div className="card note">
          {reg.note || 'Your presence at our wedding is the greatest gift. If you wish to bless us with something more, here are a few ideas. 🙏'}
        </div>

        <div className="row" style={{ marginBottom: 18 }}>
          <div className="chips" style={{ margin: 0 }}>
            {FILTERS.map(([key, label]) => (
              <button key={key} className={'chip' + (filter === key ? ' on' : '')} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <span className="spacer" />
          <label className="check small" style={{ margin: 0 }}>
            <input type="checkbox" checked={hideGone} onChange={e => setHideGone(e.target.checked)} /> Hide gifted
          </label>
        </div>

        {items.length === 0 && <p className="muted">Nothing here yet.</p>}
        <div className="items">
          {items.map(i => {
            const gone = isGone(i);
            const canGift = i.type === 'product' || !!reg.upiId;
            return (
              <div key={i.id} className={'card item' + (gone ? ' gone' : '')}>
                <div className="ph"><ItemVisual item={i} /></div>
                <div className="body">
                  <div className="row" style={{ gap: 6 }}>
                    {i.mostWanted && <span className="tag">★ Most wanted</span>}
                    {gone && <span className="tag done">✓ Gifted</span>}
                  </div>
                  <h3>{i.title}</h3>
                  {i.description && <div className="small muted">{i.description}</div>}
                  {i.type === 'product' ? (
                    <div className="price">
                      {i.price ? inr(i.price) : ''}{' '}
                      <span className="small muted">{i.store}{i.qty > 1 && ` · ${i.claimed} of ${i.qty} bought`}</span>
                    </div>
                  ) : i.target > 0 ? (
                    <>
                      <ProgressBar value={i.raised} max={i.target} />
                      <div className="small"><b>{inr(i.raised)}</b> <span className="muted">of {inr(i.target)} · {plural(i.contributors, 'guest')}</span></div>
                    </>
                  ) : i.contributors > 0 ? (
                    <div className="small muted">{plural(i.contributors, 'guest')} blessed the couple</div>
                  ) : null}
                  <div className="actions">
                    {!gone && (canGift
                      ? <button className="btn sm" onClick={() => setGifting(i)}>
                          {i.type === 'product' ? 'Gift this' : i.title === 'Shagun' ? 'Send shagun' : 'Contribute'}
                        </button>
                      : <span className="small muted">Cash gifts open soon</span>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="small muted" style={{ textAlign: 'center', marginTop: 40 }}>
          Made with <Link to="/">Shagun</Link> — the free wedding registry for India. Cash gifts go straight to the couple's UPI.
        </p>
      </div>

      {gifting && (gifting.type === 'product'
        ? <ProductGiftModal registry={reg} item={gifting} onClose={() => setGifting(null)} onGifted={load} />
        : <CashGiftModal registry={reg} item={gifting} onClose={() => setGifting(null)} onGifted={load} />)}
    </>
  );
}
