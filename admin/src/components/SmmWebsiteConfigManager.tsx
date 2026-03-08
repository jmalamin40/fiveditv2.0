import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { getSmmWebsiteConfig, updateSmmWebsiteConfig, type SmmWebsiteConfig } from '../api';

interface Props {
  token: string;
  toast?: { success: (msg: string) => void; error: (msg: string) => void };
}

const defaultConfig: SmmWebsiteConfig = {
  website_configuration_price: 4999,
  website_configuration_currency: 'BDT',
};

export default function SmmWebsiteConfigManager({ token, toast }: Props) {
  const [config, setConfig] = useState<SmmWebsiteConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSmmWebsiteConfig(token)
      .then(setConfig)
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSmmWebsiteConfig(token, config);
      toast?.success('SMM Website Configuration price saved.');
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
    <div className="smm-website-config-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={24} />
          SMM Website Configuration
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Set the one-time price for the &quot;SMM Website Configuration&quot; service shown on the public SMM page. Customers can purchase this as a separate service.
        </p>
      </div>

      <div className="card-panel" style={{ maxWidth: '28rem', marginBottom: '2rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Price</label>
        <input
          type="number"
          min={0}
          step={1}
          value={config.website_configuration_price}
          onChange={(e) => setConfig((c) => ({ ...c, website_configuration_price: Number(e.target.value) || 0 }))}
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Currency</label>
        <input
          type="text"
          value={config.website_configuration_currency}
          onChange={(e) => setConfig((c) => ({ ...c, website_configuration_currency: e.target.value.trim().toUpperCase() || 'BDT' }))}
          placeholder="e.g. BDT, USD"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="primary-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {saving ? 'Saving…' : 'Save settings'}
          <Save size={18} />
        </button>
      </div>
    </div>
  );
}
