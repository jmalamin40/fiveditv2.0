import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Package } from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface Props {
  token: string;
  toast: ReturnType<typeof useToast>;
}

interface SmmProduct {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: string | null;
  package_tier: string | null;
  features: string[] | null;
  sort_order: number;
  is_active: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fivedit.com/api';

export default function SmmPackageEditPage({ token, toast }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<SmmProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    price: '',
    currency: 'BDT',
    billing_interval: 'monthly',
    package_tier: 'starter',
    featuresText: '',
    sort_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/smm/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Package not found');
          navigate('/admin/smm-packages');
          return;
        }
        const err = await response.json().catch(() => ({ error: response.statusText }));
        toast.error(`Failed to load: ${err.error}`);
        return;
      }
      const data = await response.json();
      const p = data.product;
      const prod: SmmProduct = {
        ...p,
        price: typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price),
        sort_order: typeof p.sort_order === 'string' ? parseInt(p.sort_order, 10) : (p.sort_order ?? 0),
        is_active: p.is_active === 1 || p.is_active === true,
        features: typeof p.features === 'string' ? (p.features ? JSON.parse(p.features) : null) : p.features,
      };
      setProduct(prod);
      setFormData({
        display_name: prod.display_name,
        description: prod.description || '',
        price: String(prod.price),
        currency: prod.currency || 'BDT',
        billing_interval: prod.billing_interval || 'monthly',
        package_tier: prod.package_tier || 'starter',
        featuresText: Array.isArray(prod.features) ? prod.features.join('\n') : '',
        sort_order: String(prod.sort_order ?? 0),
        is_active: prod.is_active,
      });
    } catch (error) {
      toast.error(`Failed to load package: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !product) return;
    setSaving(true);
    try {
      const features = formData.featuresText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const response = await fetch(`${API_BASE_URL}/admin/smm/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: formData.display_name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          currency: formData.currency,
          billing_interval: formData.billing_interval,
          package_tier: formData.package_tier,
          features,
          sort_order: parseInt(formData.sort_order, 10),
          is_active: formData.is_active,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Package updated successfully.');
        navigate('/admin/smm-packages');
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update package');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <RefreshCw size={32} style={{ color: '#94a3b8', margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Loading package…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="card-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ margin: '0 0 1rem', color: '#475569' }}>Package not found.</p>
        <Link to="/admin/smm-packages" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} />
          Back to SMM Packages
        </Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/admin/smm-packages"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            color: '#2563eb',
            fontWeight: 500,
            textDecoration: 'none',
            marginBottom: '1rem',
          }}
        >
          <ArrowLeft size={18} />
          Back to SMM Packages
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Edit package</h2>
            <span className="smm-page-slug">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="card-panel smm-edit-page-card">
        <form onSubmit={handleSubmit} className="smm-form">
          <section className="smm-form-section">
            <h4 className="smm-form-section-title">Basic info</h4>
            <div className="smm-form-group">
              <label className="smm-form-label">Display name <span className="smm-required">*</span></label>
              <input
                type="text"
                className="smm-form-input"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g. Starter (Monthly)"
                required
              />
            </div>
            <div className="smm-form-group">
              <label className="smm-form-label">Description</label>
              <textarea
                className="smm-form-input smm-form-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Short description shown on the pricing page…"
              />
            </div>
          </section>

          <section className="smm-form-section">
            <h4 className="smm-form-section-title">Pricing &amp; billing</h4>
            <div className="smm-form-row">
              <div className="smm-form-group">
                <label className="smm-form-label">Price <span className="smm-required">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="smm-form-input"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="smm-form-group">
                <label className="smm-form-label">Currency</label>
                <select className="smm-form-input smm-form-select" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}>
                  <option value="BDT">BDT</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="smm-form-row">
              <div className="smm-form-group">
                <label className="smm-form-label">Billing</label>
                <select className="smm-form-input smm-form-select" value={formData.billing_interval} onChange={(e) => setFormData({ ...formData, billing_interval: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="smm-form-group">
                <label className="smm-form-label">Tier</label>
                <select className="smm-form-input smm-form-select" value={formData.package_tier} onChange={(e) => setFormData({ ...formData, package_tier: e.target.value })}>
                  <option value="starter">Starter</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>
            <div className="smm-form-row smm-form-row-inline">
              <div className="smm-form-group smm-form-group-sm">
                <label className="smm-form-label">Sort order</label>
                <input
                  type="number"
                  min="0"
                  className="smm-form-input"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                />
              </div>
              <div className="smm-form-group smm-form-checkbox-wrap">
                <label className="smm-form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="smm-form-checkbox"
                  />
                  <span>Active (visible on store)</span>
                </label>
              </div>
            </div>
          </section>

          <section className="smm-form-section">
            <h4 className="smm-form-section-title">Features</h4>
            <p className="smm-form-hint">One feature per line. Shown as a bullet list on the public pricing page.</p>
            <div className="smm-form-group">
              <textarea
                className="smm-form-input smm-form-textarea smm-form-features"
                value={formData.featuresText}
                onChange={(e) => setFormData({ ...formData, featuresText: e.target.value })}
                rows={12}
                placeholder="Backend Node.js&#10;Frontend React.js&#10;Complete Ecommerce&#10;AI supported&#10;..."
              />
            </div>
          </section>

          <div className="smm-form-footer">
            <Link to="/admin/smm-packages" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .smm-page-slug {
          display: inline-block;
          font-size: 0.8rem;
          color: #64748b;
          font-family: ui-monospace, monospace;
          background: #f1f5f9;
          padding: 0.2rem 0.5rem;
          border-radius: 0.375rem;
          margin-top: 0.25rem;
        }
        .smm-edit-page-card {
          padding: 1.75rem 2rem;
          max-width: 640px;
        }
        .smm-form-section { margin-bottom: 1.5rem; }
        .smm-form-section:last-of-type { margin-bottom: 0; }
        .smm-form-section-title {
          margin: 0 0 0.75rem 0;
          font-size: 0.8rem;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .smm-form-group { margin-bottom: 1rem; }
        .smm-form-group:last-child { margin-bottom: 0; }
        .smm-form-label {
          display: block;
          margin-bottom: 0.35rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
        }
        .smm-required { color: #dc2626; }
        .smm-form-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.9rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          background: #fff;
          color: #0f172a;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .smm-form-input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .smm-form-input::placeholder { color: #9ca3af; }
        .smm-form-textarea { resize: vertical; min-height: 80px; }
        .smm-form-features {
          font-family: ui-monospace, monospace;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .smm-form-select { cursor: pointer; appearance: auto; }
        .smm-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .smm-form-row:last-child { margin-bottom: 0; }
        .smm-form-row-inline { align-items: flex-end; margin-top: 0.5rem; }
        .smm-form-group-sm { max-width: 100px; }
        .smm-form-checkbox-wrap { margin-bottom: 0; }
        .smm-form-checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
        }
        .smm-form-checkbox {
          width: 1rem;
          height: 1rem;
          margin: 0;
          accent-color: #2563eb;
        }
        .smm-form-hint {
          margin: 0 0 0.5rem 0;
          font-size: 0.8rem;
          color: #64748b;
          line-height: 1.4;
        }
        .smm-form-footer {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid #e2e8f0;
        }
      `}</style>
    </>
  );
}
