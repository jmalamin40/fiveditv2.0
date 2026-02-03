import { useState, useEffect, FormEvent } from 'react';
import { Package, Plus, Edit, Trash2, CheckCircle, XCircle, Star } from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface Props {
  token: string;
  toast: ReturnType<typeof useToast>;
}

interface HostingPackage {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  disk_space_gb: number;
  bandwidth_gb: number | null;
  domains: number | null;
  email_accounts: number | null;
  databases: number | null;
  ssl_included: boolean;
  backups: string | null;
  support_type: string | null;
  cpanel: boolean;
  wordpress: boolean;
  php_version: string | null;
  nodejs: boolean;
  python: boolean;
  popular: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

export default function HostingPackagesManager({ token, toast }: Props) {
  const [packages, setPackages] = useState<HostingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<HostingPackage | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    currency: 'BDT',
    disk_space_gb: '',
    bandwidth_gb: '',
    domains: '',
    email_accounts: '',
    databases: '',
    ssl_included: true,
    backups: '',
    support_type: '',
    cpanel: true,
    wordpress: false,
    php_version: '',
    nodejs: false,
    python: false,
    popular: false,
    is_active: true,
  });

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/hosting/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('API Error:', errorData);
        toast.error(`Failed to load packages: ${errorData.error || response.statusText}`);
        return;
      }
      
      const data = await response.json();
      console.log('Packages loaded:', data);
      
      // Normalize the data - convert MySQL boolean (0/1) to JavaScript boolean and strings to numbers
      const normalizedPackages = (data.packages || []).map((pkg: any) => ({
        ...pkg,
        price_monthly: typeof pkg.price_monthly === 'string' ? parseFloat(pkg.price_monthly) : Number(pkg.price_monthly),
        price_yearly: typeof pkg.price_yearly === 'string' ? parseFloat(pkg.price_yearly) : Number(pkg.price_yearly),
        ssl_included: pkg.ssl_included === 1 || pkg.ssl_included === true,
        cpanel: pkg.cpanel === 1 || pkg.cpanel === true,
        wordpress: pkg.wordpress === 1 || pkg.wordpress === true,
        nodejs: pkg.nodejs === 1 || pkg.nodejs === true,
        python: pkg.python === 1 || pkg.python === true,
        popular: pkg.popular === 1 || pkg.popular === true,
        is_active: pkg.is_active === 1 || pkg.is_active === true,
      }));
      
      console.log('Normalized packages:', normalizedPackages);
      setPackages(normalizedPackages);
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error(`Failed to load hosting packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price_monthly: parseFloat(formData.price_monthly),
        price_yearly: parseFloat(formData.price_yearly),
        disk_space_gb: parseInt(formData.disk_space_gb),
        bandwidth_gb: formData.bandwidth_gb ? parseInt(formData.bandwidth_gb) : null,
        domains: formData.domains ? parseInt(formData.domains) : null,
        email_accounts: formData.email_accounts ? parseInt(formData.email_accounts) : null,
        databases: formData.databases ? parseInt(formData.databases) : null,
        php_version: formData.php_version || null,
        backups: formData.backups || null,
        support_type: formData.support_type || null,
      };

      const url = editingPackage
        ? `${API_BASE_URL}/admin/hosting/packages/${editingPackage.id}`
        : `${API_BASE_URL}/admin/hosting/packages`;
      const method = editingPackage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(editingPackage ? 'Package updated successfully!' : 'Package created successfully!');
        setShowModal(false);
        resetForm();
        loadPackages();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to save package');
    }
  };

  const handleEdit = (pkg: HostingPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      display_name: pkg.display_name,
      description: pkg.description || '',
      price_monthly: pkg.price_monthly.toString(),
      price_yearly: pkg.price_yearly.toString(),
      currency: pkg.currency,
      disk_space_gb: pkg.disk_space_gb.toString(),
      bandwidth_gb: pkg.bandwidth_gb?.toString() || '',
      domains: pkg.domains?.toString() || '',
      email_accounts: pkg.email_accounts?.toString() || '',
      databases: pkg.databases?.toString() || '',
      ssl_included: pkg.ssl_included,
      backups: pkg.backups || '',
      support_type: pkg.support_type || '',
      cpanel: pkg.cpanel,
      wordpress: pkg.wordpress,
      php_version: pkg.php_version || '',
      nodejs: pkg.nodejs,
      python: pkg.python,
      popular: pkg.popular,
      is_active: pkg.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/packages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Package deleted successfully');
        loadPackages();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to delete package');
    }
  };

  const resetForm = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      display_name: '',
      description: '',
      price_monthly: '',
      price_yearly: '',
      currency: 'BDT',
      disk_space_gb: '',
      bandwidth_gb: '',
      domains: '',
      email_accounts: '',
      databases: '',
      ssl_included: true,
      backups: '',
      support_type: '',
      cpanel: true,
      wordpress: false,
      php_version: '',
      nodejs: false,
      python: false,
      popular: false,
      is_active: true,
    });
  };

  if (loading) {
    return <div>Loading hosting packages...</div>;
  }

  console.log('Rendering packages:', packages, 'Count:', packages.length);

  return (
    <>
      <div className="section-header">
        <div>
          <h2>Hosting Packages</h2>
          <p>Manage hosting plans and pricing</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={16} />
          Create Package
        </button>
      </div>

      {packages.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No packages found. Create your first hosting package.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Monthly Price</th>
                  <th>Yearly Price</th>
                  <th>Disk Space</th>
                  <th>Bandwidth</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <strong>{pkg.display_name}</strong>
                        {pkg.popular && <Star size={16} className="text-yellow-500" />}
                        {!pkg.is_active && <span className="text-sm text-gray-500">(Inactive)</span>}
                      </div>
                      <div className="text-sm text-gray-500">{pkg.name}</div>
                    </td>
                    <td>{pkg.currency} {typeof pkg.price_monthly === 'number' ? pkg.price_monthly.toFixed(2) : parseFloat(pkg.price_monthly || '0').toFixed(2)}</td>
                    <td>{pkg.currency} {typeof pkg.price_yearly === 'number' ? pkg.price_yearly.toFixed(2) : parseFloat(pkg.price_yearly || '0').toFixed(2)}</td>
                    <td>{pkg.disk_space_gb} GB</td>
                    <td>{pkg.bandwidth_gb ? `${pkg.bandwidth_gb} GB` : 'Unlimited'}</td>
                    <td>
                      {pkg.is_active ? (
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
                      <div className="flex gap-1">
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => handleEdit(pkg)}
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleDelete(pkg.id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editingPackage ? 'Edit Package' : 'Create Package'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Package Name (Slug) *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="starter"
                    required
                    disabled={!!editingPackage}
                  />
                </div>
                <div className="form-group">
                  <label>Display Name *</label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Starter Plan"
                    required
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Yearly Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_yearly}
                    onChange={(e) => setFormData({ ...formData, price_yearly: e.target.value })}
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
                  <label>Disk Space (GB) *</label>
                  <input
                    type="number"
                    value={formData.disk_space_gb}
                    onChange={(e) => setFormData({ ...formData, disk_space_gb: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Bandwidth (GB)</label>
                  <input
                    type="number"
                    value={formData.bandwidth_gb}
                    onChange={(e) => setFormData({ ...formData, bandwidth_gb: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="form-group">
                  <label>Domains</label>
                  <input
                    type="number"
                    value={formData.domains}
                    onChange={(e) => setFormData({ ...formData, domains: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="form-group">
                  <label>Email Accounts</label>
                  <input
                    type="number"
                    value={formData.email_accounts}
                    onChange={(e) => setFormData({ ...formData, email_accounts: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="form-group">
                  <label>Databases</label>
                  <input
                    type="number"
                    value={formData.databases}
                    onChange={(e) => setFormData({ ...formData, databases: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="form-group">
                  <label>Backups</label>
                  <input
                    type="text"
                    value={formData.backups}
                    onChange={(e) => setFormData({ ...formData, backups: e.target.value })}
                    placeholder="e.g., Weekly, Daily"
                  />
                </div>
                <div className="form-group">
                  <label>Support Type</label>
                  <input
                    type="text"
                    value={formData.support_type}
                    onChange={(e) => setFormData({ ...formData, support_type: e.target.value })}
                    placeholder="e.g., Email, 24/7 Priority"
                  />
                </div>
                <div className="form-group">
                  <label>PHP Version</label>
                  <input
                    type="text"
                    value={formData.php_version}
                    onChange={(e) => setFormData({ ...formData, php_version: e.target.value })}
                    placeholder="e.g., 8.1"
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.ssl_included}
                    onChange={(e) => setFormData({ ...formData, ssl_included: e.target.checked })}
                  />
                  SSL Included
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.cpanel}
                    onChange={(e) => setFormData({ ...formData, cpanel: e.target.checked })}
                  />
                  cPanel
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.wordpress}
                    onChange={(e) => setFormData({ ...formData, wordpress: e.target.checked })}
                  />
                  WordPress
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.nodejs}
                    onChange={(e) => setFormData({ ...formData, nodejs: e.target.checked })}
                  />
                  Node.js
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.python}
                    onChange={(e) => setFormData({ ...formData, python: e.target.checked })}
                  />
                  Python
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                  />
                  Popular
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

