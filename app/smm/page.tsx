'use client'

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import { fetchSmmProducts, fetchSmmConfig, SmmProduct, SmmWebsiteConfig } from '@/lib/api';
import { Loader2, Link2, Zap, Crown, CheckCircle, ArrowRight, Star, Globe, Settings } from 'lucide-react';

type BillingPeriod = 'monthly' | 'yearly';

interface PlanRow {
  tier: 'starter' | 'standard' | 'premium';
  displayName: string;
  monthly: SmmProduct | null;
  yearly: SmmProduct | null;
  popular?: boolean;
}

function TierIcon({ tier }: { tier: PlanRow['tier'] }) {
  switch (tier) {
    case 'standard':
      return <Zap className="w-5 h-5 text-blue-600" />;
    case 'premium':
      return <Crown className="w-5 h-5 text-amber-600" />;
    default:
      return <Link2 className="w-5 h-5 text-slate-600" />;
  }
}

function buildPlans(products: SmmProduct[]): PlanRow[] {
  const byTier: Record<string, { monthly: SmmProduct | null; yearly: SmmProduct | null }> = {
    starter: { monthly: null, yearly: null },
    standard: { monthly: null, yearly: null },
    premium: { monthly: null, yearly: null },
  };
  products.forEach((p) => {
    const t = (p.package_tier || 'starter').toLowerCase();
    if (t in byTier) {
      if (p.billing_interval === 'monthly') byTier[t].monthly = p;
      else if (p.billing_interval === 'yearly') byTier[t].yearly = p;
    }
  });
  const names: Record<string, string> = { starter: 'Starter', standard: 'Standard', premium: 'Premium' };
  return (['starter', 'standard', 'premium'] as const).map((tier) => ({
    tier,
    displayName: names[tier] || tier,
    monthly: byTier[tier].monthly,
    yearly: byTier[tier].yearly,
    popular: tier === 'standard',
  }));
}

export default function SmmPage() {
  const [products, setProducts] = useState<SmmProduct[]>([]);
  const [smmConfig, setSmmConfig] = useState<SmmWebsiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    (async () => {
      try {
        const [list, config] = await Promise.all([fetchSmmProducts(), fetchSmmConfig()]);
        setProducts(list);
        setSmmConfig(config);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const plans = useMemo(() => buildPlans(products), [products]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="py-20 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Choose Your <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">SMM Package</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Full ecommerce stack with Node.js + React, AI, real-time notifications, bKash/Nagad/SSLCommerce, and more.
              <br />
              Use your custom domain or our subdomain. Get started with an affordable plan today.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-4 bg-white p-2 rounded-lg shadow-md">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-3 rounded-md font-semibold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-3 rounded-md font-semibold transition-all relative ${
                  billingPeriod === 'yearly'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading plans...</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-red-700 text-center border border-red-100 max-w-2xl mx-auto">
              {error}
            </div>
          )}
          {!loading && !error && plans.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {plans.map((plan) => {
                const product = billingPeriod === 'monthly' ? plan.monthly : plan.yearly;
                const features = product && Array.isArray(product.features) ? product.features : [];
                const isPopular = plan.popular;

                return (
                  <div
                    key={plan.tier}
                    className={`relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                      isPopular ? 'border-2 border-blue-500 ring-2 ring-blue-500/20' : 'border border-gray-200'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1 shadow-md">
                          <Star className="w-4 h-4 fill-current" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="p-8">
                      <div className="flex items-center gap-2 mb-4">
                        <TierIcon tier={plan.tier} />
                        <h3 className="text-2xl font-bold text-gray-900">{plan.displayName}</h3>
                      </div>

                      {product ? (
                        <>
                          <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-gray-900 tabular-nums">
                              {product.currency} {typeof product.price === 'number' ? product.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : Number(product.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-gray-600">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
                          </div>
                          {billingPeriod === 'yearly' && typeof product.price === 'number' && (
                            <p className="text-sm text-gray-500 mb-6">
                              {product.currency} {(product.price / 12).toFixed(2)} /month billed annually
                            </p>
                          )}

                          <Link
                            href={`/smm/checkout?product=${product.id}`}
                            className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all mb-6 ${
                              isPopular
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg hover:scale-[1.02]'
                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                            }`}
                          >
                            Get Started
                            <ArrowRight className="inline ml-2 w-4 h-4" />
                          </Link>
                        </>
                      ) : (
                        <p className="text-gray-500 text-sm mb-6">No {billingPeriod} plan available.</p>
                      )}

                      <div className="space-y-3">
                        {(features.length ? features : [
                          'Backend Node.js & Frontend React.js',
                          'Complete Ecommerce & AI supported',
                          'Real-time push notification',
                          'bKash, Nagad, SSLCommerce',
                          'SMTP & easy checkout',
                        ]).map((f, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span className="text-gray-700 text-sm">{f}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-blue-600 shrink-0" />
                          <span className="text-gray-700 text-sm">Custom domain or subdomain (e.g. yourname.fivedit.com)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && plans.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              No plans available at the moment.
            </div>
          )}

          {!loading && smmConfig && smmConfig.website_configuration_product_id && (
            <div className="max-w-xl mx-auto mt-12 mb-16">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-slate-100">
                    <Settings className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">SMM Website Configuration</h3>
                    <p className="text-gray-600 text-sm mt-1">One-time setup and configuration of your SMM website.</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums">
                    {smmConfig.website_configuration_currency} {Number(smmConfig.website_configuration_price).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </span>
                  <span className="text-gray-500 text-sm">one-time</span>
                </div>
                <Link
                  href={`/smm/checkout?product=${smmConfig.website_configuration_product_id}`}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto py-3 px-6 rounded-lg font-semibold bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:shadow-lg transition-all"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/services" className="text-blue-600 hover:text-blue-800 font-medium">
              All services
            </Link>
            <Link href="/customer" className="text-blue-600 hover:text-blue-800 font-medium">
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
