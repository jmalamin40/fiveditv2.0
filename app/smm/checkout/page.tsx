'use client'

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import { fetchSmmProduct, createSmmOrder, getCustomerProfile, getDomainPrice, getDomainAvailability, SmmProduct } from '@/lib/api';
import { Loader2, AlertCircle, Globe, AtSign, ShoppingCart, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('product');
  const [product, setProduct] = useState<SmmProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [installType, setInstallType] = useState<'domain' | 'subdomain' | 'new_domain'>('subdomain');
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    domain: '',
    subdomain_slug: '',
    new_domain_name: '',
  });
  const [domainPrice, setDomainPrice] = useState<{ register_price: number; currency: string } | null>(null);
  const [domainPriceLoading, setDomainPriceLoading] = useState(false);
  const [domainPriceError, setDomainPriceError] = useState<string | null>(null);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainAvailabilityLoading, setDomainAvailabilityLoading] = useState(false);

  useEffect(() => {
    if (productId) loadProduct();
    checkCustomerLogin();
  }, [productId]);

  // Debounced domain price + availability when user selects "Purchase new domain"
  useEffect(() => {
    if (installType !== 'new_domain' || !formData.new_domain_name?.trim()) {
      setDomainPrice(null);
      setDomainPriceError(null);
      setDomainAvailable(null);
      return;
    }
    const name = formData.new_domain_name.trim().toLowerCase();
    if (!name.includes('.')) {
      setDomainPrice(null);
      setDomainPriceError(null);
      setDomainAvailable(null);
      return;
    }
    const t = setTimeout(async () => {
      setDomainPriceLoading(true);
      setDomainAvailabilityLoading(true);
      setDomainPriceError(null);
      setDomainAvailable(null);
      try {
        const [p, avail] = await Promise.all([
          getDomainPrice(name).catch((e) => { setDomainPriceError(e instanceof Error ? e.message : 'Price not available'); return null; }),
          getDomainAvailability(name).catch(() => null),
        ]);
        if (p) setDomainPrice({ register_price: p.register_price, currency: p.currency });
        if (avail) setDomainAvailable(avail.available);
      } finally {
        setDomainPriceLoading(false);
        setDomainAvailabilityLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [installType, formData.new_domain_name]);

  const checkCustomerLogin = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;
    try {
      const profile = await getCustomerProfile(token);
      setIsLoggedIn(true);
      setFormData((prev) => ({
        ...prev,
        customer_name: profile.user.name,
        customer_email: profile.user.email,
        customer_phone: profile.user.phone || '',
      }));
    } catch {
      localStorage.removeItem('customer_token');
      localStorage.removeItem('customer_user');
    }
  };

  const loadProduct = async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const p = await fetchSmmProduct(parseInt(productId));
      setProduct(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!product || !productId) throw new Error('Product not loaded');
      if (installType === 'domain' && !formData.domain?.trim()) throw new Error('Please enter your domain');
      if (installType === 'subdomain' && !formData.subdomain_slug?.trim()) throw new Error('Please enter a subdomain');
      if (installType === 'new_domain') {
        if (!formData.new_domain_name?.trim()) throw new Error('Please enter the domain you want to purchase');
        if (!domainPrice) throw new Error('Please wait for domain price or choose a supported TLD');
        if (domainAvailable === false) throw new Error('This domain is already registered. Please choose another.');
      }
      const result = await createSmmOrder({
        product_id: product.id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || undefined,
        domain: installType === 'domain' ? formData.domain?.trim() : undefined,
        subdomain_slug: installType === 'subdomain' ? formData.subdomain_slug?.trim() : undefined,
        new_domain_name: installType === 'new_domain' ? formData.new_domain_name?.trim() : undefined,
      });
      if (result.payment_url) {
        window.location.href = result.payment_url;
        return;
      }
      router.push('/smm/payment/success?order_id=' + encodeURIComponent(result.order_id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const productAmount = Number(product?.price || 0);
  const domainAmount = domainPrice?.register_price ?? 0;
  const totalAmount = productAmount + (installType === 'new_domain' ? domainAmount : 0);
  const currency = product?.currency || 'BDT';

  if (loading || !productId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-lg mx-auto py-12 px-4 text-center">
          <p className="text-red-600">{error || 'Product not found'}</p>
          <Link href="/smm" className="mt-4 inline-block text-indigo-600 hover:underline">Back to SMM</Link>
        </main>
        <Footer />
        <Chat />
      </div>
    );
  }

  const subdomainPreview = formData.subdomain_slug?.trim()
    ? 'https://' + formData.subdomain_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') + '.fivedit.com'
    : '';

  return (
    <div className="min-h-screen">
      <Header />
      <main className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout – SMM Website</h1>
          <p className="text-gray-600 mb-6">{product.display_name} – {product.currency} {Number(product.price || 0).toFixed(2)} (one-time)</p>
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 p-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" required value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" readOnly={isLoggedIn} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" required value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" readOnly={isLoggedIn} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone (optional)</label>
              <input type="text" value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" readOnly={isLoggedIn} />
            </div>
            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Where to install?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="installType" checked={installType === 'subdomain'} onChange={() => setInstallType('subdomain')} className="rounded-full border-gray-300 text-indigo-600" />
                <AtSign className="w-4 h-4 text-gray-500" />
                Our subdomain (no domain needed)
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="radio" name="installType" checked={installType === 'domain'} onChange={() => setInstallType('domain')} className="rounded-full border-gray-300 text-indigo-600" />
                <Globe className="w-4 h-4 text-gray-500" />
                My custom domain
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="radio" name="installType" checked={installType === 'new_domain'} onChange={() => setInstallType('new_domain')} className="rounded-full border-gray-300 text-indigo-600" />
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                Purchase a new domain (package + domain)
              </label>
              {installType === 'subdomain' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Subdomain</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input type="text" placeholder="yourname" value={formData.subdomain_slug} onChange={(e) => setFormData({ ...formData, subdomain_slug: e.target.value })} className="block w-full rounded-l-md border border-gray-300 px-3 py-2" />
                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">.fivedit.com</span>
                  </div>
                  {subdomainPreview && <p className="mt-1 text-sm text-gray-500">Preview: {subdomainPreview}</p>}
                </div>
              )}
              {installType === 'domain' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Your domain</label>
                  <input type="text" placeholder="example.com" value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  <p className="mt-1 text-sm text-gray-500">Point DNS to us after purchase.</p>
                </div>
              )}
              {installType === 'new_domain' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Domain to purchase</label>
                  <input type="text" placeholder="example.com" value={formData.new_domain_name} onChange={(e) => setFormData({ ...formData, new_domain_name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {(domainPriceLoading || domainAvailabilityLoading) && <p className="mt-1 text-sm text-gray-500">Checking price and availability…</p>}
                  {domainPriceError && <p className="mt-1 text-sm text-red-600">{domainPriceError}</p>}
                  {domainPrice && !domainPriceError && (
                    <p className="mt-1 text-sm text-gray-600">Domain: {domainPrice.currency} {domainPrice.register_price.toFixed(2)} (1 year)</p>
                  )}
                  {!domainAvailabilityLoading && domainAvailable === true && (
                    <p className="mt-1 text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4 shrink-0" /> Available</p>
                  )}
                  {!domainAvailabilityLoading && domainAvailable === false && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><XCircle className="w-4 h-4 shrink-0" /> Already registered – choose another domain</p>
                  )}
                </div>
              )}
            </div>
            {installType === 'new_domain' && domainPrice && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-700">Order total</p>
                <p className="text-sm text-gray-600 mt-1">Package: {currency} {productAmount.toFixed(2)} + Domain: {domainPrice.currency} {domainPrice.register_price.toFixed(2)} = <strong>{currency} {totalAmount.toFixed(2)}</strong></p>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={submitting || (installType === 'new_domain' && (!domainPrice || domainAvailable !== true))} className="flex-1 flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Pay {currency} {totalAmount.toFixed(2)}
              </button>
              <Link href="/smm" className="py-3 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</Link>
            </div>
            {!isLoggedIn && (
              <p className="text-sm text-gray-500 text-center">
                Already have an account? <Link href={'/customer/login?redirect=' + encodeURIComponent('/smm/checkout?product=' + productId)} className="text-indigo-600 hover:underline">Log in</Link>
              </p>
            )}
          </form>
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}

export default function SmmCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
