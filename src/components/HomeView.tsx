'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Field, FieldType, Region } from '@/lib/types';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

const TYPES: (FieldType | 'all')[] = ['all', 'インドア', 'アウトドア森林', 'アウトドア市街地（CQB）', '混合', '廃墟系', 'その他'];
const REGIONS: (Region | 'all')[] = ['all', '北海道', '東北', '関東', '中部', '関西', '中国', '四国', '九州', '沖縄'];

interface Props {
  fields: Field[];
  lastUpdated: string;
}

export default function HomeView({ fields, lastUpdated }: Props) {
  const [type, setType] = useState<FieldType | 'all'>('all');
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return fields.filter((f) => {
      if (type !== 'all' && f.type !== type) return false;
      if (region !== 'all' && f.region !== region) return false;
      if (q && !`${f.name}${f.prefecture}${f.address}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [fields, type, region, q]);

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-dive-accent">●</span> 全国サバゲーフィールドマップ
        </h1>
        <span className="text-xs text-dive-muted">
          {lastUpdated ? `更新: ${new Date(lastUpdated).toLocaleString('ja-JP')}` : '未更新'}
        </span>
        <div className="ml-auto flex gap-2 items-center flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名称・地名で検索"
            className="bg-dive-panel text-sm rounded px-2 py-1 border border-white/10 focus:outline-none focus:border-dive-accent"
          />
          <select value={region} onChange={(e) => setRegion(e.target.value as Region | 'all')} className="bg-dive-panel text-sm rounded px-2 py-1 border border-white/10">
            {REGIONS.map((r) => <option key={r} value={r}>{r === 'all' ? '全地域' : r}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as FieldType | 'all')} className="bg-dive-panel text-sm rounded px-2 py-1 border border-white/10">
            {TYPES.map((t) => <option key={t} value={t}>{t === 'all' ? '全タイプ' : t}</option>)}
          </select>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_380px] overflow-hidden">
        <div className="relative">
          <MapView fields={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <aside className="border-l border-white/10 overflow-y-auto bg-dive-panel">
          <div className="p-3 text-xs text-dive-muted border-b border-white/10">
            {filtered.length} 件ヒット / 全{fields.length}件
          </div>
          <ul>
            {filtered.map((f) => (
              <li key={f.id} className={`border-b border-white/5 ${selectedId === f.id ? 'bg-white/5' : ''}`}>
                <button
                  onClick={() => setSelectedId(f.id)}
                  className="w-full text-left px-3 py-2 hover:bg-white/5"
                >
                  <div className="font-medium text-sm">{f.name}</div>
                  <div className="text-xs text-dive-muted">{f.prefecture} · {f.type}{f.size_sqm ? ` · ${f.size_sqm.toLocaleString()}㎡` : ''}</div>
                </button>
                <div className="px-3 pb-2 flex gap-2 text-xs">
                  <Link href={`/field/${f.id}/`} className="text-dive-accent hover:underline">詳細</Link>
                  {f.reservation_url && <a href={f.reservation_url} target="_blank" rel="noreferrer" className="text-dive-accent hover:underline">予約</a>}
                  {f.official_url && <a href={f.official_url} target="_blank" rel="noreferrer" className="text-dive-muted hover:underline">公式</a>}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
