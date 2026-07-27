'use client'

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';

export default function CoursePaymentCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Cancelled</h1>
            <p className="text-lg text-gray-600 mb-8">
              Your payment was cancelled. No charges were made to your account.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/courses')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Back to Courses
              </button>
              <button
                onClick={() => router.back()}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}
