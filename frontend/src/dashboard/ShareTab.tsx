import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '../components/ui';
import { fmtDate } from '../lib';
import type { Registry } from '../types';

export default function ShareTab({ registry: r }: { registry: Registry }) {
  const link = `${window.location.origin}/r/${r.slug}`;
  const [text, setText] = useState(
    `Hello! 🙏 We're getting married${r.date ? ' on ' + fmtDate(r.date) : ''}${r.city ? ' in ' + r.city : ''}! ` +
    `Your blessings mean the world to us. If you'd like to send a gift or shagun, here's our registry:\n${link}\n\n— ${r.partner1} & ${r.partner2}`,
  );
  const toast = useToast();

  function saveQr() {
    const canvas = document.querySelector<HTMLCanvasElement>('#registry-qr');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${r.slug}-qr.png`;
    a.click();
  }

  return (
    <div className="grid2" style={{ gap: 18 }}>
      <div className="card">
        <h3>Your registry link</h3>
        <div className="row">
          <input readOnly value={link} style={{ flex: 1 }} aria-label="Registry link" />
          <button className="btn sm" onClick={() => { navigator.clipboard.writeText(link); toast('Link copied'); }}>Copy</button>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <a className="btn" style={{ background: '#25D366' }} target="_blank" rel="noopener"
            href={'https://wa.me/?text=' + encodeURIComponent(text)}>Share on WhatsApp</a>
        </div>
        <label htmlFor="wa">Message preview</label>
        <textarea id="wa" rows={6} value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div className="card" style={{ textAlign: 'center' }}>
        <h3>QR code for your invite card</h3>
        <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12 }}>
          <QRCodeCanvas id="registry-qr" value={link} size={200} fgColor="#2b1d14" marginSize={1} />
        </div>
        <div><button className="btn plain sm" onClick={saveQr} style={{ marginTop: 8 }}>Download QR</button></div>
        <p className="small muted">Print it on your wedding card so guests can scan straight to your registry.</p>
      </div>
    </div>
  );
}
