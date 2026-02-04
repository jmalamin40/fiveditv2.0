import { useState, useEffect } from 'react';
import { FileText, Search, Filter, Download, Eye, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { fetchInvoices, fetchInvoice, updateInvoiceStatus, generateInvoiceForOrder, Invoice, InvoiceFilters } from '../api';

interface Props {
  token: string;
  toast: ReturnType<typeof useToast>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

export default function InvoiceManager({ token, toast }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdateInvoice, setStatusUpdateInvoice] = useState<Invoice | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusForm, setStatusForm] = useState({
    status: 'draft',
    notes: '',
  });

  useEffect(() => {
    loadInvoices();
  }, [filters, statusFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const queryFilters: InvoiceFilters = {
        ...filters,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };
      const data = await fetchInvoices(token, queryFilters);
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      toast.error(`Failed to load invoices: ${error?.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (invoiceId: number) => {
    try {
      const data = await fetchInvoice(token, invoiceId);
      setSelectedInvoice(data.invoice);
      setShowInvoiceModal(true);
    } catch (error: any) {
      toast.error(`Failed to load invoice: ${error?.response?.data?.error || error.message}`);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdateInvoice) return;

    try {
      await updateInvoiceStatus(
        token,
        statusUpdateInvoice.id,
        statusForm.status,
        statusForm.notes || undefined
      );
      toast.success('Invoice status updated successfully');
      setShowStatusModal(false);
      setStatusUpdateInvoice(null);
      setStatusForm({ status: 'pending', notes: '' });
      loadInvoices();
    } catch (error: any) {
      toast.error(`Failed to update status: ${error?.response?.data?.error || error.message}`);
    }
  };

  const openStatusModal = (invoice: Invoice) => {
    setStatusUpdateInvoice(invoice);
    setStatusForm({
      status: invoice.status,
      notes: invoice.notes || '',
    });
    setShowStatusModal(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; className: string; icon: any } } = {
      paid: { label: 'Paid', className: 'badge-success', icon: CheckCircle },
      overdue: { label: 'Overdue', className: 'badge-error', icon: Clock },
      cancelled: { label: 'Cancelled', className: 'badge-error', icon: XCircle },
      draft: { label: 'Draft', className: 'badge-secondary', icon: FileText },
      sent: { label: 'Sent', className: 'badge-info', icon: FileText },
    };

    const config = statusConfig[status] || { label: status, className: 'badge-secondary', icon: FileText };
    const Icon = config.icon;

    return (
      <span className={`badge ${config.className}`}>
        <Icon size={14} style={{ marginRight: '4px' }} />
        {config.label}
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const invoiceId = (invoice.invoice_id || invoice.invoice_number || `#${invoice.id}`).toLowerCase();
    return (
      invoiceId.includes(search) ||
      invoice.customer_name_full?.toLowerCase().includes(search) ||
      invoice.order_reference?.toLowerCase().includes(search) ||
      invoice.package_name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="card-panel">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <FileText size={24} />
          <h1>Invoice Management</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="card-body">
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="input-group">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setFilters({ ...filters, page: 1 });
              }}
              className="form-control"
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="spinner"></div>
            <p>Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={48} className="text-gray-400 mb-4" />
            <p className="text-gray-600">No invoices found</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Customer</th>
                    <th>Order Reference</th>
                    <th>Package</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <code className="text-sm">{invoice.invoice_id || invoice.invoice_number || `#${invoice.id}`}</code>
                      </td>
                      <td>{invoice.customer_name_full || `Customer #${invoice.customer_id}`}</td>
                      <td>
                        {invoice.order_reference ? (
                          <code className="text-sm">{invoice.order_reference}</code>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td>{invoice.package_name || 'N/A'}</td>
                      <td className="font-semibold">
                        {formatCurrency(Number(invoice.amount), invoice.currency)}
                      </td>
                      <td>{formatDate(invoice.due_date)}</td>
                      <td>{getStatusBadge(invoice.status)}</td>
                      <td>{formatDate(invoice.created_at)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewInvoice(invoice.id)}
                            className="btn-sm btn-primary"
                            title="View Invoice"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openStatusModal(invoice)}
                            className="btn-sm btn-secondary"
                            title="Update Status"
                          >
                            <Filter size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="btn-sm"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.totalPages}
                    className="btn-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Invoice Details</h2>
              <button className="modal-close" onClick={() => setShowInvoiceModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-600">Invoice ID</label>
                  <p className="font-semibold">{selectedInvoice.invoice_id || selectedInvoice.invoice_number || `#${selectedInvoice.id}`}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Status</label>
                  <div>{getStatusBadge(selectedInvoice.status)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Customer</label>
                  <p>{selectedInvoice.customer_name_full || `Customer #${selectedInvoice.customer_id}`}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Order Reference</label>
                  <p>{selectedInvoice.order_reference || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Package</label>
                  <p>{selectedInvoice.package_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Billing Period</label>
                  <p>{selectedInvoice.billing_period || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Amount</label>
                  <p className="font-semibold text-lg">
                    {formatCurrency(Number(selectedInvoice.amount), selectedInvoice.currency)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Due Date</label>
                  <p>{formatDate(selectedInvoice.due_date)}</p>
                </div>
                {selectedInvoice.paid_at && (
                  <div>
                    <label className="text-sm text-gray-600">Paid At</label>
                    <p>{formatDate(selectedInvoice.paid_at)}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600">Created</label>
                  <p>{formatDate(selectedInvoice.created_at)}</p>
                </div>
              </div>
              {selectedInvoice.notes && (
                <div className="mb-4">
                  <label className="text-sm text-gray-600">Notes</label>
                  <p className="p-3 bg-gray-50 rounded">{selectedInvoice.notes}</p>
                </div>
              )}
              {selectedInvoice.invoice_items && (
                <div>
                  <label className="text-sm text-gray-600 mb-2 block">Invoice Items</label>
                  <div className="border rounded p-4">
                    <pre className="text-sm">{JSON.stringify(selectedInvoice.invoice_items, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && statusUpdateInvoice && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Invoice Status</h2>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Invoice ID</label>
                <p className="text-gray-700">{statusUpdateInvoice.invoice_id || statusUpdateInvoice.invoice_number || `#${statusUpdateInvoice.id}`}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Status *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="form-control"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  className="form-control"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStatusUpdate}>
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

