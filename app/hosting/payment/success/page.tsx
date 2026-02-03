'use client'

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getHostingOrderStatus } from '@/lib/api';
import { CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('order_id');
  const transactionId = searchParams.get('transaction_id');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId || transactionId) {
      loadOrderStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, transactionId]);

  const loadOrderStatus = async () => {
    try {
      setLoading(true);
      const id = transactionId || orderId;
      if (!id) return;
      
      const orderData = await getHostingOrderStatus(id);
      setOrder(orderData);
    } catch (err: any) {
      setError(err.message || 'Failed to load order status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Order not found'}</p>
          <button
            onClick={() => router.push('/hosting')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Hosting Plans
          </button>
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'paid' || order.status === 'completed';
  const isPending = order.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {isPaid ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h1>
            <p className="text-lg text-gray-600 mb-8">
              Thank you for your purchase. Your hosting account is being set up.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order ID:</span>
                  <span className="font-semibold">{order.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Package:</span>
                  <span className="font-semibold">{order.package?.display_name || order.package_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">{order.currency} {order.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-semibold text-green-600 capitalize">{order.status}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">What&apos;s Next?</h3>
              <ul className="text-left text-blue-800 space-y-2">
                <li>• You will receive an email with your hosting account credentials shortly</li>
                <li>• Your account will be automatically activated after setup</li>
                <li>• Check your email (including spam folder) for login details</li>
                <li>• You can access your account from the customer portal</li>
              </ul>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/customer')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Go to Customer Portal
              </button>
              <button
                onClick={() => router.push('/hosting')}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Hosting Plans
              </button>
            </div>
          </div>
        ) : isPending ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Loader2 className="w-20 h-20 text-blue-500 mx-auto mb-6 animate-spin" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Pending</h1>
            <p className="text-lg text-gray-600 mb-8">
              Your payment is being processed. Please wait a few moments and refresh this page.
            </p>
            <button
              onClick={loadOrderStatus}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh Status
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <AlertCircle className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Status: {order.status}</h1>
            <p className="text-lg text-gray-600 mb-8">
              Your payment status is: {order.status}
            </p>
            <button
              onClick={() => router.push('/hosting')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Hosting Plans
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
