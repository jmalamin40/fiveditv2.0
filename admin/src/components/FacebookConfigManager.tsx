import { useState, useEffect } from 'react';
import { MessageCircle, Save } from 'lucide-react';
import { getFacebookConfig, updateFacebookConfig, type FacebookConfig } from '../api';

interface Props {
  token: string;
  toast?: { success: (msg: string) => void; error: (msg: string) => void };
}

const defaultConfig: FacebookConfig = {
  pixel_enabled: false,
  pixel_id: '',
  pixel_access_token: '',
  conv_api_enabled: false,
  page_id: '',
  page_access_token: '',
};

export default function FacebookConfigManager({ token, toast }: Props) {
  const [config, setConfig] = useState<FacebookConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getFacebookConfig(token)
      .then(setConfig)
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFacebookConfig(token, config);
      toast?.success('Facebook settings saved.');
    } catch {
      toast?.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#64748b' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="facebook-config-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageCircle size={24} />
          Facebook Pixel &amp; Conversations API
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Configure Facebook Pixel for tracking (PageView, Purchase, Lead, etc.) and optionally the Conversations API for server-side events. Both can be enabled and configured below.
        </p>
      </div>

      <div className="card-panel" style={{ maxWidth: '36rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Facebook Pixel</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
          Get your Pixel ID from Meta Events Manager (Business Settings → Data Sources → Pixels). The pixel will load on your site and track PageView and custom events (Purchase, Lead, ViewContent, etc.).
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.pixel_enabled}
            onChange={(e) => setConfig((c) => ({ ...c, pixel_enabled: e.target.checked }))}
          />
          Enable Facebook Pixel
        </label>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Pixel ID</label>
        <input
          type="text"
          value={config.pixel_id}
          onChange={(e) => setConfig((c) => ({ ...c, pixel_id: e.target.value.trim() }))}
          placeholder="e.g. 1234567890123456"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Pixel Access Token (optional, for Conversions API server-side events)</label>
        <input
          type="password"
          autoComplete="off"
          value={config.pixel_access_token}
          onChange={(e) => setConfig((c) => ({ ...c, pixel_access_token: e.target.value }))}
          placeholder="Optional: for server-side event matching"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>Generate in Events Manager → Data Sources → your Pixel → Settings → Generate Access Token.</p>
      </div>

      <div className="card-panel" style={{ maxWidth: '36rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Facebook Conversations API / Page</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
          Optional: send server-side events (e.g. Purchase, Lead) to Meta for better attribution and for use with Messenger/Conversations API. Use a Page Access Token with the required permissions.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.conv_api_enabled}
            onChange={(e) => setConfig((c) => ({ ...c, conv_api_enabled: e.target.checked }))}
          />
          Enable server-side events (Conversations API / Conversions API)
        </label>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Page ID</label>
        <input
          type="text"
          value={config.page_id}
          onChange={(e) => setConfig((c) => ({ ...c, page_id: e.target.value.trim() }))}
          placeholder="Facebook Page ID"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Page Access Token</label>
        <input
          type="password"
          autoComplete="off"
          value={config.page_access_token}
          onChange={(e) => setConfig((c) => ({ ...c, page_access_token: e.target.value }))}
          placeholder="Page Access Token (with ads_management or pages_read_engagement)"
          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-primary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        {saving ? 'Saving…' : <><Save size={18} /> Save config</>}
      </button>
    </div>
  );
}
