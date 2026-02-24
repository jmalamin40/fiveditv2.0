'use client'

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';

export default function SmmPaymentCancelPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900">Payment cancelled</h1>
          <p className="mt-2 text-gray-600">
            Your order was not completed. You can try again when you&apos;re ready.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/smm"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Back to SMM Website
            </Link>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            >
              Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}
