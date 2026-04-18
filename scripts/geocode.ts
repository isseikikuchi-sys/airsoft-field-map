/**
 * Geocode addresses in data/fields.json using OpenStreetMap Nominatim.
 * Run once after editing the field list. Respects Nominatim's 1 req/sec policy.
 *
 * Usage: pnpm run geocode  (or npm/yarn)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FieldsFile } from '../src/lib/types';

const FIELDS_PATH = path.resolve('data/fields.json');
const UA = 'airsoft-field-map/0.1 (https://github.com/you/airsoft-field-map)';

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'jp');

  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip detail parts that Nominatim struggles with. Returns [full, detailStripped, cityLevel]. */
function addressVariants(addr: string): string[] {
  const variants: string[] = [addr];
  // Remove building name and trailing number: e.g. "... 山京ビル8F" or "...2-11-1"
  const stripBuilding = addr.replace(/\s+[^\s]+?ビル.*$/u, '').replace(/\s+\d+F$/u, '');
  if (stripBuilding !== addr) variants.push(stripBuilding);
  // City-level: capture "都道府県 + 市/区/郡...町/村" (prefecture can be 2-4 chars: 東京都 / 神奈川県 / 和歌山県)
  const m = addr.match(/^(.{1,4}?[都道府県])(.+?(市|区|町|村))/u);
  if (m) variants.push(`${m[1]}${m[2]}`);
  // Prefecture only
  const p = addr.match(/^(.{1,4}?[都道府県])/u);
  if (p && !variants.includes(p[1])) variants.push(p[1]);
  return variants;
}

async function main() {
  const raw = await readFile(FIELDS_PATH, 'utf8');
  const file: FieldsFile = JSON.parse(raw);

  let updated = 0;
  for (const field of file.fields) {
    if (field.lat != null && field.lng != null) continue;
    const variants = addressVariants(field.address);
    let hit: { lat: number; lng: number } | null = null;
    let tried = '';
    for (const v of variants) {
      tried = v;
      try {
        hit = await geocode(v);
      } catch (e) {
        console.log(`[${field.id}] ERR ${(e as Error).message}`);
      }
      await sleep(1100);
      if (hit) break;
    }
    if (hit) {
      field.lat = hit.lat;
      field.lng = hit.lng;
      updated++;
      console.log(`[${field.id}] OK ${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}  (via "${tried}")`);
    } else {
      console.log(`[${field.id}] MISS: ${field.address}`);
    }
  }

  file._meta.last_updated = new Date().toISOString();
  await writeFile(FIELDS_PATH, JSON.stringify(file, null, 2) + '\n', 'utf8');
  console.log(`\nDone. Updated ${updated}/${file.fields.length} fields.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
