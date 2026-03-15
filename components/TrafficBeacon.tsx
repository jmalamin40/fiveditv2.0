'use client';

import { useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

export default function TrafficBeacon() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname || '/';
    const referrer = document.referrer || '';
    const params = new URLSearchParams(window.location.search);
    const payload = {
      path,
      referrer: referrer || undefined,
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
    };
    fetch(`${API_BASE}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
