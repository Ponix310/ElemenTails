/*
Build enemies.json from CSVs in Game Info/
Usage:
  node source/data/tools/build_enemies_from_csv.js
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const GAME_INFO = path.join(ROOT, 'Game Info');
const OUT_PATH = path.join(ROOT, 'source', 'data', 'enemies.json');

const FILES = [
  { file: 'Enemies - Common.csv', rarity: 'Common' },
  { file: 'Enemies - Rare.csv', rarity: 'Rare' },
  { file: 'Enemies - Elite.csv', rarity: 'Elite' },
];

const ELEMENT_TOKENS = {
  ':F:': 'Fire',
  ':W:': 'Water',
  ':P:': 'Plant',
  ':A:': 'Air',
  ':L:': 'Lightning',
  ':E:': 'Earth',
};

function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { // escaped quote
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\n' || ch === '\r') {
        // finalize row on newline
        if (ch === '\r' && text[i + 1] === '\n') i++; // handle CRLF
        row.push(field);
        if (row.some(v => v !== '' )) rows.push(row);
        row = []; field = '';
        i++;
        continue;
      }
      field += ch; i++;
    }
  }
  // flush last field/row
  if (field.length || row.length) { row.push(field); if (row.some(v => v !== '')) rows.push(row); }
  // header
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map(s => s.trim());
  const records = rows.slice(1).map(r => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { header, records };
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseElements(val) {
  if (!val) return [];
  // handle formats like ":F: :L:" or ":F::L:" or single tokens
  const tokens = Array.from(val.matchAll(/:([FWPALE]):/g)).map(m => `:${m[1]}:`);
  const manual = val.split(/\s+/).filter(Boolean).map(s => s.trim());
  const all = (tokens.length ? tokens : manual);
  const mapped = [];
  for (const t of all) {
    const key = t.replace(/[^:A-Z]/g, '').toUpperCase();
    if (ELEMENT_TOKENS[key] && !mapped.includes(ELEMENT_TOKENS[key])) mapped.push(ELEMENT_TOKENS[key]);
  }
  return mapped;
}

function normalizeActions(rec) {
  // Many CSVs use columns named '123' and '456' for two actions
  const a1 = rec['123'] || rec['Action1'] || rec['Action 1'] || '';
  const a2 = rec['456'] || rec['Action2'] || rec['Action 2'] || '';
  const actions = [];
  if (a1) actions.push({ key: 'action1', text: a1 });
  if (a2) actions.push({ key: 'action2', text: a2 });
  return actions;
}

function parseIntSafe(s, fallback = 0) {
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function splitTraits(s) {
  if (!s) return [];
  return s.split(',').map(t => t.trim()).filter(Boolean);
}

function mapRecord(rec, rarity) {
  const name = rec['Name']?.trim();
  // Note: Common CSV uses 'Type' for element; Rare/Elite use 'Element'
  const elements = parseElements(rec['Element'] || rec['Type'] || rec['Elements']);
  const primaryElement = elements[0] || null;
  return {
    key: slugify(name),
    name,
    rarity,
    elements,
    element: primaryElement,
    maxCorruption: parseIntSafe(rec['Corruption'], 1),
    speed: parseIntSafe(rec['Speed'], 0),
    range: parseIntSafe(rec['Range'], 1),
    traits: splitTraits(rec['Traits']),
    actions: normalizeActions(rec),
  };
}

function build() {
  const out = { enemies: {} };
  for (const { file, rarity } of FILES) {
    const p = path.join(GAME_INFO, file);
    if (!fs.existsSync(p)) {
      console.warn(`[warn] Missing CSV: ${file}`);
      continue;
    }
    const txt = fs.readFileSync(p, 'utf8');
    const { records } = parseCSV(txt);
    for (const rec of records) {
      if (!rec['Name']) continue;
      const e = mapRecord(rec, rarity);
      out.enemies[e.key] = {
        name: e.name,
        rarity: e.rarity,
        elements: e.elements,
        element: e.element,
        maxCorruption: e.maxCorruption,
        speed: e.speed,
        range: e.range,
        traits: e.traits,
        attacks: Object.fromEntries(e.actions.map(a => [a.key, { description: a.text }]))
      };
    }
  }

  // Merge in any existing custom fields from current enemies.json if present
  try {
    if (fs.existsSync(OUT_PATH)) {
      const existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
      if (existing && existing.enemies) {
        for (const [k, v] of Object.entries(existing.enemies)) {
          if (!out.enemies[k]) {
            out.enemies[k] = v; // keep old ones
          }
        }
      }
    }
  } catch (e) {
    console.warn('[warn] Could not merge existing enemies.json:', e.message);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${OUT_PATH} with ${Object.keys(out.enemies).length} enemies.`);
}

if (require.main === module) {
  build();
}
