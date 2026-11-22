import { useState, type FormEvent } from 'react';
import { api } from '../lib';

export default function AuthCard({ startWithLogin, onDone }: { startWithLogin?: boolean; onDone: () => void }) {
  const [signup, setSignup] = useState(!startWithLogin);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(signup ? '/api/signup' : '/api/login', { body: form });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div className="card">
        <h2>{signup ? 'Create your free registry' : 'Welcome back'}</h2>
        <p className="muted small">{signup ? 'Takes two minutes. You can edit everything later.' : 'Log in to manage your registry.'}</p>
        <form onSubmit={submit}>
          {signup && <><label htmlFor="name">Your name</label><input id="name" value={form.name} onChange={set('name')} autoComplete="name" required /></>}
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={form.password} onChange={set('password')} minLength={6} required
            autoComplete={signup ? 'new-password' : 'current-password'} />
          <div className="err">{error}</div>
          <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy}>Continue</button>
        </form>
        <p className="small muted" style={{ textAlign: 'center', marginBottom: 0 }}>
          <a href="#" onClick={e => { e.preventDefault(); setSignup(!signup); setError(''); }}>
            {signup ? 'Already have an account? Log in' : 'New here? Create a registry'}
          </a>
        </p>
      </div>
    </div>
  );
}
