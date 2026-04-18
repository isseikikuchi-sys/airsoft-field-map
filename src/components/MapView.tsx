'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Field } from '@/lib/types';

interface Props {
  fields: Field[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export default function MapView({ fields, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [138.5, 37.5],
      zoom: 4.5,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      for (const f of fields) {
        if (f.lat == null || f.lng == null) continue;
        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        el.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:#14AA32;border:2px solid #000000;box-shadow:0 0 0 2px rgba(20,170,50,0.5)"></div>`;
        el.addEventListener('click', () => onSelect?.(f.id));
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([f.lng, f.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setHTML(
              `<div style="min-width:180px"><b>${escapeHtml(f.name)}</b><br/>${escapeHtml(f.prefecture)} · ${escapeHtml(f.type)}<br/><a href="/field/${f.id}/" style="color:#14AA32;font-weight:700">詳細 →</a></div>`
            )
          )
          .addTo(map);
        markersRef.current.set(f.id, m);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [fields, onSelect]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const f = fields.find((x) => x.id === selectedId);
    if (!f || f.lat == null || f.lng == null) return;
    mapRef.current.flyTo({ center: [f.lng, f.lat], zoom: 11 });
    markersRef.current.get(selectedId)?.togglePopup();
  }, [selectedId, fields]);

  return <div ref={container} className="w-full h-full min-h-[500px]" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
