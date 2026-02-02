import { useState, useEffect, FormEvent } from 'react';
import { Server, RefreshCw, Plus, Search, Filter, MoreVertical, Play, Pause, Trash2, Edit, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface Props {
  token: string;
  toast: ReturnType<typeof useToast>;
}

interface HostingConfig {
  id: number;
  whm_host: string;
  whm_username: string;
  whm_port: number;
  whm_ssl: boolean;
  reseller_username: string | null;
  is_active: boolean;
}

interface HostingAccount {
  id: number;
  domain: string;
  username: string;
  package_name: string;
  status: 'active' | 'suspended' | 'terminated' | 'pending';
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  disk_used: number;
  disk_limit: number;
  bandwidth_used: number;
  bandwidth_limit: number;
  ip_address: string | null;
  cpanel_url: string | null;
  created_at: string;
  expires_at: string | null;
  suspended_at: string | null;
  notes: string | null;
}

interface Stats {
  total: number;
  active: number;
  suspended: number;
  terminated_count: number;
  pending: number;
  total_disk_used: number;
  total_disk_limit: number;
  total_bandwidth_used: number;
  total_bandwidth_limit: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

export default function HostingManager({ token, toast }: Props) {
  const [config, setConfig] = useState<HostingConfig | null>(null);
  const [accounts, setAccounts] = useState<HostingAccount[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  
  const [configForm, setConfigForm] = useState({
    whm_host: '',
    whm_username: '',
    whm_password: '',
    whm_port: 2087,
    whm_ssl: true,
    reseller_username: '',
  });
  
  const [createForm, setCreateForm] = useState({
    domain: '',
    username: '',
    password: '',
    package_name: '',
    email: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, searchQuery, currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, accountsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/hosting/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/hosting/accounts?status=${statusFilter}&search=${searchQuery}&page=${currentPage}&limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/hosting/accounts/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      
      const configData = await configRes.json();
      const accountsData = await accountsRes.json();
      const statsData = await statsRes.json();
      
      setConfig(configData.config);
      setAccounts(accountsData.accounts || []);
      setPagination(accountsData.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      setStats(statsData.stats || null);
      
      if (configData.config) {
        setConfigForm({
          whm_host: configData.config.whm_host,
          whm_username: configData.config.whm_username,
          whm_password: '',
          whm_port: configData.config.whm_port,
          whm_ssl: configData.config.whm_ssl,
          reseller_username: configData.config.reseller_username || '',
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(configForm),
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success('Configuration saved successfully!');
        setShowConfigModal(false);
        loadData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const handleTestConnection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/config/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(`Connection successful! Found ${data.accountCount} accounts.`);
      } else {
        toast.error(`Connection failed: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to test connection');
    }
  };

  const handleSyncAccounts = async () => {
    try {
      setSyncing(true);
      const response = await fetch(`${API_BASE_URL}/admin/hosting/accounts/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(`Sync completed! Created: ${data.created}, Updated: ${data.updated}`);
        loadData();
      } else {
        toast.error(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to sync accounts');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          email: createForm.email || createForm.customer_email,
        }),
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success('Account created successfully!');
        setShowCreateModal(false);
        setCreateForm({
          domain: '',
          username: '',
          password: '',
          package_name: '',
          email: '',
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          notes: '',
        });
        loadData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  const handleSuspend = async (id: number) => {
    if (!confirm('Are you sure you want to suspend this account?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/accounts/${id}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Account suspended successfully');
        loadData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to suspend account');
    }
  };

  const handleUnsuspend = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/accounts/${id}/unsuspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Account unsuspended successfully');
        loadData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to unsuspend account');
    }
  };

  const handleTerminate = async (id: number) => {
    if (!confirm('Are you sure you want to TERMINATE this account? This action cannot be undone!')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/hosting/accounts/${id}/terminate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Account terminated successfully');
        loadData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error('Failed to terminate account');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { icon: CheckCircle, color: 'green', text: 'Active' },
      suspended: { icon: Pause, color: 'orange', text: 'Suspended' },
      terminated: { icon: XCircle, color: 'red', text: 'Terminated' },
      pending: { icon: AlertCircle, color: 'gray', text: 'Pending' },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`status-badge status-${badge.color}`}>
        <Icon size={14} />
        {badge.text}
      </span>
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="card-panel">Loading hosting data...</div>;
  }

  return (
    <div>
      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>Hosting Management</h2>
            <p>Manage your AsuraHosting reseller accounts</p>
          </div>
          <div className="flex gap-2">
            {!config && (
              <button className="btn-primary" onClick={() => setShowConfigModal(true)}>
                <Settings size={16} />
                Configure DirectAdmin
              </button>
            )}
            {config && (
              <>
                <button className="btn-secondary" onClick={() => setShowConfigModal(true)}>
                  <Settings size={16} />
                  Settings
                </button>
                <button className="btn-secondary" onClick={handleTestConnection}>
                  Test Connection
                </button>
                <button className="btn-primary" onClick={handleSyncAccounts} disabled={syncing}>
                  <RefreshCw size={16} className={syncing ? 'spinning' : ''} />
                  {syncing ? 'Syncing...' : 'Sync from DirectAdmin'}
                </button>
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={16} />
                  Create Account
                </button>
              </>
            )}
          </div>
        </div>

        {!config && (
          <div className="alert alert-warning">
            <AlertCircle size={20} />
            <div>
              <strong>DirectAdmin Configuration Required</strong>
              <p>Please configure your DirectAdmin credentials to start managing hosting accounts.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowConfigModal(true)}>
              Configure Now
            </button>
          </div>
        )}

        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Accounts</div>
            </div>
            <div className="stat-card stat-success">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card stat-warning">
              <div className="stat-value">{stats.suspended}</div>
              <div className="stat-label">Suspended</div>
            </div>
            <div className="stat-card stat-danger">
              <div className="stat-value">{stats.terminated_count || 0}</div>
              <div className="stat-label">Terminated</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatBytes((stats.total_disk_used || 0) * 1024 * 1024)}</div>
              <div className="stat-label">Disk Used</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatBytes((stats.total_bandwidth_used || 0) * 1024 * 1024)}</div>
              <div className="stat-label">Bandwidth Used</div>
            </div>
          </div>
        )}
      </div>

      {config && (
        <>
          <div className="card-panel">
            <div className="flex items-center justify-between mb-4">
              <h3>Hosting Accounts</h3>
              <div className="flex gap-2">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search domains, usernames..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {accounts.length === 0 ? (
              <p>No accounts found.</p>
            ) : (
              <>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Domain</th>
                        <th>Username</th>
                        <th>Package</th>
                        <th>Status</th>
                        <th>Customer</th>
                        <th>Disk Usage</th>
                        <th>Bandwidth</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account) => (
                        <tr key={account.id}>
                          <td>
                            <strong>{account.domain}</strong>
                            {account.cpanel_url && (
                              <a href={account.cpanel_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 ml-2">
                                cPanel
                              </a>
                            )}
                          </td>
                          <td>{account.username}</td>
                          <td>{account.package_name}</td>
                          <td>{getStatusBadge(account.status)}</td>
                          <td>
                            {account.customer_name && (
                              <div>
                                <div>{account.customer_name}</div>
                                {account.customer_email && (
                                  <div className="text-sm text-gray-500">{account.customer_email}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {formatBytes(account.disk_used * 1024 * 1024)} / {formatBytes(account.disk_limit * 1024 * 1024)}
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${(account.disk_used / account.disk_limit) * 100}%`,
                                  backgroundColor: (account.disk_used / account.disk_limit) > 0.9 ? '#ef4444' : '#3b82f6',
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            {formatBytes(account.bandwidth_used * 1024 * 1024)} / {formatBytes(account.bandwidth_limit * 1024 * 1024)}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              {account.status === 'active' && (
                                <button
                                  className="btn-sm btn-warning"
                                  onClick={() => handleSuspend(account.id)}
                                  title="Suspend"
                                >
                                  <Pause size={14} />
                                </button>
                              )}
                              {account.status === 'suspended' && (
                                <button
                                  className="btn-sm btn-success"
                                  onClick={() => handleUnsuspend(account.id)}
                                  title="Unsuspend"
                                >
                                  <Play size={14} />
                                </button>
                              )}
                              {account.status !== 'terminated' && (
                                <button
                                  className="btn-sm btn-danger"
                                  onClick={() => handleTerminate(account.id)}
                                  title="Terminate"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagination.totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="btn-sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <button
                      className="btn-sm"
                      onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>DirectAdmin Configuration</h3>
            <form onSubmit={handleSaveConfig}>
              <div className="form-group">
                <label>DirectAdmin Host</label>
                <input
                  type="text"
                  value={configForm.whm_host}
                  onChange={(e) => setConfigForm({ ...configForm, whm_host: e.target.value })}
                  placeholder="d5.my-control-panel.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>DirectAdmin Username</label>
                <input
                  type="text"
                  value={configForm.whm_username}
                  onChange={(e) => setConfigForm({ ...configForm, whm_username: e.target.value })}
                  placeholder="reseller_username"
                  required
                />
              </div>
              <div className="form-group">
                <label>DirectAdmin Password</label>
                <input
                  type="password"
                  value={configForm.whm_password}
                  onChange={(e) => setConfigForm({ ...configForm, whm_password: e.target.value })}
                  placeholder={config ? 'Leave blank to keep current' : 'Enter DirectAdmin password'}
                  required={!config}
                />
              </div>
              <div className="form-group">
                <label>DirectAdmin Port</label>
                <input
                  type="number"
                  value={configForm.whm_port}
                  onChange={(e) => setConfigForm({ ...configForm, whm_port: parseInt(e.target.value) })}
                  placeholder="2222"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={configForm.whm_ssl}
                    onChange={(e) => setConfigForm({ ...configForm, whm_ssl: e.target.checked })}
                  />
                  Use SSL
                </label>
              </div>
              <div className="form-group">
                <label>Reseller Username (Optional)</label>
                <input
                  type="text"
                  value={configForm.reseller_username}
                  onChange={(e) => setConfigForm({ ...configForm, reseller_username: e.target.value })}
                  placeholder="reseller_username"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowConfigModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create Hosting Account</h3>
            <form onSubmit={handleCreateAccount}>
              <div className="form-group">
                <label>Domain *</label>
                <input
                  type="text"
                  value={createForm.domain}
                  onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
                  placeholder="example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Package Name *</label>
                <input
                  type="text"
                  value={createForm.package_name}
                  onChange={(e) => setCreateForm({ ...createForm, package_name: e.target.value })}
                  placeholder="default, starter, business, professional, enterprise"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email * (for DirectAdmin account)</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  value={createForm.customer_name}
                  onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Customer Email</label>
                <input
                  type="email"
                  value={createForm.customer_email}
                  onChange={(e) => setCreateForm({ ...createForm, customer_email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Customer Phone</label>
                <input
                  type="text"
                  value={createForm.customer_phone}
                  onChange={(e) => setCreateForm({ ...createForm, customer_phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .stat-card {
          background: #f9fafb;
          padding: 1.5rem;
          border-radius: 0.5rem;
          text-align: center;
        }
        .stat-card.stat-success { background: #ecfdf5; }
        .stat-card.stat-warning { background: #fffbeb; }
        .stat-card.stat-danger { background: #fef2f2; }
        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          color: #111827;
        }
        .stat-label {
          color: #6b7280;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          padding: 0.5rem 1rem;
        }
        .search-box input {
          border: none;
          outline: none;
          flex: 1;
        }
        .table-container {
          overflow-x: auto;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th,
        .data-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .status-green { background: #d1fae5; color: #065f46; }
        .status-orange { background: #fed7aa; color: #9a3412; }
        .status-red { background: #fee2e2; color: #991b1b; }
        .status-gray { background: #f3f4f6; color: #4b5563; }
        .progress-bar {
          width: 100%;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          margin-top: 0.25rem;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          transition: width 0.3s;
        }
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 1rem;
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .alert {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        .alert-warning {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          color: #92400e;
        }
      `}</style>
    </div>
  );
}

