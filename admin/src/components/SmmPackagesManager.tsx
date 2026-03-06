import { useState, useEffect, FormEvent } from 'react';
import { Edit, CheckCircle, XCircle } from 'lucide-react';
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
  created_at?: string;
  updated_at?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3004/api';

export default function SmmPackagesManager({ token, toast }: Props) {
  const [products, setProducts] = useState<SmmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SmmProduct | null>(null);
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
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/smm/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        toast.error(`Failed to load SMM packages: ${err.error}`);
        return;
      }
      const data = await response.json();
      const list = (data.products || []).map((p: any) => ({
        ...p,
        price: typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price),
        sort_order: typeof p.sort_order === 'string' ? parseInt(p.sort_order, 10) : (p.sort_order ?? 0),
        is_active: p.is_active === 1 || p.is_active === true,
        features: typeof p.features === 'string' ? (p.features ? JSON.parse(p.features) : null) : p.features,
      }));
      setProducts(list);
    } catch (error) {
      toast.error(`Failed to load SMM packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const features = formData.featuresText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        display_name: formData.display_name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        currency: formData.currency,
        billing_interval: formData.billing_interval,
        package_tier: formData.package_tier,
        features,
        sort_order: parseInt(formData.sort_order, 10),
        is_active: formData.is_active,
      };
      const response = await fetch(`${API_BASE_URL}/admin/smm/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('SMM package updated successfully!');
        setShowModal(false);
        resetForm();
        loadProducts();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update SMM package');
    }
  };

  const handleEdit = (p: SmmProduct) => {
    setEditingProduct(p);
    setFormData({
      display_name: p.display_name,
      description: p.description || '',
      price: String(p.price),
      currency: p.currency || 'BDT',
      billing_interval: p.billing_interval || 'monthly',
      package_tier: p.package_tier || 'starter',
      featuresText: Array.isArray(p.features) ? p.features.join('\n') : '',
      sort_order: String(p.sort_order ?? 0),
      is_active: p.is_active,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
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
  };

  if (loading) {
    return <div>Loading SMM packages...</div>;
  }

  return (
    <>
      <div className="section-header">
        <div>
          <h2>SMM Packages</h2>
          <p>Manage ecommerce SaaS packages (Starter, Standard, Premium – monthly &amp; yearly)</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No SMM packages found. Run database migration to seed packages.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th>Billing</th>
                <th>Price</th>
                <th>Sort</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <strong>{p.display_name}</strong>
                      {!p.is_active && <span className="text-sm text-gray-500">(Inactive)</span>}
                    </div>
                    <div className="text-sm text-gray-500">{p.name}</div>
                  </td>
                  <td>{p.package_tier || '–'}</td>
                  <td>{p.billing_interval || '–'}</td>
                  <td>{p.currency} {typeof p.price === 'number' ? p.price.toFixed(2) : Number(p.price).toFixed(2)}</td>
                  <td>{p.sort_order}</td>
                  <td>
                    {p.is_active ? (
                      <span className="status-badge status-green">
                        <CheckCircle size={14} />
                        Active
                      </span>
                    ) : (
                      <span className="status-badge status-gray">
                        <XCircle size={14} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-sm btn-secondary"
                      onClick={() => handleEdit(p)}
                      title="Edit"
                    >
                      <Edit size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && editingProduct && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Edit SMM Package: {editingProduct.name}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="BDT">BDT</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Billing Interval</label>
                  <select
                    value={formData.billing_interval}
                    onChange={(e) => setFormData({ ...formData, billing_interval: e.target.value })}
                  >
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Package Tier</label>
                  <select
                    value={formData.package_tier}
                    onChange={(e) => setFormData({ ...formData, package_tier: e.target.value })}
                  >
                    <option value="starter">starter</option>
                    <option value="standard">standard</option>
                    <option value="premium">premium</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Features (one per line)</label>
                <textarea
                  value={formData.featuresText}
                  onChange={(e) => setFormData({ ...formData, featuresText: e.target.value })}
                  rows={8}
                  placeholder="Backend Node.js&#10;Frontend React.js&#10;Complete Ecommerce&#10;..."
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
