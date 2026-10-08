// JSON file storage: the whole database lives in data/db.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const file = path.join(dir, 'db.json');

export const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const empty = () => ({
  donors: [],
  donations: [],
  requests: [],
  stock: Object.fromEntries(GROUPS.map(g => [g, 0])),
  seq: { donor: 0, donation: 0, request: 0 },
});

let db;

export function load() {
  fs.mkdirSync(dir, { recursive: true });
  db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : empty();
  for (const g of GROUPS) if (db.stock[g] === undefined) db.stock[g] = 0;
  save();
  return db;
}

// Write to a temp file first so a crash can never leave a half-written db.json.
export function save() {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, file);
}

export const nextId = kind => ++db.seq[kind];
