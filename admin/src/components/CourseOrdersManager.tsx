import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { fetchCourseOrders, CourseOrderAdmin } from '../api';

interface Props {
  token: string;
  toast: ReturnType<typeof useToast>;
}

export default function CourseOrdersManager({ token, toast }: Props) {
  const [orders, setOrders] = useState<CourseOrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchCourseOrders(token, statusFilter !== 'all' ? statusFilter : undefined);
      setOrders(data);
    } catch (error: any) {
      toast.error(`Failed to load course orders: ${error?.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { className: string; icon: any } } = {
      paid: { className: 'badge-success', icon: CheckCircle },
      completed: { className: 'badge-success', icon: CheckCircle },
      pending: { className: 'badge-info', icon: Clock },
      failed: { className: 'badge-error', icon: XCircle },
      cancelled: { className: 'badge-error', icon: XCircle },
    };
    const config = statusConfig[status] || { className: 'badge-secondary', icon: Clock };
    const Icon = config.icon;
    return (
      <span className={`badge ${config.className}`}>
        <Icon size={14} style={{ marginRight: '4px' }} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="card-panel">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <CreditCard size={24} />
          <h1>Course Sales</h1>
        </div>
      </div>

      <div className="card-body">
        <div className="flex gap-4 mb-4 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-control"
            style={{ minWidth: '150px' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="spinner"></div>
            <p>Loading course orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard size={48} className="text-gray-400 mb-4" />
            <p className="text-gray-600">No course orders found</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Course</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <code className="text-sm">{order.order_id}</code>
                    </td>
                    <td>{order.course_current_title || order.course_title}</td>
                    <td>
                      <div>{order.customer_name}</div>
                      <div className="text-sm" style={{ color: '#6b7280' }}>{order.customer_email}</div>
                    </td>
                    <td className="font-semibold">{formatCurrency(Number(order.amount), order.currency)}</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td>{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
