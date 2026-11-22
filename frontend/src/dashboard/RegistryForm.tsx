import { useState, type FormEvent } from 'react';
import { Field, useToast } from '../components/ui';
import { api } from '../lib';
import type { RegistryDetails } from '../types';

const EMPTY: RegistryDetails = {
  partner1: '', partner2: '', date: '', city: '', venue: '', note: '', cover: '',
  theme: 'marigold', upiId: '', upiName: '', address: '',
};

export default function RegistryForm({ initial, onSaved }: { initial?: Partial<RegistryDetails>; onSaved: () => void }) {
  const [f, setF] = useState<RegistryDetails>(() => {
    const merged = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as (keyof RegistryDetails)[]) if (initial?.[k] != null) (merged as any)[k] = initial[k];
    return merged;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const bind = (k: keyof RegistryDetails) => ({
    value: f[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/registry', { method: 'PUT', body: f });
      toast('Saved');
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid2">
        <Field label="Partner 1"><input {...bind('partner1')} required placeholder="Ananya" /></Field>
        <Field label="Partner 2"><input {...bind('partner2')} required placeholder="Kabir" /></Field>
        <Field label="Wedding date"><input type="date" {...bind('date')} /></Field>
        <Field label="City"><input {...bind('city')} placeholder="Jaipur" /></Field>
      </div>
      <Field label="Venue" hint="(optional)"><input {...bind('venue')} placeholder="Rambagh Palace" /></Field>
      <Field label="A note for your guests">
        <textarea {...bind('note')} placeholder="Your presence is the biggest gift! But if you'd like to bless us with something, here are a few things we'd love…" />
      </Field>
      <Field label="Cover photo link" hint="(optional)"><input {...bind('cover')} placeholder="https://…/our-photo.jpg" /></Field>
      <Field label="Colour theme">
        <select {...bind('theme')}>
          <option value="marigold">Marigold (red & gold)</option>
          <option value="rani">Rani pink</option>
          <option value="peacock">Peacock teal</option>
          <option value="mehendi">Mehendi green</option>
        </select>
      </Field>

      <h3 style={{ marginTop: 24, fontSize: '1.1rem' }}>Cash gifts via UPI</h3>
      <p className="small muted" style={{ margin: 0 }}>Guests pay this UPI ID directly from their own app. We never hold your money.</p>
      <div className="grid2">
        <Field label="UPI ID"><input {...bind('upiId')} placeholder="ananya@okhdfcbank" /></Field>
        <Field label="Name on UPI account"><input {...bind('upiName')} placeholder="Ananya Sharma" /></Field>
      </div>
      <Field label="Delivery address for gifts" hint="(only shown to guests who reserve a product)">
        <textarea {...bind('address')} placeholder="Flat, street, city, PIN code, phone" />
      </Field>
      <div className="err">{error}</div>
      <button className="btn" style={{ marginTop: 6 }} disabled={busy}>Save registry</button>
    </form>
  );
}
