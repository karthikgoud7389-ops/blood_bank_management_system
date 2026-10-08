import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Pill, Table } from '../components/Table.jsx';

const TABS = [['donations', 'Donations'], ['requests', 'Requests'], ['donors', 'Donors'], ['record', 'Record collection']];
const PATHS = { donations: '/admin/donations', requests: '/admin/requests', donors: '/admin/donors', record: '/admin/donors' };

export default function Admin({ auth, setAuth, notify }) {
  if (!auth || auth.role !== 'ADMIN') return <Login setAuth={setAuth} notify={notify} />;
  return <Dashboard setAuth={setAuth} notify={notify} />;
}

function Login({ setAuth, notify }) {
  async function submit(e) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    try {
      setAuth(await api('/auth/admin/login', { method: 'POST', body: v }));
    } catch (err) { notify(err.message, true); }
  }
  return (
    <section>
      <h1>Administrator</h1>
      <p className="lede">Log in to manage donors, collections, requests and stock.</p>
      <div className="card narrow">
        <form onSubmit={submit}>
          <label>Username <input name="username" required /></label>
          <label>Password <input name="password" type="password" required /></label>
          <button className="primary">Log in</button>
        </form>
      </div>
    </section>
  );
}

function Dashboard({ setAuth, notify }) {
  const [tab, setTab] = useState('donations');
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, r] = await Promise.all([api('/admin/summary'), api(PATHS[tab])]);
        if (alive) { setSummary(s); setRows(r); }
      } catch (err) { if (alive) notify(err.message, true); }
    })();
    return () => { alive = false; };
  }, [tab, tick, notify]);

  function go(t) { setRows(null); setTab(t); }

  async function put(path, message) {
    try {
      const r = await api(path, { method: 'PUT' });
      const msg = typeof message === 'function' ? message(r) : message;
      notify(msg.text, msg.err);
      refresh();
    } catch (err) { notify(err.message, true); }
  }

  async function record(e) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    try {
      await api('/admin/donations', { method: 'POST', body: { donorId: +v.donorId, units: +v.units } });
      notify('Collection added to stock');
      refresh();
    } catch (err) { notify(err.message, true); }
  }

  function body() {
    if (!rows) return null;
    if (tab === 'donations') {
      return (
        <Table
          heads={['ID', 'Donor', 'Group', 'Units', 'Date', 'Status', '']}
          empty="No donations yet."
          rows={rows.map(d => [d.id, d.donorName, d.bloodGroup, d.units, d.donationDate, <Pill status={d.status} />,
            d.status === 'PENDING' && (
              <>
                <button className="ghost" onClick={() => put(`/admin/donations/${d.id}/confirm`, { text: 'Donation confirmed and added to stock' })}>Confirm</button>{' '}
                <button className="ghost bad" onClick={() => put(`/admin/donations/${d.id}/reject`, { text: 'Donation rejected' })}>Reject</button>
              </>
            )])}
        />
      );
    }
    if (tab === 'requests') {
      const done = q => q.status === 'ISSUED'
        ? { text: 'Blood issued and stock updated' }
        : { text: 'Not enough stock. Request marked unavailable', err: true };
      return (
        <Table
          heads={['No.', 'Patient', 'Phone', 'Hospital', 'Group', 'Units', 'Requested', 'Status', '']}
          empty="No blood requests yet."
          rows={rows.map(q => [q.id, q.patientName, q.phone, q.hospital, q.bloodGroup, q.units, q.requestDate, <Pill status={q.status} />,
            q.status === 'PENDING' && (
              <button className="ghost" onClick={() => put(`/admin/requests/${q.id}/process`, done)}>Check stock and issue</button>
            )])}
        />
      );
    }
    if (tab === 'donors') {
      return (
        <Table
          heads={['ID', 'Name', 'Email', 'Group', 'Age', 'Phone', 'City']}
          empty="No donors registered yet."
          rows={rows.map(d => [d.id, d.name, d.email, d.bloodGroup, d.age, d.phone, d.city])}
        />
      );
    }
    if (!rows.length) return <div className="table empty">Register a donor first, then record a collection here.</div>;
    return (
      <div className="card narrow">
        <h2>Record blood collected at the bank</h2>
        <form onSubmit={record}>
          <label>Donor
            <select name="donorId">{rows.map(d => <option key={d.id} value={d.id}>{d.name} ({d.bloodGroup})</option>)}</select>
          </label>
          <label>Units <input name="units" type="number" min="1" max="10" defaultValue="1" required /></label>
          <button className="primary">Add to stock</button>
        </form>
      </div>
    );
  }

  return (
    <section>
      <div className="bar">
        <h1>Dashboard</h1>
        <button className="ghost" onClick={() => setAuth(null)}>Log out</button>
      </div>
      {summary && (
        <div className="stats">
          <div className="stat"><b>{summary.totalUnits}</b><span>Units in stock</span></div>
          <div className="stat"><b>{summary.pendingDonations}</b><span>Donations to confirm</span></div>
          <div className="stat"><b>{summary.pendingRequests}</b><span>Requests to review</span></div>
          <div className="stat"><b>{summary.donors}</b><span>Registered donors</span></div>
        </div>
      )}
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={k === tab ? 'on' : ''} onClick={() => go(k)}>{label}</button>
        ))}
      </div>
      {body()}
    </section>
  );
}
