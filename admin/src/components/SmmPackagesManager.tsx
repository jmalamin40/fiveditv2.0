import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, CheckCircle, XCircle, Package, RefreshCw } from 'lucide-react';
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

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span style={{ color: '#6b7280' }}>–</span>;
  const t = tier.toLowerCase();
  const styles: Record<string, { bg: string; color: string }> = {
    starter: { bg: '#f1f5f9', color: '#475569' },
    standard: { bg: '#dbeafe', color: '#1d4ed8' },
    premium: { bg: '#fef3c7', color: '#b45309' },
  };
  const s = styles[t] || { bg: '#f3f4f6', color: '#4b5563' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'capitalize',
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {tier}
    </span>
  );
}

function BillingBadge({ interval }: { interval: string | null }) {
  if (!interval) return <span style={{ color: '#6b7280' }}>–</span>;
  const isYearly = interval.toLowerCase() === 'yearly';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.5rem',
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'capitalize',
        backgroundColor: isYearly ? '#ecfdf5' : '#f3f4f6',
        color: isYearly ? '#059669' : '#4b5563',
      }}
    >
      {interval}
    </span>
  );
}

export default function SmmPackagesManager({ token, toast }: Props) {
  const [products, setProducts] = useState<SmmProduct[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="card-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <RefreshCw size={32} style={{ color: '#94a3b8', margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Loading SMM packages…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <div className="section-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} color="white" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>SMM Packages</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', maxWidth: '480px' }}>
            Manage ecommerce SaaS packages (Starter, Standard, Premium — monthly &amp; yearly). Edit pricing and features below.
          </p>
        </div>
        {products.length > 0 && (
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
            {products.length} package{products.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className="card-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <Package size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
          <p style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#475569' }}>No SMM packages found</p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>Run the database migration to seed the default packages.</p>
        </div>
      ) : (
        <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="smm-data-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Tier</th>
                  <th>Billing</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'center' }}>Order</th>
                  <th>Status</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => (
                  <tr key={p.id} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'white' }}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.15rem' }}>{p.display_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{p.name}</div>
                    </td>
                    <td><TierBadge tier={p.package_tier} /></td>
                    <td><BillingBadge interval={p.billing_interval} /></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#0f172a' }}>
                      {p.currency} {typeof p.price === 'number' ? p.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : Number(p.price).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>{p.sort_order}</td>
                    <td>
                      {p.is_active ? (
                        <span className="status-badge status-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <CheckCircle size={14} />
                          Active
                        </span>
                      ) : (
                        <span className="status-badge status-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <XCircle size={14} />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/admin/smm-packages/edit/${p.id}`}
                        className="btn-sm btn-secondary smm-edit-btn"
                        title="Edit package"
                      >
                        <Edit size={14} />
                        <span>Edit</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .smm-data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .smm-data-table th {
          text-align: left;
          padding: 0.875rem 1rem;
          background: #f1f5f9;
          font-weight: 600;
          color: #475569;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .smm-data-table td {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .smm-data-table tbody tr:hover {
          background-color: #f1f5f9 !important;
        }
        .smm-edit-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          font-weight: 500;
          text-decoration: none;
        }
        .smm-edit-btn:hover {
          background: #1d4ed8 !important;
          color: white !important;
        }
      `}</style>
    </>
  );
}
