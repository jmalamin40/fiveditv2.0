import { useState, useEffect } from 'react';
import { Mail, Save } from 'lucide-react';
import { getSmtpConfig, updateSmtpConfig, type SmtpConfig } from '../api';

interface Props {
  token: string;
  toast?: { success: (msg: string) => void; error: (msg: string) => void };
}

const defaultConfig: SmtpConfig = {
  is_enabled: false,
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: '',
  password: '',
  from_address: '',
  require_tls: true,
};

export default function SmtpConfigManager({ token, toast }: Props) {
  const [config, setConfig] = useState<SmtpConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSmtpConfig(token)
      .then(setConfig)
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSmtpConfig(token, config);
      toast?.success('SMTP settings saved. Outgoing email will use this configuration.');
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
    <div className="smtp-config-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mail size={24} />
          SMTP / Email Configuration
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Configure outgoing email (order confirmations, hosting credentials, SMM credentials). If disabled or empty, the app will fall back to SMTP_* variables in .env.
        </p>
      </div>

      <div className="card-panel" style={{ maxWidth: '36rem', marginBottom: '2rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.is_enabled}
            onChange={(e) => setConfig((c) => ({ ...c, is_enabled: e.target.checked }))}
          />
          Use SMTP configuration from database (override .env)
        </label>

        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Host</label>
        <input
          type="text"
          value={config.host}
          onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value.trim() || 'smtp.gmail.com' }))}
          placeholder="smtp.gmail.com"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Port</label>
        <input
          type="number"
          min={1}
          max={65535}
          value={config.port}
          onChange={(e) => setConfig((c) => ({ ...c, port: parseInt(e.target.value, 10) || 587 }))}
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.secure}
            onChange={(e) => setConfig((c) => ({ ...c, secure: e.target.checked }))}
          />
          Secure (SSL/TLS, typically for port 465)
        </label>

        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>User</label>
        <input
          type="text"
          value={config.user}
          onChange={(e) => setConfig((c) => ({ ...c, user: e.target.value.trim() }))}
          placeholder="your-email@gmail.com"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Password</label>
        <input
          type="password"
          autoComplete="new-password"
          value={config.password}
          onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
          placeholder={config.password === '********' ? 'Leave blank to keep current' : 'App password or SMTP password'}
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />
        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>For Gmail, use an App Password. Leave blank to keep existing password.</p>

        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>From address</label>
        <input
          type="text"
          value={config.from_address}
          onChange={(e) => setConfig((c) => ({ ...c, from_address: e.target.value.trim() }))}
          placeholder="noreply@yourdomain.com"
          style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={config.require_tls}
            onChange={(e) => setConfig((c) => ({ ...c, require_tls: e.target.checked }))}
          />
          Require TLS (recommended for port 587)
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="primary-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {saving ? 'Saving…' : 'Save SMTP settings'}
          <Save size={18} />
        </button>
      </div>
    </div>
  );
}
