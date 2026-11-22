import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Item, Theme } from '../types';

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => setMsg(m), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

// ---------- modal ----------
export function Modal({ title, onClose, children }: { title?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="card" role="dialog" aria-modal="true">
        <div className="row" style={{ marginBottom: 8 }}>
          {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          <span className="spacer" />
          <button className="btn plain sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- layout bits ----------
export function Logo() {
  return <Link className="logo" to="/">🪔 Shagun<span>.</span></Link>;
}

export function Nav({ children }: { children?: ReactNode }) {
  return (
    <nav className="nav">
      <Logo />
      <div className="spacer" />
      {children}
    </nav>
  );
}

export function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
}

const ICONS = { product: '🎁', fund: '🪔', giftcard: '💳' } as const;

export function ItemVisual({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);
  if (item.image && !broken)
    return <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return <>{item.title === 'Shagun' ? '🧧' : ICONS[item.type]}</>;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label>{label} {hint && <span className="muted">{hint}</span>}</label>
      {children}
    </div>
  );
}
