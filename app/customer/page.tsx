'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomerOrders, getCustomerAccounts, getCustomerProfile, getCustomerInvoices, getCustomerSmmOrders, getCustomerSmmInstances, getSmmProvisioningSteps, retrySmmProvisioning, CustomerOrder, CustomerAccount, Invoice, SmmOrder, SmmInstance, SmmProvisioningStep } from '@/lib/api';
import { Loader2, LogOut, Package, Server, User, Calendar, DollarSign, CheckCircle, XCircle, Clock, FileText, Share2, ExternalLink, RefreshCw } from 'lucide-react';

export default function CustomerDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [smmOrders, setSmmOrders] = useState<SmmOrder[]>([]);
  const [smmInstances, setSmmInstances] = useState<SmmInstance[]>([]);
  const [provisioningSteps, setProvisioningSteps] = useState<Record<string, SmmProvisioningStep[]>>({});
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'accounts' | 'smm' | 'invoices' | 'profile'>('orders');

  useEffect(() => {
    const storedToken = localStorage.getItem('customer_token');
    const storedUser = localStorage.getItem('customer_user');
    
    if (!storedToken || !storedUser) {
      router.push('/customer/login');
      return;
    }

    setToken(storedToken);
    setUser(JSON.parse(storedUser));
    loadData(storedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadData = async (authToken: string) => {
    try {
      setLoading(true);
      const [ordersData, accountsData, invoicesData, smmOrdersData, smmInstancesData, profileData] = await Promise.all([
        getCustomerOrders(authToken),
        getCustomerAccounts(authToken),
        getCustomerInvoices(authToken).catch(() => ({ invoices: [] })),
        getCustomerSmmOrders(authToken).catch(() => ({ orders: [] })),
        getCustomerSmmInstances(authToken).catch(() => ({ instances: [] })),
        getCustomerProfile(authToken),
      ]);
      setOrders(ordersData.orders);
      setAccounts(accountsData.accounts);
      setInvoices(invoicesData.invoices);
      setSmmOrders(smmOrdersData.orders);
      setSmmInstances(smmInstancesData.instances);
      setUser(profileData.user);
      for (const o of smmOrdersData.orders) {
        if ((o.status === 'paid' || o.status === 'completed') && !o.smm_instance_id) {
          getSmmProvisioningSteps(o.order_id).then((r) => setProvisioningSteps((prev) => ({ ...prev, [o.order_id]: r.steps }))).catch(() => {});
        }
      }
      localStorage.setItem('customer_user', JSON.stringify(profileData.user));
    } catch (error) {
      console.error('Error loading data:', error);
      // If token is invalid, redirect to login
      localStorage.removeItem('customer_token');
      localStorage.removeItem('customer_user');
      router.push('/customer/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/customer/login');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
      suspended: { color: 'bg-red-100 text-red-800', icon: XCircle },
    };

    const statusInfo = statusMap[status.toLowerCase()] || { color: 'bg-gray-100 text-gray-800', icon: Clock };
    const Icon = statusInfo.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Orders
              </button>
              <button
                onClick={() => setActiveTab('accounts')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'accounts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Server className="w-4 h-4 inline mr-2" />
                Hosting Accounts
              </button>
              <button
                onClick={() => setActiveTab('smm')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'smm'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Share2 className="w-4 h-4 inline mr-2" />
                SMM Websites
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'invoices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Invoices
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Profile
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'orders' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Orders</h2>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No orders found</p>
                  <button
                    onClick={() => router.push('/hosting')}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Browse Hosting Plans
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.order_id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{order.package_display_name || order.package_name}</h3>
                          <p className="text-sm text-gray-600">Order ID: {order.order_id}</p>
                        </div>
                        {getStatusBadge(order.display_status || order.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Amount</p>
                          <p className="font-semibold">{order.currency} {Number(order.amount || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Billing Period</p>
                          <p className="font-semibold capitalize">{order.billing_period}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Order Date</p>
                          <p className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        {order.paid_at && (
                          <div>
                            <p className="text-gray-600">Paid Date</p>
                            <p className="font-semibold">{new Date(order.paid_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      {order.domain && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Domain:</span> {order.domain}
                          </p>
                          {order.username && (
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Username:</span> {order.username}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'accounts' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Hosting Accounts</h2>
              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hosting accounts found</p>
                  <button
                    onClick={() => router.push('/hosting')}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Purchase Hosting
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div key={account.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{account.domain}</h3>
                          <p className="text-sm text-gray-600">Package: {account.package_name}</p>
                        </div>
                        {getStatusBadge(account.display_status || account.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-600">Username</p>
                          <p className="font-semibold">{account.username}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Disk Usage</p>
                          <p className="font-semibold">
                            {formatBytes(account.disk_used * 1024 * 1024 * 1024)} / {formatBytes(account.disk_limit * 1024 * 1024 * 1024)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Bandwidth</p>
                          <p className="font-semibold">
                            {formatBytes(account.bandwidth_used * 1024 * 1024 * 1024)} / {formatBytes(account.bandwidth_limit * 1024 * 1024 * 1024)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Created</p>
                          <p className="font-semibold">{new Date(account.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {account.ip_address && (
                        <div className="pt-4 border-t">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">IP Address:</span> {account.ip_address}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'smm' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your SMM Websites</h2>
              <p className="text-sm text-gray-600 mb-4">Social Media Marketing Website orders and instances.</p>
              {smmInstances.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-lg font-semibold text-gray-800">Active websites</h3>
                  {smmInstances.map((inst) => (
                    <div key={inst.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{inst.domain}</h4>
                          <p className="text-sm text-gray-500">{inst.product_display_name || 'SMM Website'}</p>
                        </div>
                        {getStatusBadge(inst.status)}
                      </div>
                      <a
                        href={inst.site_url.startsWith('http') ? inst.site_url : 'https://' + inst.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm mt-2"
                      >
                        {inst.site_url}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <p className="text-xs text-gray-500 mt-2">Created {new Date(inst.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
              {smmOrders.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">SMM Orders</h3>
                  {smmOrders.map((order) => {
                    const stepsForOrder = provisioningSteps[order.order_id] || [];
                    const hasFailedStep = stepsForOrder.some((s) => s.status === 'failed');
                    const showProvisionSection =
                      (order.status === 'paid' || order.status === 'completed') &&
                      !order.smm_instance_id &&
                      (stepsForOrder.length > 0 || hasFailedStep);
                    const showRetryButton =
                      (order.status === 'paid' || order.status === 'completed') &&
                      !order.smm_instance_id &&
                      hasFailedStep;

                    return (
                    <div key={order.order_id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{order.product_display_name || 'SMM Website'}</h4>
                          <p className="text-sm text-gray-500">Order: {order.order_id}</p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                        <div>
                          <p className="text-gray-600">Amount</p>
                          <p className="font-semibold">{order.currency} {Number(order.amount || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date</p>
                          <p className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        {order.domain && (
                          <div>
                            <p className="text-gray-600">Domain</p>
                            <p className="font-semibold">{order.domain}</p>
                          </div>
                        )}
                        {order.subdomain_slug && (
                          <div>
                            <p className="text-gray-600">Subdomain</p>
                            <p className="font-semibold">{order.subdomain_slug}.fivedit.com</p>
                          </div>
                        )}
                      </div>
                      {showProvisionSection && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">Provisioning steps</p>
                          <ul className="space-y-1 text-sm mb-3">
                            {stepsForOrder.map((step) => (
                              <li key={step.step_name} className="flex items-center gap-2">
                                {step.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                                {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                                {(step.status === 'pending' || step.status === 'running') && <Loader2 className="w-4 h-4 animate-spin text-gray-500 shrink-0" />}
                                <span className={step.status === 'failed' ? 'text-red-700' : ''}>
                                  {step.step_name.replace(/_/g, ' ')}: {step.status}
                                  {step.error_message && <span className="block text-xs text-red-600 mt-0.5">{step.error_message}</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {showRetryButton && (
                            <button
                              onClick={async () => {
                                if (!token || retryingOrderId) return;
                                setRetryingOrderId(order.order_id);
                                try {
                                  await retrySmmProvisioning(order.order_id, token);
                                  const res = await getSmmProvisioningSteps(order.order_id);
                                  setProvisioningSteps((prev) => ({ ...prev, [order.order_id]: res.steps }));
                                  await loadData(token);
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setRetryingOrderId(null);
                                }
                              }}
                              disabled={!!retryingOrderId}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {retryingOrderId === order.order_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              Retry provisioning
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
              {smmInstances.length === 0 && smmOrders.length === 0 && (
                <div className="text-center py-12">
                  <Share2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No SMM website orders yet</p>
                  <button
                    onClick={() => router.push('/smm')}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Get SMM Website
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Invoices</h2>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No invoices found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Invoice #{invoice.invoice_number}</h3>
                          <p className="text-sm text-gray-600">
                            {invoice.package_name && `Package: ${invoice.package_name}`}
                            {invoice.order_reference && ` • Order: ${invoice.order_reference}`}
                          </p>
                        </div>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-600">Total Amount</p>
                          <p className="font-semibold text-lg">{invoice.currency} {Number(invoice.total_amount || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Due Date</p>
                          <p className="font-semibold">{new Date(invoice.due_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Invoice Date</p>
                          <p className="font-semibold">{new Date(invoice.created_at).toLocaleDateString()}</p>
                        </div>
                        {invoice.paid_at && (
                          <div>
                            <p className="text-gray-600">Paid Date</p>
                            <p className="font-semibold">{new Date(invoice.paid_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      {invoice.invoice_items && invoice.invoice_items.length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Items:</p>
                          <ul className="space-y-1">
                            {invoice.invoice_items.map((item, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex justify-between">
                                <span>{item.description} {item.billing_period && `(${item.billing_period})`}</span>
                                <span className="font-semibold">{invoice.currency} {Number(item.total || 0).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {invoice.notes && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Notes:</span> {invoice.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="mt-1 text-gray-900">{user?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-gray-900">{user?.email}</p>
                </div>
                {user?.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-gray-900">{user.phone}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Member Since</label>
                  <p className="mt-1 text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

