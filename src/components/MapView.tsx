'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Field } from '@/lib/types';

interface Props {
  fields: Field[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function MapView({ fields, selectedId, onSelect, userLocation }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

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
        const el = buildMarkerEl(f.id === selectedId);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect?.(f.id);
        });
        const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([f.lng, f.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 24, closeButton: false, closeOnClick: false }).setHTML(
              `<div style="min-width:160px;font-family:'Noto Sans JP',sans-serif"><div style="font-size:10px;letter-spacing:0.2em;color:#6B7280;margin-bottom:2px">${escapeHtml(f.prefecture)}</div><div style="font-weight:700;font-size:13px;color:#0B0B0B;line-height:1.3">${escapeHtml(f.name)}</div><div style="color:#6B7280;font-size:11px;margin-top:2px">${escapeHtml(f.type)}</div></div>`
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
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Update marker selected state
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getElement();
      const svg = el.querySelector('svg');
      if (!svg) return;
      const circle = svg.querySelector('circle.dot');
      if (!circle) return;
      if (id === selectedId) {
        el.style.zIndex = '10';
        circle.setAttribute('r', '9');
      } else {
        el.style.zIndex = '1';
        circle.setAttribute('r', '7');
      }
    });
  }, [selectedId]);

  // Fly to selected
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const f = fields.find((x) => x.id === selectedId);
    if (!f || f.lat == null || f.lng == null) return;
    mapRef.current.flyTo({ center: [f.lng, f.lat], zoom: 11, duration: 800 });
    const m = markersRef.current.get(selectedId);
    if (m && !m.getPopup().isOpen()) m.togglePopup();
  }, [selectedId, fields]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="rgba(29,78,216,0.18)"/><circle cx="12" cy="12" r="6" fill="#1D4ED8" stroke="#fff" stroke-width="2"/></svg>`;
      el.style.cursor = 'default';
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(mapRef.current);
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 10, duration: 900 });
    }
  }, [userLocation]);

  return <div ref={container} className="w-full h-full" />;
}

function buildMarkerEl(selected: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.width = '24px';
  el.style.height = '32px';
  el.style.cursor = 'pointer';
  el.style.display = 'block';
  el.innerHTML = `
    <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.25))">
      <path d="M12 0 C5.4 0 0 5.4 0 12 C0 21 12 32 12 32 C12 32 24 21 24 12 C24 5.4 18.6 0 12 0 Z" fill="#14AA32"/>
      <circle class="dot" cx="12" cy="12" r="${selected ? 9 : 7}" fill="#fff"/>
      <circle cx="12" cy="12" r="3.5" fill="#14AA32"/>
    </svg>`;
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
