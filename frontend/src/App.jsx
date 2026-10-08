import { useCallback, useEffect, useRef, useState } from 'react';
import { setToken, setUnauthorizedHandler } from './api.js';
import Home from './pages/Home.jsx';
import Donor from './pages/Donor.jsx';
import Admin from './pages/Admin.jsx';

const VIEWS = [['home', 'Availability'], ['donor', 'Donor'], ['admin', 'Admin']];

export default function App() {
  const [view, setView] = useState('home');
  const [auth, setAuthState] = useState(() => JSON.parse(sessionStorage.getItem('auth') || 'null'));
  const [toast, setToast] = useState(null);
  const timer = useRef();

  // Must be in place before child pages make their first API call.
  setToken(auth?.token ?? null);

  const notify = useCallback((msg, err = false) => {
    setToast({ msg, err });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const setAuth = useCallback(a => {
    if (a) sessionStorage.setItem('auth', JSON.stringify(a));
    else sessionStorage.removeItem('auth');
    setAuthState(a);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setAuth(null); notify('Please log in again', true); });
  }, [setAuth, notify]);

  return (
    <>
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M12 2C9 7 5 10.5 5 15a7 7 0 0 0 14 0c0-4.500-4-8-7-13z" fill="currentColor" />
          </svg>
          <span>Blood Bank</span>
        </div>
        <nav aria-label="Main">
          {VIEWS.map(([key, label]) => (
            <button key={key} className={view === key ? 'on' : ''} onClick={() => setView(key)}>{label}</button>
          ))}
        </nav>
      </header>

      <main>
        {view === 'home' && <Home notify={notify} />}
        {view === 'donor' && <Donor auth={auth} setAuth={setAuth} notify={notify} />}
        {view === 'admin' && <Admin auth={auth} setAuth={setAuth} notify={notify} />}
      </main>

      <div id="toast" role="status" className={toast ? `show${toast.err ? ' err' : ''}` : ''}>
        {toast?.msg}
      </div>
    </>
  );
}
