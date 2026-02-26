'use client'

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { customerGuestLogin } from '@/lib/api';
import { Loader2 } from 'lucide-react';

function AutoLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const orderId = searchParams.get('order_id');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !orderId) {
      setError('Missing token or order ID');
      router.replace('/customer/login');
      return;
    }
    (async () => {
      try {
        const data = await customerGuestLogin(token, orderId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('customer_token', data.token);
          localStorage.setItem('customer_user', JSON.stringify(data.user));
        }
        router.replace('/customer');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Login failed');
      }
    })();
  }, [token, orderId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => router.push('/customer/login')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );
}

export default function CustomerAutoLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <AutoLoginContent />
    </Suspense>
  );
}
