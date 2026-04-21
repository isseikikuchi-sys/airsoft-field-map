'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  username: string;
  height?: number;
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (target?: HTMLElement) => void;
      };
    };
  }
}

const SCRIPT_ID = 'twitter-widgets-script';
let scriptPromise: Promise<void> | null = null;

function ensureScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.twttr?.widgets) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = 'https://platform.twitter.com/widgets.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('widgets.js load failed'));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Embed an X (Twitter) profile timeline using widgets.js.
 * Falls back to a plain link if the widget fails to render
 * (e.g. localhost rate-limits, network blocks, ad blockers).
 */
export default function TwitterTimeline({ username, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let failTimer: ReturnType<typeof setTimeout> | null = null;

    ensureScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.twttr?.widgets) return;
        window.twttr.widgets.load(containerRef.current);
        pollTimer = setInterval(() => {
          if (cancelled) return;
          const ifr = containerRef.current?.querySelector<HTMLIFrameElement>('iframe');
          if (ifr && ifr.offsetHeight > 0) {
            setStatus('ready');
            if (pollTimer) clearInterval(pollTimer);
            if (failTimer) clearTimeout(failTimer);
          }
        }, 500);
        failTimer = setTimeout(() => {
          if (cancelled) return;
          if (pollTimer) clearInterval(pollTimer);
          setStatus((s) => (s === 'loading' ? 'error' : s));
        }, 8000);
      })
      .catch(() => !cancelled && setStatus('error'));

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (failTimer) clearTimeout(failTimer);
    };
  }, [username]);

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-dive-subtle bg-dive-surface p-4 text-center">
        <div className="text-xs text-dive-muted mb-2">タイムラインを表示できません</div>
        <a
          href={`https://x.com/${username}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold hover:opacity-90"
        >
          @{username} をXで開く
        </a>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden border border-dive-subtle bg-white"
        style={{ minHeight: height, width: '100%' }}
      >
        <a
          className="twitter-timeline"
          data-height={height}
          data-chrome="noheader nofooter transparent"
          data-theme="light"
          data-dnt="true"
          data-lang="ja"
          href={`https://twitter.com/${username}?ref_src=twsrc%5Etfw`}
        >
          Tweets by @{username}
        </a>
      </div>
      {status === 'loading' && (
        <div className="text-[10px] text-dive-muted mt-1 text-center py-1">読み込み中…</div>
      )}
    </div>
  );
}
