import { useState, useEffect } from 'react';
import { Cloud, Save } from 'lucide-react';
import { getCloudflareConfig, updateCloudflareConfig, type CloudflareConfig } from '../api';

interface Props {
  token: string;
  toast?: { success: (msg: string) => void; error: (msg: string) => void };
}

export default function CloudflareConfigManager({ token, toast }: Props) {
  const [config, setConfig] = useState<CloudflareConfig>({
    is_enabled: false,
    api_token: '',
    zone_id: '',
    base_domain: '',
    record_type: 'CNAME',
    target_value: '',
    proxied: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCloudflareConfig(token)
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCloudflareConfig(token, config);
      toast?.success('Cloudflare settings saved.');
    } catch {
      toast?.error('Failed to save. Check fields and try again.');
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
    <div className="cloudflare-config-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cloud size={24} />
          Cloudflare (SMM subdomain DNS)
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          When a customer selects a subdomain for an SMM order, a DNS record will be created in Cloudflare so the subdomain points to your server. Your main domain must be on Cloudflare.
        </p>
      </div>

      <div className="card-panel" style={{ maxWidth: '32rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.is_enabled}
            onChange={(e) => setConfig((c) => ({ ...c, is_enabled: e.target.checked }))}
          />
          Enable Cloudflare DNS for new subdomains
        </label>

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>API Token</label>
        <input
          type="password"
          autoComplete="off"
          value={config.api_token}
          onChange={(e) => setConfig((c) => ({ ...c, api_token: e.target.value }))}
          placeholder="Cloudflare API Token (with Zone:DNS:Edit permission)"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Zone ID</label>
        <input
          type="text"
          value={config.zone_id}
          onChange={(e) => setConfig((c) => ({ ...c, zone_id: e.target.value.trim() }))}
          placeholder="Zone ID for your domain (from Cloudflare dashboard → domain → Overview)"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Base domain</label>
        <input
          type="text"
          value={config.base_domain}
          onChange={(e) => setConfig((c) => ({ ...c, base_domain: e.target.value.trim() }))}
          placeholder="e.g. fivedit.com (root domain for subdomains)"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Record type</label>
        <select
          value={config.record_type}
          onChange={(e) => setConfig((c) => ({ ...c, record_type: e.target.value as 'A' | 'CNAME' }))}
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        >
          <option value="CNAME">CNAME (point to a hostname)</option>
          <option value="A">A (point to an IP)</option>
        </select>

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          {config.record_type === 'A' ? 'Target IP address' : 'Target hostname (CNAME)'}
        </label>
        <input
          type="text"
          value={config.target_value}
          onChange={(e) => setConfig((c) => ({ ...c, target_value: e.target.value.trim() }))}
          placeholder={config.record_type === 'A' ? 'e.g. 1.2.3.4' : 'e.g. fivedit.com'}
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.proxied}
            onChange={(e) => setConfig((c) => ({ ...c, proxied: e.target.checked }))}
          />
          Proxied (orange cloud) – recommended for SSL and DDoS protection
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Save size={18} />
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
