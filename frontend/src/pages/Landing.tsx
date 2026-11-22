import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Nav } from '../components/ui';
import { api } from '../lib';
import type { Me } from '../types';

const CATEGORIES = [
  ['🍳', 'Kitchen', 'from Amazon, Flipkart, Croma'],
  ['🛋️', 'Home', 'Pepperfry, IKEA, Urban Ladder'],
  ['🧧', 'Shagun', '₹1,101 · ₹5,100 · ₹11,000'],
  ['✈️', 'Honeymoon', 'pooled by many guests'],
  ['💆', 'Experiences', 'spa, dining, stays'],
  ['💳', 'Gift cards', 'any brand you like'],
];

const COUPLE_STEPS = [
  ['Create your registry', 'Your names, date, city, a note for guests, and your UPI ID.'],
  ['Add gifts from anywhere', 'Paste a product link — we pull in the name, photo and price. Add cash funds with a goal.'],
  ['Share one link', 'On WhatsApp, your wedding website, or print the QR on your card.'],
];
const GUEST_STEPS = [
  ['Open the link', 'No sign-up, no app download.'],
  ['Buy or contribute', 'Buy on the original store, or pay any amount via GPay, PhonePe, Paytm or any UPI app.'],
  ['Mark it & bless', 'Mark it gifted so nobody duplicates, and leave a message for the couple.'],
];

const FAQ = [
  ['Is it really free?', "Yes. Creating and sharing a registry costs nothing, and there's no cut taken from cash gifts."],
  ['Where does the money from cash funds go?', 'Directly to your UPI ID. Guests pay from their own UPI app — Shagun never holds or touches the money.'],
  ['How do physical gifts reach us?', "Guests buy on the store's own site and ship to the address you share with them, or bring it to the wedding."],
  ['Will guests buy the same thing twice?', 'Once a guest reserves a gift, it shows as gifted to everyone else.'],
  ['Can I edit my registry after sharing it?', 'Anytime. The link stays the same.'],
];

function Steps({ steps }: { steps: string[][] }) {
  return (
    <div className="steps">
      {steps.map(([t, d]) => <div key={t} className="card step"><b>{t}</b><p className="small muted">{d}</p></div>)}
    </div>
  );
}

export default function Landing() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => { api<Me>('/api/me').then(d => setLoggedIn(!!d.user)).catch(() => {}); }, []);

  return (
    <>
      <div className="toran" />
      <div className="wrap">
        <Nav>
          <Link to={loggedIn ? '/app' : '/login'} className="btn plain sm">{loggedIn ? 'My registry' : 'Log in'}</Link>
          <Link to="/app" className="btn sm">Create registry</Link>
        </Nav>

        <div className="hero">
          <div>
            <span className="tag">Made for Indian weddings</span>
            <h1>Get the gifts you actually want — not the fifth dinner set.</h1>
            <p className="lead">One link for everything: products from any store, shagun and honeymoon funds paid straight to your UPI, and gift cards. Share it on WhatsApp. Guests need no account.</p>
            <div className="row" style={{ marginTop: 22 }}>
              <Link to="/app" className="btn">Start your free registry</Link>
              <a href="#how" className="btn ghost">How it works</a>
            </div>
            <p className="small muted" style={{ marginTop: 14 }}>Free forever · No commission on cash gifts · We never hold your money</p>
          </div>
          <div className="preview">
            <div className="card">
              <div className="serif" style={{ fontSize: '1.5rem' }}>Ananya <span className="amp-gold">&amp;</span> Kabir</div>
              <div className="small muted">14 February 2027 · Jaipur</div>
              <div className="card item" style={{ boxShadow: 'none' }}>
                <div className="body">
                  <div className="row"><h3>🏝️ Honeymoon in Bali</h3><span className="spacer" /><span className="tag">Fund</span></div>
                  <div className="bar"><i style={{ width: '70%' }} /></div>
                  <div className="small"><b>₹1,68,500</b> <span className="muted">of ₹2,40,000 · 22 guests</span></div>
                </div>
              </div>
              <div className="card item" style={{ boxShadow: 'none' }}>
                <div className="body">
                  <div className="row"><h3>☕ Espresso machine</h3><span className="spacer" /><span className="tag done">Gifted</span></div>
                  <div className="small muted">amazon.in · ₹18,990</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="section band">
        <div className="wrap">
          <h2>Everything you'd want on one list</h2>
          <p className="muted">Mix and match — or keep it all cash. It's your wedding.</p>
          <div className="cats" style={{ marginTop: 20 }}>
            {CATEGORIES.map(([icon, name, sub]) => (
              <div key={name} className="card cat"><div>{icon}</div><b>{name}</b><div className="small muted">{sub}</div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <h2>How it works</h2>
          <h3 className="muted" style={{ fontSize: '1.1rem', marginTop: 20 }}>For the couple</h3>
          <Steps steps={COUPLE_STEPS} />
          <h3 className="muted" style={{ fontSize: '1.1rem', marginTop: 28 }}>For guests</h3>
          <Steps steps={GUEST_STEPS} />
        </div>
      </section>

      <section className="section band">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <h2>Questions</h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}
        </div>
      </section>

      <footer>
        <div className="wrap row">
          <Logo />
          <span className="spacer" />
          <span className="small muted">Made in India with ❤️</span>
        </div>
      </footer>
    </>
  );
}
