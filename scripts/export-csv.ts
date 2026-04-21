/**
 * Export data/fields.json → data/fields_initial.csv (for importing into Google Sheets).
 * Run once to seed the spreadsheet, then the sheet becomes the source of truth.
 *
 * Usage: npm run export-csv
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FieldsFile } from '../src/lib/types';

const FIELDS_PATH = path.resolve('data/fields.json');
const OUT_PATH = path.resolve('data/fields_initial.csv');

const COLUMNS = [
  'id',
  'name',
  'prefecture',
  'address',
  'type',
  'official_url',
  'events_url',
  'reservation_url',
  'twitter_x',
  'size_sqm',
  'notes',
  'gallery_urls',
] as const;

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const raw = await readFile(FIELDS_PATH, 'utf8');
  const file: FieldsFile = JSON.parse(raw);
  const lines: string[] = [];
  lines.push(COLUMNS.join(','));
  for (const f of file.fields) {
    const row = COLUMNS.map((col) => {
      // size_sqm may be null → empty
      if (col === 'gallery_urls') {
        const urls = (f as unknown as { gallery_urls?: string[] }).gallery_urls ?? [];
        return csvCell(urls.join('\n'));
      }
      if (col === 'events_url') {
        return csvCell((f as unknown as { events_url?: string | null }).events_url ?? '');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (f as any)[col];
      return csvCell(v ?? '');
    });
    lines.push(row.join(','));
  }
  await writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${file.fields.length} rows to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
