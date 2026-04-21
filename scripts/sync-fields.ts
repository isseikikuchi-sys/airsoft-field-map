/**
 * Sync fields from a Google Sheet (published as CSV) into data/fields.json.
 *
 * Responsibilities:
 *   1. Fetch CSV from FIELDS_CSV_URL
 *   2. Parse rows; auto-derive id / region; normalize gallery URLs (Drive → thumbnail)
 *   3. Preserve existing lat/lng when address unchanged
 *   4. Geocode new rows / address changes via Nominatim (1 req/sec, respectful)
 *   5. Write data/fields.json
 *
 * Required env:
 *   FIELDS_CSV_URL  — published-to-web CSV URL from Google Sheets
 *
 * Optional env:
 *   FIELDS_CSV_FILE — local CSV path override (for testing without network)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Field, FieldType, FieldsFile, Region } from '../src/lib/types';
import { regionForPrefecture } from '../src/lib/prefecture';

const FIELDS_PATH = path.resolve('data/fields.json');
const CSV_URL = process.env.FIELDS_CSV_URL;
const CSV_FILE = process.env.FIELDS_CSV_FILE;
const UA = 'airsoft-field-info-sync/1.0 (DIVE AIRSOFT)';

const VALID_TYPES: FieldType[] = [
  'インドア',
  'アウトドア森林',
  'アウトドア市街地（CQB）',
  '混合',
  '廃墟系',
  'その他',
];

// ----------------- CSV parsing -----------------

/** Minimal RFC-4180 CSV parser (handles quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^\uFEFF/, ''); // strip BOM
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && r.some((v) => v !== ''));
}

// ----------------- URL / ID helpers -----------------

/** Convert Google Drive file share URL → thumbnail URL (public-read, no auth). */
function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Drive file: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  let m = trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
  // Drive open?id=FILE_ID
  m = trimmed.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
  // uc?id=FILE_ID
  m = trimmed.match(/drive\.google\.com\/uc\?(?:export=\w+&)?id=([A-Za-z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
  return trimmed;
}

function parseGalleryUrls(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeImageUrl)
    .filter(Boolean);
}

/** Slugify Japanese-friendly: remove diacritics, kana→latin fallback via romaji is too much.
 *  So we keep a-z0-9 and hyphen, strip rest. If result empty, use a hash of the name. */
function slugify(name: string): string {
  const lower = name.toLowerCase();
  const ascii = lower
    .replace(/[^a-z0-9\s\-_]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (ascii) return ascii;
  // Fall back: hash-like from char codes
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `field-${h.toString(36)}`;
}

function assignUniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

function normalizeNumber(s: string): number | null {
  const t = s.replace(/[,\s㎡m²]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

function normalizeType(raw: string): FieldType {
  const t = raw.trim();
  if ((VALID_TYPES as string[]).includes(t)) return t as FieldType;
  // Common misspellings / casual names
  if (/インドア|indoor/i.test(t)) return 'インドア';
  if (/廃墟|廃校|廃|ruin/i.test(t)) return '廃墟系';
  if (/CQB|市街|cqb/i.test(t)) return 'アウトドア市街地（CQB）';
  if (/森林|森|woods|forest/i.test(t)) return 'アウトドア森林';
  if (/混合|mixed/i.test(t)) return '混合';
  return 'その他';
}

// ----------------- Nominatim geocoder (1 req/sec) -----------------

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'jp');
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ja' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function addressVariants(addr: string): string[] {
  const variants: string[] = [addr];
  const stripBuilding = addr
    .replace(/\s+[^\s]+?ビル.*$/u, '')
    .replace(/\s+\d+F$/u, '');
  if (stripBuilding !== addr) variants.push(stripBuilding);
  const m = addr.match(/^(.{1,4}?[都道府県])(.+?(市|区|町|村))/u);
  if (m) variants.push(`${m[1]}${m[2]}`);
  const p = addr.match(/^(.{1,4}?[都道府県])/u);
  if (p && !variants.includes(p[1])) variants.push(p[1]);
  return Array.from(new Set(variants));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ----------------- main -----------------

async function loadCsv(): Promise<string> {
  if (CSV_FILE) return await readFile(path.resolve(CSV_FILE), 'utf8');
  if (!CSV_URL) throw new Error('FIELDS_CSV_URL (or FIELDS_CSV_FILE) is required');
  const res = await fetch(CSV_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`CSV fetch failed: HTTP ${res.status}`);
  return await res.text();
}

async function loadExistingFields(): Promise<Map<string, Field>> {
  try {
    const raw = await readFile(FIELDS_PATH, 'utf8');
    const file: FieldsFile = JSON.parse(raw);
    return new Map(file.fields.map((f) => [f.id, f]));
  } catch {
    return new Map();
  }
}

function rowToField(
  headers: string[],
  cells: string[],
  existingIds: Set<string>
): Field | { error: string; row: string[] } {
  const get = (col: string) => {
    const idx = headers.indexOf(col);
    return idx >= 0 ? (cells[idx] ?? '').trim() : '';
  };
  const name = get('name');
  if (!name) return { error: 'name is empty', row: cells };
  const prefecture = get('prefecture');
  if (!prefecture) return { error: `prefecture is empty (${name})`, row: cells };
  const address = get('address');
  if (!address) return { error: `address is empty (${name})`, row: cells };
  const region = regionForPrefecture(prefecture);
  if (!region) return { error: `unknown prefecture: ${prefecture} (${name})`, row: cells };

  const explicitId = get('id');
  const id = explicitId || assignUniqueId(slugify(name), existingIds);
  existingIds.add(id);

  return {
    id,
    name,
    prefecture,
    region: region as Region,
    address,
    type: normalizeType(get('type')),
    official_url: emptyToNull(get('official_url')),
    events_url: emptyToNull(get('events_url')),
    reservation_url: emptyToNull(get('reservation_url')),
    twitter_x: emptyToNull(get('twitter_x')),
    size_sqm: normalizeNumber(get('size_sqm')),
    lat: null,
    lng: null,
    notes: get('notes'),
    gallery_urls: parseGalleryUrls(get('gallery_urls')),
  };
}

async function main() {
  console.log('Syncing fields from spreadsheet…');
  const csv = await loadCsv();
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const headers = rows[0].map((h) => h.trim());
  console.log(`CSV: ${rows.length - 1} rows, columns: [${headers.join(', ')}]`);

  const existing = await loadExistingFields();
  const assignedIds = new Set<string>();

  const parseErrors: string[] = [];
  const parsed: Field[] = [];
  for (let i = 1; i < rows.length; i++) {
    const result = rowToField(headers, rows[i], assignedIds);
    if ('error' in result) {
      parseErrors.push(`row ${i + 1}: ${result.error}`);
      continue;
    }
    parsed.push(result);
  }

  if (parseErrors.length) {
    console.warn(`[sync] ${parseErrors.length} rows skipped:\n  ` + parseErrors.join('\n  '));
  }

  // Preserve lat/lng when address unchanged
  const needGeocode: Field[] = [];
  for (const f of parsed) {
    const prev = existing.get(f.id);
    if (prev && prev.address === f.address && prev.lat != null && prev.lng != null) {
      f.lat = prev.lat;
      f.lng = prev.lng;
    } else {
      needGeocode.push(f);
    }
  }

  // Geocode serially (1 req/sec minimum)
  if (needGeocode.length) {
    console.log(`Geocoding ${needGeocode.length} new/changed addresses…`);
    for (const f of needGeocode) {
      const variants = addressVariants(f.address);
      let hit: { lat: number; lng: number } | null = null;
      let tried = '';
      for (const v of variants) {
        tried = v;
        try {
          hit = await geocode(v);
        } catch (e) {
          console.warn(`[${f.id}] geocode error: ${(e as Error).message}`);
        }
        await sleep(1100);
        if (hit) break;
      }
      if (hit) {
        f.lat = hit.lat;
        f.lng = hit.lng;
        console.log(`[${f.id}] geocoded ${hit.lat.toFixed(4)},${hit.lng.toFixed(4)} (via "${tried}")`);
      } else {
        console.warn(`[${f.id}] geocode MISS: ${f.address}`);
      }
    }
  }

  const out: FieldsFile = {
    _meta: {
      note: 'Synced from Google Sheet. Edit the sheet, not this file.',
      last_updated: new Date().toISOString(),
      schema_version: 2,
    },
    fields: parsed,
  };
  await writeFile(FIELDS_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${parsed.length} fields to ${FIELDS_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
