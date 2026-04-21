'use client';

import { useState } from 'react';
import ImageLightbox from './ImageLightbox';
import TwitterTimeline from './TwitterTimeline';
import type { Field, FieldUpdate } from '@/lib/types';

function extractXUsername(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:twitter\.com|x\.com)\/(?!(?:i|home|search|hashtag|explore)(?:\/|$))([A-Za-z0-9_]{1,15})/);
  return m?.[1] ?? null;
}

interface Props {
  field: Field;
  update: FieldUpdate | undefined;
  distanceKm?: number | null;
  onClose: () => void;
}

export default function FieldDetailPanel({ field, update, distanceKm, onClose }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Prefer curated gallery from the spreadsheet; fall back to auto-scraped images.
  const gallery = field.gallery_urls && field.gallery_urls.length
    ? field.gallery_urls
    : (update?.image_urls ?? []);
  const xUsername = extractXUsername(field.twitter_x);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Sticky top bar with back */}
      <div className="sticky top-0 z-10 bg-white border-b border-dive-subtle px-4 py-3 flex items-center gap-2">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-dive-surface text-lg"
          aria-label="閉じる"
        >
          ✕
        </button>
        <div className="text-xs text-dive-muted truncate">{field.prefecture} · {field.type}</div>
        {distanceKm != null && (
          <div className="ml-auto text-[10px] text-dive-muted">📍 {distanceKm.toFixed(1)} km</div>
        )}
      </div>

      {/* Cover image */}
      {gallery[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gallery[0]}
          alt=""
          className="w-full h-44 object-cover cursor-zoom-in"
          loading="lazy"
          onClick={() => setLightbox(gallery[0])}
        />
      )}

      <div className="flex-1 overflow-y-auto dive-scroll">
        <div className="p-5 space-y-5">
          {/* Header */}
          <header>
            <h1 className="font-display text-2xl tracking-wide leading-tight">{field.name}</h1>
            <div className="mt-1 text-xs text-dive-muted">
              {field.type}{field.size_sqm ? ` · ${field.size_sqm.toLocaleString()}㎡` : ''}
            </div>
          </header>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {field.reservation_url && (
              <a
                href={field.reservation_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-5 py-2 rounded-full bg-dive-accent text-white text-sm font-bold hover:opacity-90"
              >
                予約する
              </a>
            )}
            {field.official_url && (
              <a
                href={field.official_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-5 py-2 rounded-full bg-black text-white text-sm font-bold hover:opacity-90"
              >
                公式サイト
              </a>
            )}
            {field.twitter_x && (
              <a
                href={field.twitter_x}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-5 py-2 rounded-full border border-dive-subtle text-sm font-bold hover:border-dive-ink"
              >
                X
              </a>
            )}
          </div>

          {/* Basic info */}
          <Row label="住所" value={field.address} />
          {field.notes && <Row label="概要" value={field.notes} />}

          {/* Schedule */}
          <Section title="スケジュール" small="明日以降">
            {update?.upcoming_schedule?.length ? (
              <ul className="divide-y divide-dive-subtle">
                {update.upcoming_schedule.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="font-display text-dive-accent w-20 shrink-0 text-xs">{s.date}</span>
                    <span className="flex-1 text-sm">{s.title}</span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-dive-muted">情報なし</p>
            )}
          </Section>

          {/* Cancellations */}
          {update?.recent_cancellations?.length ? (
            <Section title="直近の中止" accent="danger">
              <ul className="divide-y divide-dive-subtle">
                {update.recent_cancellations.map((s, i) => (
                  <li key={i} className="py-2 text-sm flex items-center gap-3">
                    <span className="font-display text-dive-danger w-20 shrink-0 text-xs">{s.date}</span>
                    <span className="flex-1">
                      {s.title}
                      {s.note && <span className="text-dive-muted"> — {s.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Weather — 8 days, 4 per row */}
          <Section title="天気" small="8日予報">
            {update?.weather?.length ? (
              <div className="grid grid-cols-4 gap-2">
                {update.weather.slice(0, 8).map((w) => (
                  <div
                    key={w.date}
                    className="bg-dive-surface rounded-md p-2 text-center border border-dive-subtle"
                  >
                    <div className="text-[10px] text-dive-muted font-bold">{w.date.slice(5)}</div>
                    <div className="text-[10px] mt-0.5">{w.summary}</div>
                    <div className="text-xs mt-1 font-display">
                      <span className="text-dive-danger">{Math.round(w.tmax)}°</span>
                      <span className="text-dive-muted mx-0.5">/</span>
                      <span className="text-[#1D4ED8]">{Math.round(w.tmin)}°</span>
                    </div>
                    <div className="text-[10px] text-dive-muted">💧{w.precip_prob}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-dive-muted">座標未設定</p>
            )}
          </Section>

          {/* News */}
          {update?.latest_news && (
            <Section title="お知らせ">
              <p className="text-sm leading-relaxed">{update.latest_news}</p>
            </Section>
          )}

          {/* Gallery (excluding the cover image) */}
          {gallery.length > 1 && (
            <Section title="ギャラリー">
              <div className="grid grid-cols-3 gap-1.5">
                {gallery.slice(1, 13).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={u}
                    src={u}
                    alt=""
                    className="w-full h-20 object-cover rounded border border-dive-subtle cursor-zoom-in hover:opacity-90"
                    loading="lazy"
                    onClick={() => setLightbox(u)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* X (Twitter) timeline */}
          {xUsername && (
            <Section title="X" small={`@${xUsername}`}>
              <TwitterTimeline username={xUsername} height={500} />
            </Section>
          )}

          {update?.fetch_error && (
            <div className="text-[10px] text-dive-muted">情報取得エラー: {update.fetch_error}</div>
          )}
        </div>
      </div>

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] text-dive-muted font-bold">{label.toUpperCase()}</div>
      <div className="text-sm mt-1 leading-relaxed">{value}</div>
    </div>
  );
}

function Section({
  title,
  small,
  accent,
  children,
}: {
  title: string;
  small?: string;
  accent?: 'danger';
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2 pb-1.5 border-b border-dive-subtle">
        <h2 className={`font-bold text-sm ${accent === 'danger' ? 'text-dive-danger' : 'text-dive-ink'}`}>
          {title}
        </h2>
        {small && <span className="text-[10px] text-dive-muted">{small}</span>}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    scheduled: { text: '開催', cls: 'bg-dive-accent text-white' },
    cancelled: { text: '中止', cls: 'bg-dive-danger text-white' },
    full: { text: '満員', cls: 'bg-yellow-500 text-black' },
    unknown: { text: '—', cls: 'bg-dive-subtle text-dive-muted' },
  };
  const m = map[status] ?? map.unknown;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.text}</span>;
}
