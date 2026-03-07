import { useState, useEffect } from 'react';
import { Globe, Save, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getDomainResellerConfig,
  updateDomainResellerConfig,
  fetchDomainTldPricing,
  createDomainTld,
  updateDomainTld,
  deleteDomainTld,
  type DomainResellerConfig,
  type DomainTldPricingRow,
} from '../api';

interface Props {
  token: string;
  toast?: { success: (msg: string) => void; error: (msg: string) => void };
}

export default function DomainResellerManager({ token, toast }: Props) {
  const [config, setConfig] = useState<DomainResellerConfig | null>(null);
  const [tlds, setTlds] = useState<DomainTldPricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingTldId, setEditingTldId] = useState<number | null>(null);
  const [addingTld, setAddingTld] = useState(false);
  const [newTld, setNewTld] = useState({ tld: '', register_price: 0, renew_price: 0, currency: 'BDT', is_active: true, sort_order: 0 });
  const [editTldForm, setEditTldForm] = useState<Partial<DomainTldPricingRow>>({});

  const load = async () => {
    try {
      setLoading(true);
      const [cfg, { tlds: list }] = await Promise.all([
        getDomainResellerConfig(token),
        fetchDomainTldPricing(token),
      ]);
      setConfig(cfg);
      setTlds(list);
    } catch {
      toast?.error('Failed to load domain settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      await updateDomainResellerConfig(token, config);
      toast?.success('Domain reseller config saved.');
    } catch {
      toast?.error('Failed to save config.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddTld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTld.tld.trim()) return;
    try {
      await createDomainTld(token, {
        tld: newTld.tld.trim().toLowerCase().replace(/^\./, ''),
        register_price: Number(newTld.register_price) || 0,
        renew_price: Number(newTld.renew_price) || 0,
        currency: newTld.currency || 'BDT',
        is_active: newTld.is_active,
        sort_order: Number(newTld.sort_order) || 0,
      });
      toast?.success('TLD added.');
      setAddingTld(false);
      setNewTld({ tld: '', register_price: 0, renew_price: 0, currency: 'BDT', is_active: true, sort_order: 0 });
      load();
    } catch (err: any) {
      toast?.error(err?.response?.data?.error || 'Failed to add TLD');
    }
  };

  const handleUpdateTld = async (id: number) => {
    try {
      await updateDomainTld(token, id, editTldForm);
      toast?.success('TLD updated.');
      setEditingTldId(null);
      setEditTldForm({});
      load();
    } catch (err: any) {
      toast?.error(err?.response?.data?.error || 'Failed to update TLD');
    }
  };

  const handleDeleteTld = async (id: number) => {
    if (!window.confirm('Remove this TLD from pricing?')) return;
    try {
      await deleteDomainTld(token, id);
      toast?.success('TLD removed.');
      load();
    } catch {
      toast?.error('Failed to delete TLD');
    }
  };

  if (loading) {
    return (
      <div className="card-panel" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#64748b' }}>Loading…</p>
      </div>
    );
  }

  const cfg = config ?? {
    id: 1,
    is_enabled: false,
    provider: null,
    api_url: null,
    api_key: null,
    api_secret: null,
    reseller_customer_id: null,
    default_currency: 'BDT',
    updated_at: null,
  };

  return (
    <div className="domain-reseller-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={24} />
          Domain sales & reseller
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Configure domain reseller API (optional) and set TLD pricing. Customers can purchase a new domain with SMM packages or buy a domain only. Order total = package price + domain price when a domain is added.
        </p>
      </div>

      <div className="card-panel" style={{ maxWidth: '36rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Reseller configuration</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={cfg.is_enabled}
            onChange={(e) => setConfig((c) => (c ? { ...c, is_enabled: e.target.checked } : c))}
          />
          Enable domain reseller API (for future registration)
        </label>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Provider</label>
          <select
            value={['dynadot', 'namecheap', 'resellerclub', 'enom'].includes(cfg.provider || '') ? (cfg.provider || '') : 'other'}
            onChange={(e) => {
              const v = e.target.value;
              const known = ['dynadot', 'namecheap', 'resellerclub', 'enom'];
              setConfig((c) => (c ? { ...c, provider: v === 'other' ? (known.includes(c.provider || '') ? '' : (c.provider || '')) : v } : c));
            }}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', maxWidth: '16rem' }}
          >
            <option value="dynadot">Dynadot (dynadot.com)</option>
            <option value="namecheap">Namecheap</option>
            <option value="resellerclub">ResellerClub</option>
            <option value="enom">eNom</option>
            <option value="other">Other (custom)</option>
          </select>
          {(cfg.provider === 'other' || (cfg.provider && !['dynadot', 'namecheap', 'resellerclub', 'enom'].includes(cfg.provider))) && (
            <>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Custom provider name</label>
              <input
                type="text"
                value={cfg.provider ?? ''}
                onChange={(e) => setConfig((c) => (c ? { ...c, provider: e.target.value || null } : c))}
                placeholder="e.g. myregistrar"
                style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', maxWidth: '16rem' }}
              />
            </>
          )}
          {cfg.provider === 'dynadot' && (
            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '-0.25rem 0 0', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
              <strong>Dynadot:</strong> Sign in at dynadot.com → <strong>Tools → API</strong>. Unlock the API and copy your <strong>Production</strong> key (or Sandbox for testing). API docs: <a href="https://www.dynadot.com/domain/api.html" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>dynadot.com/domain/api</a>
            </p>
          )}
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>API URL</label>
          <input
            type="text"
            value={cfg.api_url ?? ''}
            onChange={(e) => setConfig((c) => (c ? { ...c, api_url: e.target.value || null } : c))}
            placeholder={cfg.provider === 'dynadot' ? 'e.g. https://api.dynadot.com (see Dynadot API docs)' : 'Reseller API endpoint'}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
          />
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>API Key</label>
          <input
            type="password"
            autoComplete="off"
            value={cfg.api_key ?? ''}
            onChange={(e) => setConfig((c) => (c ? { ...c, api_key: e.target.value || null } : c))}
            placeholder={cfg.provider === 'dynadot' ? 'Dynadot Production or Sandbox API key' : 'API key'}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
          />
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>API Secret</label>
          <input
            type="password"
            autoComplete="off"
            value={cfg.api_secret ?? ''}
            onChange={(e) => setConfig((c) => (c ? { ...c, api_secret: e.target.value || null } : c))}
            placeholder={cfg.provider === 'dynadot' ? 'Optional – required for Dynadot REST API' : 'API secret'}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
          />
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Reseller customer ID</label>
          <input
            type="text"
            value={cfg.reseller_customer_id ?? ''}
            onChange={(e) => setConfig((c) => (c ? { ...c, reseller_customer_id: e.target.value || null } : c))}
            placeholder="Optional"
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
          />
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Default currency</label>
          <input
            type="text"
            value={cfg.default_currency ?? 'BDT'}
            onChange={(e) => setConfig((c) => (c ? { ...c, default_currency: e.target.value || 'BDT' } : c))}
            placeholder="BDT"
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', maxWidth: '6rem' }}
          />
        </div>
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={savingConfig}
          className="btn-primary"
          style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {savingConfig ? 'Saving…' : <><Save size={18} /> Save config</>}
        </button>
      </div>

      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>TLD pricing (sell prices)</h2>
          {!addingTld ? (
            <button type="button" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setAddingTld(true)}>
              <Plus size={18} /> Add TLD
            </button>
          ) : (
            <form onSubmit={handleAddTld} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
              <input type="text" placeholder="com" value={newTld.tld} onChange={(e) => setNewTld((t) => ({ ...t, tld: e.target.value }))} style={{ width: '5rem', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }} />
              <input type="number" step="0.01" min="0" placeholder="Register" value={newTld.register_price || ''} onChange={(e) => setNewTld((t) => ({ ...t, register_price: Number(e.target.value) || 0 }))} style={{ width: '6rem', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }} />
              <input type="number" step="0.01" min="0" placeholder="Renew" value={newTld.renew_price || ''} onChange={(e) => setNewTld((t) => ({ ...t, renew_price: Number(e.target.value) || 0 }))} style={{ width: '6rem', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }} />
              <input type="text" placeholder="BDT" value={newTld.currency} onChange={(e) => setNewTld((t) => ({ ...t, currency: e.target.value }))} style={{ width: '4rem', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }} />
              <button type="submit" className="btn-primary">Add</button>
              <button type="button" onClick={() => { setAddingTld(false); setNewTld({ tld: '', register_price: 0, renew_price: 0, currency: 'BDT', is_active: true, sort_order: 0 }); }}>Cancel</button>
            </form>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>TLD</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Register</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Renew</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Currency</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Active</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Order</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tlds.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {editingTldId === row.id ? (
                    <>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          value={editTldForm.tld ?? row.tld}
                          onChange={(e) => setEditTldForm((f) => ({ ...f, tld: e.target.value }))}
                          style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={editTldForm.register_price ?? row.register_price}
                          onChange={(e) => setEditTldForm((f) => ({ ...f, register_price: Number(e.target.value) }))}
                          style={{ width: '5rem', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={editTldForm.renew_price ?? row.renew_price}
                          onChange={(e) => setEditTldForm((f) => ({ ...f, renew_price: Number(e.target.value) }))}
                          style={{ width: '5rem', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          value={editTldForm.currency ?? row.currency}
                          onChange={(e) => setEditTldForm((f) => ({ ...f, currency: e.target.value }))}
                          style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input type="checkbox" checked={editTldForm.is_active ?? row.is_active} onChange={(e) => setEditTldForm((f) => ({ ...f, is_active: e.target.checked }))} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input type="number" value={editTldForm.sort_order ?? row.sort_order} onChange={(e) => setEditTldForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} style={{ width: '3rem', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button type="button" className="btn-primary" style={{ marginRight: '0.25rem' }} onClick={() => handleUpdateTld(row.id)}>Save</button>
                        <button type="button" onClick={() => { setEditingTldId(null); setEditTldForm({}); }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>.{row.tld}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{row.currency} {Number(row.register_price).toFixed(2)}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{row.currency} {Number(row.renew_price).toFixed(2)}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{row.currency}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{row.is_active ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{row.sort_order}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button type="button" onClick={() => { setEditingTldId(row.id); setEditTldForm({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} title="Edit"><Pencil size={16} /></button>
                        <button type="button" onClick={() => handleDeleteTld(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#dc2626' }} title="Delete"><Trash2 size={16} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tlds.length === 0 && !addingTld && (
          <p style={{ color: '#64748b', padding: '1rem 0' }}>No TLDs configured. Add TLDs so customers can purchase domains (e.g. .com, .net).</p>
        )}
      </div>
    </div>
  );
}
