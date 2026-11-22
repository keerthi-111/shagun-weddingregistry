import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import GuestRegistry from './pages/GuestRegistry';
import './styles.css';

function NotFound() {
  return (
    <div className="wrap" style={{ textAlign: 'center', padding: '80px 16px' }}>
      <h1>Page not found</h1>
      <Link to="/" className="btn">Go home</Link>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Dashboard />} />
          <Route path="/login" element={<Dashboard startWithLogin />} />
          <Route path="/r/:slug" element={<GuestRegistry />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
