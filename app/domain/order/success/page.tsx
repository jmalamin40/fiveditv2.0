'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import { CheckCircle, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment successful</h1>
          <p className="text-gray-600 mb-4">
            Your domain order has been received. We will process your registration and contact you if we need any details.
          </p>
          {orderId && (
            <p className="text-sm text-gray-500 font-mono mb-6">Order: {orderId}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/domains"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              <Globe className="w-4 h-4" />
              Register another domain
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}

export default function DomainOrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
