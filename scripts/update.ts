/**
 * Daily updater — runs via GitHub Actions cron (06:30 JST).
 * - Fetches each field's official site, asks Claude API to extract schedule/news/images
 * - Fetches 7-day weather from Open-Meteo
 * - Writes data/updates.json
 *
 * Requires: ANTHROPIC_API_KEY in env.
 * Flag: --weather-only  → skip site scraping
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import type { Field, FieldsFile, FieldUpdate, UpdatesFile, ScheduleEntry, WeatherDay } from '../src/lib/types';

const FIELDS_PATH = path.resolve('data/fields.json');
const UPDATES_PATH = path.resolve('data/updates.json');
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const CONCURRENCY = 4;
const WEATHER_ONLY = process.argv.includes('--weather-only');

const anthropic = new Anthropic();

// ---------------- utilities ----------------

function todayJstIso(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  n: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: n }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------- scraping ----------------

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (airsoft-field-map/0.1)',
      'Accept-Language': 'ja,en;q=0.8',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function extractTextAndImages(html: string, baseUrl: string): { text: string; images: string[] } {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12_000);
  const images: string[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    try {
      const abs = new URL(src, baseUrl).toString();
      if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(abs)) images.push(abs);
    } catch {}
  });
  return { text, images: Array.from(new Set(images)).slice(0, 8) };
}

// ---------------- Claude parsing ----------------

const EXTRACT_SCHEMA_PROMPT = `あなたはサバイバルゲームフィールドの公式サイトからイベント情報を抽出するアシスタントです。
与えられたページテキストから以下のJSONをそのまま返してください。余計なコメント・前置きは一切禁止です。
JSONスキーマ:
{
  "upcoming_schedule": [ { "date": "YYYY-MM-DD", "title": "定例会名など", "status": "scheduled" | "cancelled" | "full" | "unknown", "note": "補足(短文)|null" } ],
  "recent_cancellations": [ { "date": "YYYY-MM-DD", "title": "...", "status": "cancelled", "note": "理由など|null" } ],
  "latest_news": "直近の重要告知(1-2文)|null"
}
ルール:
- 今日 (TODAY) 以降のスケジュールのみ upcoming_schedule に含める (最大10件)
- 日付が不明なものは含めない
- recent_cancellations は過去30日以内に中止になった定例会
- 読み取れない場合は空配列/null を返す
- JSON以外は絶対に返さない`;

async function extractFromPage(
  field: Field,
  pageText: string
): Promise<{ upcoming: ScheduleEntry[]; cancellations: ScheduleEntry[]; news: string | null }> {
  const today = todayJstIso();
  const userPrompt = `TODAY: ${today}\nFIELD: ${field.name} (${field.prefecture})\n\n---ページテキスト---\n${pageText}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: EXTRACT_SCHEMA_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = resp.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text in response');
  const raw = block.text.trim();
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) throw new Error('No JSON in response');
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  return {
    upcoming: (parsed.upcoming_schedule || []).filter((x: ScheduleEntry) => x.date >= today).slice(0, 10),
    cancellations: (parsed.recent_cancellations || []).slice(0, 5),
    news: parsed.latest_news ?? null,
  };
}

// ---------------- weather ----------------

async function fetchWeather(lat: number, lng: number): Promise<WeatherDay[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  );
  url.searchParams.set('timezone', 'Asia/Tokyo');
  url.searchParams.set('forecast_days', '8');
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
  const j = (await res.json()) as {
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
    };
  };
  return j.daily.time.map((date, i) => ({
    date,
    tmax: j.daily.temperature_2m_max[i],
    tmin: j.daily.temperature_2m_min[i],
    precip_prob: j.daily.precipitation_probability_max[i] ?? 0,
    weather_code: j.daily.weather_code[i],
    summary: wmoCodeToText(j.daily.weather_code[i]),
  }));
}

function wmoCodeToText(code: number): string {
  const m: Record<number, string> = {
    0: '快晴', 1: '晴', 2: '薄曇', 3: '曇り',
    45: '霧', 48: '霧(着氷)',
    51: '霧雨', 53: '霧雨', 55: '強霧雨',
    61: '小雨', 63: '雨', 65: '強雨',
    71: '小雪', 73: '雪', 75: '大雪',
    77: '雪粒',
    80: 'にわか雨', 81: 'にわか雨', 82: '強いにわか雨',
    85: 'にわか雪', 86: '強いにわか雪',
    95: '雷雨', 96: '雷雨(雹)', 99: '雷雨(強雹)',
  };
  return m[code] ?? '不明';
}

// ---------------- main ----------------

async function updateOne(field: Field, prev: FieldUpdate | undefined): Promise<FieldUpdate> {
  const now = new Date().toISOString();
  const base: FieldUpdate = {
    field_id: field.id,
    fetched_at: now,
    fetch_ok: false,
    fetch_error: null,
    upcoming_schedule: prev?.upcoming_schedule ?? [],
    recent_cancellations: prev?.recent_cancellations ?? [],
    latest_news: prev?.latest_news ?? null,
    image_urls: prev?.image_urls ?? [],
    weather: prev?.weather ?? [],
  };

  // Weather
  if (field.lat != null && field.lng != null) {
    try {
      base.weather = await fetchWeather(field.lat, field.lng);
    } catch (e) {
      console.warn(`[${field.id}] weather: ${(e as Error).message}`);
    }
  }

  if (WEATHER_ONLY) {
    base.fetch_ok = true;
    return base;
  }

  // Site scraping + Claude parsing. Prefer events_url for schedule, use official_url for cover images.
  const eventsSource = field.events_url || field.official_url;
  if (!eventsSource) {
    base.fetch_error = 'no events_url or official_url';
    return base;
  }
  try {
    // Cover images: pull from official_url (usually the storefront / top page)
    if (field.official_url) {
      try {
        const html = await fetchHtml(field.official_url);
        const { images } = extractTextAndImages(html, field.official_url);
        base.image_urls = images;
      } catch (e) {
        console.warn(`[${field.id}] images: ${(e as Error).message}`);
      }
    }
    // Schedule: pull from events_url (falls back to official_url via eventsSource)
    const html = await fetchHtml(eventsSource);
    const { text } = extractTextAndImages(html, eventsSource);
    const { upcoming, cancellations, news } = await extractFromPage(field, text);
    base.upcoming_schedule = upcoming;
    base.recent_cancellations = cancellations;
    base.latest_news = news;
    base.fetch_ok = true;
    console.log(`[${field.id}] OK (${upcoming.length} upcoming, ${base.image_urls.length} imgs)`);
  } catch (e) {
    base.fetch_error = (e as Error).message;
    console.warn(`[${field.id}] FAIL: ${base.fetch_error}`);
  }
  return base;
}

async function main() {
  const fieldsRaw = await readFile(FIELDS_PATH, 'utf8');
  const fieldsFile: FieldsFile = JSON.parse(fieldsRaw);

  let prevFile: UpdatesFile = { last_updated: '', updates: {} };
  try {
    prevFile = JSON.parse(await readFile(UPDATES_PATH, 'utf8'));
  } catch {
    // first run
  }

  console.log(`Updating ${fieldsFile.fields.length} fields (weatherOnly=${WEATHER_ONLY})…`);

  const results = await mapWithConcurrency(fieldsFile.fields, CONCURRENCY, async (f) =>
    updateOne(f, prevFile.updates[f.id])
  );

  const next: UpdatesFile = {
    last_updated: new Date().toISOString(),
    updates: Object.fromEntries(results.map((u) => [u.field_id, u])),
  };
  await writeFile(UPDATES_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${UPDATES_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
