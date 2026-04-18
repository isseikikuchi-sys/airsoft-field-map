import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllFields, getFieldById, getUpdate } from '@/lib/data';

export function generateStaticParams() {
  return getAllFields().map((f) => ({ id: f.id }));
}

export default async function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const field = getFieldById(id);
  if (!field) notFound();
  const update = getUpdate(id);

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <Link href="/" className="text-xs text-dive-accent hover:underline">← マップに戻る</Link>

      <header>
        <h1 className="text-2xl font-bold">{field.name}</h1>
        <div className="text-sm text-dive-muted mt-1">
          {field.prefecture} · {field.type}
          {field.size_sqm ? ` · ${field.size_sqm.toLocaleString()}㎡` : ''}
        </div>
        <div className="text-sm mt-1">{field.address}</div>
        <div className="flex gap-3 mt-3 text-sm">
          {field.official_url && <a href={field.official_url} target="_blank" rel="noreferrer" className="text-dive-accent hover:underline">公式サイト →</a>}
          {field.reservation_url && <a href={field.reservation_url} target="_blank" rel="noreferrer" className="bg-dive-accent text-black font-bold px-3 py-1 rounded hover:opacity-90">予約する</a>}
          {field.twitter_x && <a href={field.twitter_x} target="_blank" rel="noreferrer" className="text-dive-accent hover:underline">X →</a>}
        </div>
      </header>

      {/* Schedule */}
      <section className="bg-dive-panel rounded-lg p-4 border border-white/10">
        <h2 className="text-sm font-bold mb-3 text-dive-muted uppercase tracking-wider">明日以降のスケジュール</h2>
        {update?.upcoming_schedule?.length ? (
          <ul className="space-y-2">
            {update.upcoming_schedule.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-dive-accent">{s.date}</span>
                <span className="flex-1">{s.title}</span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dive-muted">情報なし</p>
        )}
      </section>

      {/* Cancellations */}
      {update?.recent_cancellations?.length ? (
        <section className="bg-dive-panel rounded-lg p-4 border border-red-400/30">
          <h2 className="text-sm font-bold mb-3 text-red-400 uppercase tracking-wider">直近の中止</h2>
          <ul className="space-y-2">
            {update.recent_cancellations.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-mono text-red-400 mr-2">{s.date}</span>
                {s.title}
                {s.note && <span className="text-dive-muted"> — {s.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Weather */}
      <section className="bg-dive-panel rounded-lg p-4 border border-white/10">
        <h2 className="text-sm font-bold mb-3 text-dive-muted uppercase tracking-wider">天気予報 (7日)</h2>
        {update?.weather?.length ? (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            {update.weather.map((w) => (
              <div key={w.date} className="bg-dive-bg rounded p-2 text-center">
                <div className="text-xs text-dive-muted">{w.date.slice(5)}</div>
                <div className="text-xs mt-1">{w.summary}</div>
                <div className="text-sm mt-1">
                  <span className="text-red-300">{Math.round(w.tmax)}°</span>
                  <span className="text-dive-muted mx-1">/</span>
                  <span className="text-blue-300">{Math.round(w.tmin)}°</span>
                </div>
                <div className="text-xs text-dive-muted mt-1">💧{w.precip_prob}%</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-dive-muted">座標未設定</p>
        )}
      </section>

      {/* News */}
      {update?.latest_news ? (
        <section className="bg-dive-panel rounded-lg p-4 border border-white/10">
          <h2 className="text-sm font-bold mb-2 text-dive-muted uppercase tracking-wider">最新のお知らせ</h2>
          <p className="text-sm">{update.latest_news}</p>
        </section>
      ) : null}

      {/* Images */}
      {update?.image_urls?.length ? (
        <section>
          <h2 className="text-sm font-bold mb-3 text-dive-muted uppercase tracking-wider">フィールドの様子</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {update.image_urls.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="" className="w-full h-40 object-cover rounded border border-white/10" loading="lazy" />
            ))}
          </div>
        </section>
      ) : null}

      {update?.fetch_error && (
        <div className="text-xs text-red-400/70">情報取得エラー: {update.fetch_error}</div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    scheduled: { text: '開催', cls: 'bg-green-500/20 text-green-300' },
    cancelled: { text: '中止', cls: 'bg-red-500/20 text-red-300' },
    full: { text: '満員', cls: 'bg-yellow-500/20 text-yellow-300' },
    unknown: { text: '—', cls: 'bg-white/10 text-dive-muted' },
  };
  const m = map[status] ?? map.unknown;
  return <span className={`text-xs px-2 py-0.5 rounded ${m.cls}`}>{m.text}</span>;
}
