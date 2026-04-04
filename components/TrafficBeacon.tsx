'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

const VISITOR_KEY = 'traffic_visitor_id';
const SESSION_KEY = 'traffic_session_id';
const START_KEY = 'traffic_session_start_ms';
/** First ?ref= on this tab (e.g. email in campaign link); kept for whole session. */
const REF_CAPTURE_KEY = 'traffic_ref_param';

function getOrCreateVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return `v-${Date.now()}`;
  }
}

function getOrCreateSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem(SESSION_KEY, s);
      sessionStorage.setItem(START_KEY, String(Date.now()));
    }
    return s;
  } catch {
    return `s-${Date.now()}`;
  }
}

function getSessionStartMs(): number {
  try {
    const t = sessionStorage.getItem(START_KEY);
    if (t) {
      const n = parseInt(t, 10);
      if (Number.isFinite(n)) return n;
    }
    const now = Date.now();
    sessionStorage.setItem(START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function currentDurationSeconds(): number {
  return Math.max(0, Math.floor((Date.now() - getSessionStartMs()) / 1000));
}

/** Capture ?ref= from URL once per tab (persists after client-side navigation drops query string). */
function ensureRefCapturedFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const cur = new URLSearchParams(window.location.search).get('ref');
    if (cur != null && cur !== '' && !sessionStorage.getItem(REF_CAPTURE_KEY)) {
      sessionStorage.setItem(REF_CAPTURE_KEY, cur.trim().substring(0, 320));
    }
  } catch {
    /* ignore */
  }
}

function getCapturedRef(): string | undefined {
  try {
    const r = sessionStorage.getItem(REF_CAPTURE_KEY);
    return r && r.trim() ? r.trim() : undefined;
  } catch {
    return undefined;
  }
}

function buildPayload(
  path: string | null,
  referrer: string | undefined,
  durationSeconds: number
): Record<string, unknown> {
  ensureRefCapturedFromUrl();
  const visitor_id = getOrCreateVisitorId();
  const session_id = getOrCreateSessionId();
  const refParam = getCapturedRef();
  const body: Record<string, unknown> = {
    visitor_id,
    session_id,
    duration_seconds: durationSeconds,
  };
  if (refParam) body.ref_param = refParam;
  if (path != null && path !== '') {
    body.path = path;
    if (referrer) body.referrer = referrer;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const us = params.get('utm_source');
      const um = params.get('utm_medium');
      const uc = params.get('utm_campaign');
      if (us) body.utm_source = us;
      if (um) body.utm_medium = um;
      if (uc) body.utm_campaign = uc;
    }
  }
  return body;
}

function postTrack(body: Record<string, unknown>) {
  return fetch(`${API_BASE}/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

function beaconTrack(body: Record<string, unknown>) {
  const url = `${API_BASE}/analytics/track`;
  const json = JSON.stringify(body);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([json], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) return;
  }
  postTrack(body);
}

export default function TrafficBeacon() {
  const pathname = usePathname() || '/';
  const initialReferrerRef = useRef('');
  const firstPathSentRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initialReferrerRef.current = document.referrer || '';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = pathname || '/';
    const duration = currentDurationSeconds();
    const referrer = firstPathSentRef.current ? undefined : initialReferrerRef.current || undefined;
    firstPathSentRef.current = true;
    void postTrack(buildPayload(path, referrer, duration));
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pingDuration = () => {
      beaconTrack(buildPayload(null, undefined, currentDurationSeconds()));
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pingDuration();
    };

    window.addEventListener('pagehide', pingDuration);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', pingDuration);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
