'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import { getDomainTldPricing, getDomainPrice, createDomainOrder, getCustomerProfile } from '@/lib/api';
import type { DomainTldPrice } from '@/lib/api';
import { Loader2, Globe, Search, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function DomainsPage() {
  const [tlds, setTlds] = useState<DomainTldPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domainToBuy, setDomainToBuy] = useState<string | null>(null);
  const [priceInfo, setPriceInfo] = useState<DomainTldPrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData] = useState({ customer_name: '', customer_email: '', customer_phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getDomainTldPricing()
      .then((r) => setTlds(r.tlds || []))
      .catch(() => setTlds([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (token) {
      getCustomerProfile(token)
        .then((p) => {
          setIsLoggedIn(true);
          setFormData((prev) => ({ ...prev, customer_name: p.user.name, customer_email: p.user.email, customer_phone: p.user.phone || '' }));
        })
        .catch(() => {});
    }
  }, []);

  const normalizedSearch = search.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const hasTld = normalizedSearch.includes('.');

  const handleCheckPrice = () => {
    if (!normalizedSearch || !hasTld) return;
    setPriceLoading(true);
    setPriceError(null);
    setPriceInfo(null);
    setDomainToBuy(normalizedSearch);
    getDomainPrice(normalizedSearch)
      .then((p) => {
        setPriceInfo(p);
        setShowCheckout(true);
      })
      .catch((e) => {
        setPriceError(e instanceof Error ? e.message : 'Price not available');
        setPriceInfo(null);
        setShowCheckout(false);
      })
      .finally(() => setPriceLoading(false));
  };

  const handleBuyDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainToBuy || !priceInfo) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await createDomainOrder({
        domain_name: domainToBuy,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || undefined,
      });
      if (result.payment_url) {
        window.location.href = result.payment_url;
        return;
      }
      setError('No payment URL returned');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cancelled') === '1';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-slate-50 to-white">
        <section className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
              <Globe className="w-10 h-10 text-indigo-600" />
              Register a domain
            </h1>
            <p className="text-gray-600 text-lg">
              Search for your perfect domain. Buy a domain only or add it to your hosting or SMM package later.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 mb-10">
            <label className="block text-sm font-medium text-gray-700 mb-2">Domain name</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="example.com"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPriceError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckPrice()}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={handleCheckPrice}
                disabled={!normalizedSearch || !hasTld || priceLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {priceLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Check price
              </button>
            </div>
            {priceError && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {priceError}
              </div>
            )}
            {priceInfo && domainToBuy && (
              <div className="mt-4 p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-indigo-600" />
                  <span className="font-medium text-gray-900">{domainToBuy}</span>
                  <span className="text-gray-600">— {priceInfo.currency} {priceInfo.register_price.toFixed(2)} / year (register)</span>
                  <span className="text-gray-500 text-sm">Renew: {priceInfo.currency} {priceInfo.renew_price.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {showCheckout && priceInfo && domainToBuy && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 mb-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-indigo-600" />
                Checkout – {domainToBuy}
              </h2>
              <form onSubmit={handleBuyDomain} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 p-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData((f) => ({ ...f, customer_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    readOnly={isLoggedIn}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.customer_email}
                    onChange={(e) => setFormData((f) => ({ ...f, customer_email: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    readOnly={isLoggedIn}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                  <input
                    type="text"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    readOnly={isLoggedIn}
                  />
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Pay {priceInfo.currency} {priceInfo.register_price.toFixed(2)}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCheckout(false); setDomainToBuy(null); setPriceInfo(null); }}
                    className="px-6 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {cancelled && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              Payment was cancelled. You can search and try again when ready.
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular TLDs & pricing</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : tlds.length === 0 ? (
              <p className="text-gray-500">No TLDs configured yet. Check back later.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tlds.map((t) => (
                  <div
                    key={t.tld}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">.{t.tld}</span>
                    <div className="text-right text-sm">
                      <div className="text-gray-700">{t.currency} {t.register_price.toFixed(2)} <span className="text-gray-500">/ year</span></div>
                      <div className="text-gray-500">Renew: {t.currency} {t.renew_price.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-6 text-gray-500 text-sm">
              Need hosting or an SMM website? You can <Link href="/smm" className="text-indigo-600 hover:underline">add a domain when ordering an SMM package</Link> or <Link href="/hosting" className="text-indigo-600 hover:underline">choose a hosting plan</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}
