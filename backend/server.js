import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { GROUPS, load, save, nextId } from './db.js';

const PORT = process.env.PORT || 5000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const db = load();
const sessions = new Map(); // token -> { role, donorId }

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = msg => new HttpError(400, msg);
const today = () => new Date().toISOString().slice(0, 10);
const text = v => (v == null ? '' : String(v)).trim();
const group = g => {
  const v = text(g).toUpperCase();
  if (!GROUPS.includes(v)) throw bad('Choose a valid blood group');
  return v;
};
const units = u => {
  const n = Number(u);
  if (!Number.isInteger(n) || n < 1 || n > 10) throw bad('Units must be between 1 and 10');
  return n;
};
const publicDonor = ({ passwordHash, ...d }) => d;
const stockList = () => GROUPS.map(g => ({ bloodGroup: g, units: db.stock[g] }));

function issueToken(role, donorId, name) {
  const token = randomUUID();
  sessions.set(token, { role, donorId });
  return { token, role, name };
}

const requireRole = role => (req, res, next) => {
  const h = req.headers.authorization || '';
  const s = h.startsWith('Bearer ') ? sessions.get(h.slice(7)) : null;
  if (!s || s.role !== role) return next(new HttpError(401, 'Please log in again'));
  req.session = s;
  next();
};

// ---------- donations and requests (business rules) ----------
function addDonation(donor, unitCount, date) {
  const d = {
    id: nextId('donation'),
    donorId: donor.id,
    donorName: donor.name,
    bloodGroup: donor.bloodGroup,
    units: units(unitCount),
    donationDate: /^\d{4}-\d{2}-\d{2}$/.test(text(date)) ? text(date) : today(),
    status: 'PENDING',
  };
  db.donations.push(d);
  return d;
}

function pendingDonation(id) {
  const d = db.donations.find(x => x.id === Number(id));
  if (!d) throw bad('Donation not found');
  if (d.status !== 'PENDING') throw bad(`This donation is already ${d.status.toLowerCase()}`);
  return d;
}

function confirmDonation(d) {
  d.status = 'CONFIRMED';
  db.stock[d.bloodGroup] += d.units;
  return d;
}

// ---------- app ----------
const app = express();
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
app.use(express.json());

// Public: stock and blood requests
app.get('/api/stock', (req, res) => res.json(stockList()));

app.post('/api/requests', (req, res) => {
  const b = req.body || {};
  if (!text(b.patientName)) throw bad("Enter the patient's name");
  if (text(b.phone).length < 7) throw bad('Enter a contact phone number');
  if (!text(b.hospital)) throw bad('Enter the hospital or location');
  const q = {
    id: nextId('request'),
    patientName: text(b.patientName),
    phone: text(b.phone),
    hospital: text(b.hospital),
    bloodGroup: group(b.bloodGroup),
    units: units(b.units),
    status: 'PENDING',
    requestDate: today(),
    resolvedDate: null,
  };
  db.requests.push(q);
  save();
  res.status(201).json(q);
});

app.get('/api/requests/:id/status', (req, res) => {
  const q = db.requests.find(x => x.id === Number(req.params.id) && x.phone === text(req.query.phone));
  if (!q) throw new HttpError(404, 'No request matches that number and phone');
  res.json(q);
});

// Public: login and registration
app.post('/api/auth/donor/register', (req, res) => {
  const b = req.body || {};
  const email = text(b.email).toLowerCase();
  const age = Number(b.age);
  if (!text(b.name)) throw bad('Enter your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Enter a valid email address');
  if (text(b.password).length < 6) throw bad('Password must be at least 6 characters');
  if (!Number.isInteger(age) || age < 18 || age > 65) throw bad('Donors must be between 18 and 65 years old');
  if (db.donors.some(d => d.email === email)) throw bad('That email is already registered');
  const donor = {
    id: nextId('donor'),
    name: text(b.name),
    email,
    passwordHash: bcrypt.hashSync(text(b.password), 10),
    bloodGroup: group(b.bloodGroup),
    phone: text(b.phone),
    city: text(b.city),
    age,
  };
  db.donors.push(donor);
  save();
  res.status(201).json(issueToken('DONOR', donor.id, donor.name));
});

