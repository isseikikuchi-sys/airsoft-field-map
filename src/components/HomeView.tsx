'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import FieldDetailPanel from './FieldDetailPanel';
import { haversineKm, type LatLng } from '@/lib/geo';
import type { Field, FieldType, FieldUpdate, Region } from '@/lib/types';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

const TYPES: (FieldType | 'all')[] = ['all', 'インドア', 'アウトドア森林', 'アウトドア市街地（CQB）', '混合', '廃墟系', 'その他'];
const REGIONS: (Region | 'all')[] = ['all', '北海道', '東北', '関東', '中部', '関西', '中国', '四国', '九州', '沖縄'];

interface Props {
  fields: Field[];
  updates: Record<string, FieldUpdate>;
  lastUpdated: string;
}

export default function HomeView({ fields, updates, lastUpdated }: Props) {
  const [type, setType] = useState<FieldType | 'all'>('all');
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'ok' | 'denied' | 'unavailable'>('idle');

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ok');
      },
      () => setGeoStatus('denied'),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const filtered = useMemo(() => {
    return fields.filter((f) => {
      if (type !== 'all' && f.type !== type) return false;
      if (region !== 'all' && f.region !== region) return false;
      if (q && !`${f.name}${f.prefecture}${f.address}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [fields, type, region, q]);

  const sorted = useMemo(() => {
    if (!userLoc) return filtered;
    return [...filtered].sort((a, b) => {
      const da = a.lat != null && a.lng != null ? haversineKm(userLoc, { lat: a.lat, lng: a.lng }) : Infinity;
      const db = b.lat != null && b.lng != null ? haversineKm(userLoc, { lat: b.lat, lng: b.lng }) : Infinity;
      return da - db;
    });
  }, [filtered, userLoc]);

  const selectedField = selectedId ? fields.find((f) => f.id === selectedId) : null;
  const selectedDistanceKm = useMemo(() => {
    if (!selectedField || !userLoc || selectedField.lat == null || selectedField.lng == null) return null;
    return haversineKm(userLoc, { lat: selectedField.lat, lng: selectedField.lng });
  }, [selectedField, userLoc]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col md:block">
      {/* --- Mobile: map on top + list below (connected, no overlap) --- */}
      <div className="md:hidden flex flex-col h-full">
        <div className="h-[42vh] min-h-[280px] relative border-b border-dive-subtle">
          <MapView fields={sorted} selectedId={selectedId} onSelect={setSelectedId} userLocation={userLoc} />
        </div>
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {selectedField ? (
            <FieldDetailPanel
              field={selectedField}
              update={updates[selectedField.id]}
              distanceKm={selectedDistanceKm}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <ListPanel
              fields={fields}
              filtered={sorted}
              q={q}
              setQ={setQ}
              type={type}
              setType={setType}
              region={region}
              setRegion={setRegion}
              onSelect={setSelectedId}
              lastUpdated={lastUpdated}
              geoStatus={geoStatus}
              onRequestLocation={requestLocation}
              hasUserLoc={!!userLoc}
            />
          )}
        </div>
      </div>

      {/* --- Desktop: side-by-side panels + map (no overlap) --- */}
      <div className="hidden md:flex h-full">
        {/* List panel */}
        <aside className="w-[380px] shrink-0 border-r border-dive-subtle bg-white flex flex-col">
          <ListPanel
            fields={fields}
            filtered={sorted}
            q={q}
            setQ={setQ}
            type={type}
            setType={setType}
            region={region}
            setRegion={setRegion}
            onSelect={setSelectedId}
            lastUpdated={lastUpdated}
            geoStatus={geoStatus}
            onRequestLocation={requestLocation}
            hasUserLoc={!!userLoc}
            selectedId={selectedId}
          />
        </aside>

        {/* Detail panel (opens next to list, pushes map) */}
        {selectedField && (
          <aside className="w-[380px] shrink-0 border-r border-dive-subtle bg-white flex flex-col animate-fadein">
            <FieldDetailPanel
              field={selectedField}
              update={updates[selectedField.id]}
              distanceKm={selectedDistanceKm}
              onClose={() => setSelectedId(null)}
            />
          </aside>
        )}

        {/* Map fills the remaining space */}
        <div className="flex-1 relative">
          <MapView fields={sorted} selectedId={selectedId} onSelect={setSelectedId} userLocation={userLoc} />
        </div>
      </div>
    </div>
  );
}

function ListPanel({
  fields,
  filtered,
  q,
  setQ,
  type,
  setType,
  region,
  setRegion,
  onSelect,
  lastUpdated,
  geoStatus,
  onRequestLocation,
  hasUserLoc,
  selectedId,
}: {
  fields: Field[];
  filtered: Field[];
  q: string;
  setQ: (v: string) => void;
  type: FieldType | 'all';
  setType: (v: FieldType | 'all') => void;
  region: Region | 'all';
  setRegion: (v: Region | 'all') => void;
  onSelect: (id: string) => void;
  lastUpdated: string;
  geoStatus: 'idle' | 'requesting' | 'ok' | 'denied' | 'unavailable';
  onRequestLocation: () => void;
  hasUserLoc: boolean;
  selectedId?: string | null;
}) {
  return (
    <>
      {/* Search */}
      <div className="px-3 pt-3 pb-2 border-b border-dive-subtle">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="サバゲーフィールドを検索"
            className="w-full bg-white text-sm rounded-full pl-10 pr-4 py-2.5 border border-dive-subtle focus:outline-none focus:border-dive-accent shadow-sm"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dive-muted text-sm">🔍</span>
        </div>

        <div className="flex gap-2 mt-2 flex-wrap items-center">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region | 'all')}
            className="bg-white text-xs rounded-full px-3 py-1.5 border border-dive-subtle focus:outline-none focus:border-dive-accent"
          >
            {REGIONS.map((r) => <option key={r} value={r}>{r === 'all' ? '全地域' : r}</option>)}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FieldType | 'all')}
            className="bg-white text-xs rounded-full px-3 py-1.5 border border-dive-subtle focus:outline-none focus:border-dive-accent"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t === 'all' ? '全タイプ' : t}</option>)}
          </select>
          <button
            onClick={onRequestLocation}
            className={`text-xs rounded-full px-3 py-1.5 border font-bold ml-auto ${
              hasUserLoc
                ? 'border-dive-accent text-dive-accent bg-dive-accent/5'
                : 'border-dive-subtle text-dive-muted hover:border-dive-ink'
            }`}
            title="現在地から近い順"
          >
            📍 {hasUserLoc ? '現在地ON' : geoStatus === 'requesting' ? '取得中…' : '現在地'}
          </button>
        </div>
      </div>

      {/* Result count + info */}
      <div className="px-4 py-2 border-b border-dive-subtle text-xs text-dive-muted flex items-center justify-between">
        <span>
          <span className="font-bold text-dive-ink">{filtered.length}</span> 件 / 全 {fields.length} 件
        </span>
        {lastUpdated && (
          <span className="text-[10px]">更新: {new Date(lastUpdated).toLocaleDateString('ja-JP')}</span>
        )}
      </div>

      {/* List */}
      <ul className="flex-1 overflow-y-auto dive-scroll divide-y divide-dive-subtle">
        {filtered.map((f) => (
          <li key={f.id} className={selectedId === f.id ? 'bg-dive-surface' : ''}>
            <button
              onClick={() => onSelect(f.id)}
              className="w-full text-left px-4 py-3 hover:bg-dive-surface transition-colors"
            >
              <div className="text-[10px] tracking-[0.2em] text-dive-muted mb-0.5">{f.prefecture}</div>
              <div className="font-bold text-sm leading-tight">{f.name}</div>
              <div className="text-xs text-dive-muted mt-1">
                {f.type}{f.size_sqm ? ` · ${f.size_sqm.toLocaleString()}㎡` : ''}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-xs text-dive-muted">該当するフィールドがありません</li>
        )}
      </ul>
    </>
  );
}
