'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import { fetchSmmProducts, SmmProduct } from '@/lib/api';
import { Loader2, Share2, CheckCircle } from 'lucide-react';

export default function SmmPage() {
  const [products, setProducts] = useState<SmmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchSmmProducts();
        setProducts(list);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Social Media Marketing Website
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Get your own social media marketing website. Install it on your custom domain or use our subdomain.
            </p>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700 text-center">
              {error}
            </div>
          )}
          {!loading && !error && products.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              No plans available at the moment.
            </div>
          )}
          {!loading && !error && products.length > 0 && (
            <div className="space-y-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                          <Share2 className="w-5 h-5" />
                          <span className="font-medium">{product.display_name}</span>
                        </div>
                        {product.description && (
                          <p className="text-gray-600 mt-2">{product.description}</p>
                        )}
                        <ul className="mt-4 space-y-2">
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            Install on your custom domain
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            Or use our subdomain (e.g. yourname.fivedit.com)
                          </li>
                        </ul>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <div className="text-3xl font-bold text-gray-900">
                          {product.currency} {typeof product.price === 'number' ? product.price.toFixed(2) : Number(product.price || 0).toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">One-time</p>
                        <Link
                          href={`/smm/checkout?product=${product.id}`}
                          className="mt-4 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          Get Started
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 flex justify-center gap-4">
            <Link href="/services" className="text-indigo-600 hover:text-indigo-800 font-medium">
              All services
            </Link>
            <Link href="/customer" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Customer portal
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}
