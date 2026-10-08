import { useCallback, useEffect, useState } from 'react';
import { api, GROUPS } from '../api.js';
import { Pill, Table } from '../components/Table.jsx';

export default function Donor({ auth, setAuth, notify }) {
  if (!auth || auth.role !== 'DONOR') return <Entry setAuth={setAuth} notify={notify} />;
  return <Dashboard setAuth={setAuth} notify={notify} />;
}

function Entry({ setAuth, notify }) {
  async function submit(e, path, build) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    try {
      setAuth(await api(path, { method: 'POST', body: build(v) }));
    } catch (err) { notify(err.message, true); }
  }

  return (
    <section>
      <h1>Donor area</h1>
      <p className="lede">Register to record your donations, or log in to see your history.</p>
      <div className="two">
        <div className="card">
          <h2>Log in</h2>
          <form onSubmit={e => submit(e, '/auth/donor/login', v => v)}>
            <label>Email <input name="email" type="email" required /></label>
            <label>Password <input name="password" type="password" required /></label>
            <button className="primary">Log in</button>
          </form>
        </div>
        <div className="card">
          <h2>Register as a donor</h2>
          <form onSubmit={e => submit(e, '/auth/donor/register', v => ({ ...v, age: +v.age }))}>
            <label>Full name <input name="name" required /></label>
            <label>Email <input name="email" type="email" required /></label>
            <label>Password (6 or more characters) <input name="password" type="password" minLength={6} required /></label>
            <div className="row">
              <label>Blood group
                <select name="bloodGroup">{GROUPS.map(g => <option key={g}>{g}</option>)}</select>
              </label>
              <label>Age <input name="age" type="number" min="18" max="65" required /></label>
            </div>
            <div className="row">
              <label>Phone <input name="phone" inputMode="tel" /></label>
              <label>City <input name="city" /></label>
            </div>
            <button className="primary">Create account</button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Dashboard({ setAuth, notify }) {
  const [me, setMe] = useState(null);

  const load = useCallback(() => {
    api('/donor/me').then(setMe).catch(e => notify(e.message, true));
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  async function donate(e) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    try {
      await api('/donor/donations', { method: 'POST', body: { units: +v.units, donationDate: v.donationDate } });
      notify('Donation submitted for confirmation');
      load();
    } catch (err) { notify(err.message, true); }
  }

  if (!me) return null;
  const { profile: p, donations } = me;
  return (
    <section>
      <div className="bar">
        <div>
          <h1>Hello, {p.name}</h1>
          <p className="lede">Blood group {p.bloodGroup}{p.city ? ` · ${p.city}` : ''}</p>
        </div>
        <button className="ghost" onClick={() => setAuth(null)}>Log out</button>
      </div>

      <div className="two">
        <div className="card">
          <h2>Record a donation</h2>
          <form onSubmit={donate}>
            <label>Units <input name="units" type="number" min="1" max="10" defaultValue="1" required /></label>
            <label>Donation date <input name="donationDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            <button className="primary">Submit donation</button>
          </form>
          <p className="note">The blood bank confirms each donation before it joins the stock.</p>
        </div>
      </div>

      <h2 style={{ marginTop: '2rem' }}>Your donation history</h2>
      <Table
        heads={['Date', 'Group', 'Units', 'Status']}
        rows={donations.map(d => [d.donationDate, d.bloodGroup, d.units, <Pill status={d.status} />])}
        empty="No donations yet."
      />
    </section>
  );
}
