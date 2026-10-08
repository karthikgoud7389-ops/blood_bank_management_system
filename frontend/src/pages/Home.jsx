import { useEffect, useState } from 'react';
import { api, GROUPS } from '../api.js';
import BloodBag from '../components/BloodBag.jsx';

const STATUS_TEXT = {
  PENDING: 'is waiting for review',
  ISSUED: 'was approved and the blood has been issued',
  UNAVAILABLE: 'could not be filled because the blood is not in stock',
};

export default function Home({ notify }) {
  const [stock, setStock] = useState([]);
  const [stockError, setStockError] = useState('');
  const [reqMsg, setReqMsg] = useState('');
  const [status, setStatus] = useState({ text: '', err: false });

  useEffect(() => {
    api('/stock').then(setStock).catch(e => setStockError(e.message));
  }, []);

  async function sendRequest(e) {
    e.preventDefault();
    const form = e.target;
    const v = Object.fromEntries(new FormData(form));
    try {
      const q = await api('/requests', { method: 'POST', body: { ...v, units: +v.units } });
      setReqMsg(`Request sent. Your request number is ${q.id}. Use it with your phone number to check the status.`);
      form.reset();
    } catch (err) { notify(err.message, true); }
  }

  async function checkStatus(e) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    try {
      const q = await api(`/requests/${+v.id}/status?phone=${encodeURIComponent(v.phone)}`);
      setStatus({ text: `Request ${q.id} for ${q.units} unit(s) of ${q.bloodGroup} ${STATUS_TEXT[q.status]}.`, err: false });
    } catch (err) { setStatus({ text: err.message, err: true }); }
  }

  return (
    <section>
      <h1>Blood available now</h1>
      <p className="lede">Current units in stock for each blood group. Groups with fewer than 5 units are marked low.</p>
      <div className="bags" aria-live="polite">
        {stockError ? <p className="note err">{stockError}</p> : stock.map((s, i) => <BloodBag key={s.bloodGroup} stock={s} index={i} />)}
      </div>

      <div className="two">
        <div className="card">
          <h2>Request blood</h2>
          <form onSubmit={sendRequest}>
            <label>Patient name <input name="patientName" required /></label>
            <label>Contact phone <input name="phone" inputMode="tel" required /></label>
            <label>Hospital or location <input name="hospital" required /></label>
            <div className="row">
              <label>Blood group
                <select name="bloodGroup">{GROUPS.map(g => <option key={g}>{g}</option>)}</select>
              </label>
              <label>Units <input name="units" type="number" min="1" max="10" defaultValue="1" required /></label>
            </div>
            <button className="primary">Send request</button>
          </form>
          <p className="note">{reqMsg}</p>
        </div>

        <div className="card">
          <h2>Check request status</h2>
          <form onSubmit={checkStatus}>
            <label>Request number <input name="id" type="number" min="1" required /></label>
            <label>Contact phone used in the request <input name="phone" inputMode="tel" required /></label>
            <button className="primary">Check status</button>
          </form>
          <p className={`note${status.err ? ' err' : ''}`}>{status.text}</p>
        </div>
      </div>
    </section>
  );
}
