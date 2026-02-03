'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomerOrders, getCustomerAccounts, getCustomerProfile, CustomerOrder, CustomerAccount } from '@/lib/api';
import { Loader2, LogOut, Package, Server, User, Calendar, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function CustomerDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'accounts' | 'profile'>('orders');

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
  }, []);

  const loadData = async (authToken: string) => {
    try {
      setLoading(true);
      const [ordersData, accountsData, profileData] = await Promise.all([
        getCustomerOrders(authToken),
        getCustomerAccounts(authToken),
        getCustomerProfile(authToken),
      ]);
      setOrders(ordersData.orders);
      setAccounts(accountsData.accounts);
      setUser(profileData.user);
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
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Amount</p>
                          <p className="font-semibold">{order.currency} {order.amount.toFixed(2)}</p>
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
                        {getStatusBadge(account.status)}
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

