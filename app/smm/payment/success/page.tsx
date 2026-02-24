'use client'

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import { getSmmOrderStatus, SmmOrder, SmmInstance } from '@/lib/api';
import { Loader2, CheckCircle, ExternalLink } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [order, setOrder] = useState<SmmOrder | null>(null);
  const [instance, setInstance] = useState<SmmInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('Missing order ID');
      return;
    }
    (async () => {
      try {
        const data = await getSmmOrderStatus(orderId);
        setOrder(data.order);
        setInstance(data.instance || null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700 mb-6">
              {error}
              <Link href="/smm" className="block mt-2 text-indigo-600 hover:underline">Back to SMM</Link>
            </div>
          )}
          {!error && order && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Payment successful</h1>
              <p className="mt-2 text-gray-600">Order <strong>{order.order_id}</strong>{order.product_display_name ? ' – ' + order.product_display_name : ''}</p>
              <p className="mt-1 text-gray-600">Amount: {order.currency} {Number(order.amount || 0).toFixed(2)}</p>

              {instance ? (
                <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200 text-left">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Your website</h2>
                  <p className="text-sm text-gray-600 mb-2">It may take a few minutes to be ready.</p>
                  <a href={instance.site_url.startsWith('http') ? instance.site_url : 'https://' + instance.site_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-indigo-600 hover:underline font-medium">
                    {instance.site_url}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {order.domain && (
                    <p className="mt-2 text-sm text-gray-500">Custom domain: {order.domain} – point your DNS to our server as instructed.</p>
                  )}
                </div>
              ) : (
                <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200 text-left">
                  <p className="text-gray-600">
                    Your instance is being set up. Check your email or visit your <Link href="/customer" className="text-indigo-600 hover:underline">customer portal</Link> to see your SMM website link once it is ready.
                  </p>
                </div>
              )}

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/customer" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">Go to Customer Portal</Link>
                <Link href="/smm" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50">Back to SMM</Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}

export default function SmmPaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