app.post('/api/auth/donor/login', (req, res) => {
  const b = req.body || {};
  const donor = db.donors.find(d => d.email === text(b.email).toLowerCase());
  if (!donor || !bcrypt.compareSync(text(b.password), donor.passwordHash)) {
    throw new HttpError(401, 'Wrong email or password');
  }
  res.json(issueToken('DONOR', donor.id, donor.name));
});

app.post('/api/auth/admin/login', (req, res) => {
  const b = req.body || {};
  if (text(b.username) !== ADMIN_USER || String(b.password ?? '') !== ADMIN_PASS) {
    throw new HttpError(401, 'Wrong username or password');
  }
  res.json(issueToken('ADMIN', null, 'Administrator'));
});

// Donor area
const donorOnly = requireRole('DONOR');

app.get('/api/donor/me', donorOnly, (req, res) => {
  const donor = db.donors.find(d => d.id === req.session.donorId);
  if (!donor) throw new HttpError(401, 'Please log in again');
  res.json({
    profile: publicDonor(donor),
    donations: db.donations.filter(d => d.donorId === donor.id).reverse(),
  });
});

app.post('/api/donor/donations', donorOnly, (req, res) => {
  const donor = db.donors.find(d => d.id === req.session.donorId);
  if (!donor) throw new HttpError(401, 'Please log in again');
  const d = addDonation(donor, req.body?.units, req.body?.donationDate);
  save();
  res.status(201).json(d);
});

// Admin area
const adminOnly = requireRole('ADMIN');

app.get('/api/admin/summary', adminOnly, (req, res) => {
  res.json({
    donors: db.donors.length,
    pendingDonations: db.donations.filter(d => d.status === 'PENDING').length,
    pendingRequests: db.requests.filter(q => q.status === 'PENDING').length,
    totalUnits: Object.values(db.stock).reduce((a, b) => a + b, 0),
  });
});

app.get('/api/admin/donors', adminOnly, (req, res) => res.json(db.donors.map(publicDonor)));
app.get('/api/admin/donations', adminOnly, (req, res) => res.json([...db.donations].reverse()));
app.get('/api/admin/requests', adminOnly, (req, res) => res.json([...db.requests].reverse()));

// Record blood collected directly at the bank: confirmed and added to stock at once.
app.post('/api/admin/donations', adminOnly, (req, res) => {
  const donor = db.donors.find(d => d.id === Number(req.body?.donorId));
  if (!donor) throw bad('Choose a registered donor');
  const d = confirmDonation(addDonation(donor, req.body?.units, today()));
  save();
  res.status(201).json(d);
});

app.put('/api/admin/donations/:id/confirm', adminOnly, (req, res) => {
  const d = confirmDonation(pendingDonation(req.params.id));
  save();
  res.json(d);
});

app.put('/api/admin/donations/:id/reject', adminOnly, (req, res) => {
  const d = pendingDonation(req.params.id);
  d.status = 'REJECTED';
  save();
  res.json(d);
});

// Check stock: issue the blood and reduce stock if enough units exist, otherwise mark unavailable.
app.put('/api/admin/requests/:id/process', adminOnly, (req, res) => {
  const q = db.requests.find(x => x.id === Number(req.params.id));
  if (!q) throw bad('Request not found');
  if (q.status !== 'PENDING') throw bad(`This request is already ${q.status.toLowerCase()}`);
  if (db.stock[q.bloodGroup] >= q.units) {
    db.stock[q.bloodGroup] -= q.units;
    q.status = 'ISSUED';
  } else {
    q.status = 'UNAVAILABLE';
  }
  q.resolvedDate = today();
  save();
  res.json(q);
});

// ---------- errors ----------
app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found')));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Server error' : err.message });
});

app.listen(PORT, () => console.log(`Blood Bank API running at http://localhost:${PORT}`));
