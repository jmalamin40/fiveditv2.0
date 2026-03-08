'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

export interface FacebookPixelConfig {
  pixel_enabled: boolean;
  pixel_id: string | null;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/**
 * Track a standard or custom Facebook Pixel event.
 * Use after the pixel has loaded (e.g. from any page or component).
 */
export function trackFacebookEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (params) {
    window.fbq('track', eventName, params);
  } else {
    window.fbq('track', eventName);
  }
}

/**
 * Track custom event (for Conversions API / custom events).
 */
export function trackFacebookCustomEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (params) {
    window.fbq('trackCustom', eventName, params);
  } else {
    window.fbq('trackCustom', eventName);
  }
}

export default function FacebookPixel() {
  const [config, setConfig] = useState<FacebookPixelConfig | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/facebook-config/public`)
      .then((res) => res.json())
      .then((data: FacebookPixelConfig) => setConfig(data))
      .catch(() => setConfig({ pixel_enabled: false, pixel_id: null }));
  }, []);

  if (!config?.pixel_enabled || !config?.pixel_id) return null;

  const pixelId = config.pixel_id;

  return (
    <>
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
