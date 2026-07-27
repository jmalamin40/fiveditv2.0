'use client'

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { fetchCourseById, createCourseOrder, getCustomerProfile, customerRegister, Course } from '@/lib/api';
import { Loader2, AlertCircle, User } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const courseId = searchParams.get('course');

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
    checkCustomerLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const checkCustomerLogin = async () => {
    const token = localStorage.getItem('customer_token');
    if (token) {
      try {
        setLoadingProfile(true);
        const profile = await getCustomerProfile(token);
        setIsLoggedIn(true);
        setFormData({
          customer_name: profile.user.name,
          customer_email: profile.user.email,
          customer_phone: profile.user.phone || '',
          password: '',
          confirmPassword: '',
        });
      } catch {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
        setIsLoggedIn(false);
      } finally {
        setLoadingProfile(false);
      }
    }
  };

  const loadCourse = async () => {
    try {
      setLoading(true);
      const data = await fetchCourseById(courseId!);
      setCourse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!courseId) {
        throw new Error('Course ID is required');
      }

      if (!isLoggedIn && formData.password) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        try {
          const registerResponse = await customerRegister({
            name: formData.customer_name,
            email: formData.customer_email,
            password: formData.password,
            phone: formData.customer_phone || undefined,
          });
          localStorage.setItem('customer_token', registerResponse.token);
          localStorage.setItem('customer_user', JSON.stringify(registerResponse.user));
          setIsLoggedIn(true);
        } catch (regErr: any) {
          if (!regErr.message?.includes('already exists') && !regErr.message?.includes('Email')) {
            throw regErr;
          }
        }
      }

      const order = await createCourseOrder({
        course_id: courseId,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || undefined,
      });

      if (order.payment_url) {
        window.location.href = order.payment_url;
      } else {
        throw new Error('Payment URL not received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create order');
      setSubmitting(false);
    }
  };

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
        <Footer />
        <Chat />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Course Not Found</h2>
            <p className="text-gray-600 mb-4">The course you&apos;re looking for doesn&apos;t exist.</p>
            <button
              onClick={() => router.push('/courses')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Courses
            </button>
          </div>
        </main>
        <Footer />
        <Chat />
      </div>
    );
  }

  const price = course.discount_price !== null && course.discount_price !== undefined ? course.discount_price : course.price;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Course</p>
                    <p className="font-semibold text-gray-900">{course.title}</p>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-semibold text-gray-900">Total</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {course.currency} {Number(price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Customer Information</h2>
                    {isLoggedIn && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <User className="w-4 h-4" />
                        <span>Logged in</span>
                      </div>
                    )}
                  </div>
                  {isLoggedIn && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Your account information is pre-filled. You can access this course from your customer portal after purchase.
                      </p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        required
                        readOnly={isLoggedIn}
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          isLoggedIn ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                      <input
                        type="email"
                        required
                        readOnly={isLoggedIn}
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          isLoggedIn ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        readOnly={isLoggedIn}
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          isLoggedIn ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                        placeholder="+1234567890"
                      />
                    </div>

                    {!isLoggedIn && (
                      <>
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-600">
                              Create an account so you can watch this course from your customer portal.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const redirectUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
                                router.push(`/customer/login?redirect=${encodeURIComponent(redirectUrl)}`);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Already have an account? Login
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Password (Optional - for account creation)
                          </label>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="At least 6 characters"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to check out as a guest. You&apos;ll get a one-time login link by email to access your course.
                          </p>
                        </div>
                        {formData.password && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                            <input
                              type="password"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Confirm password"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Proceed to Payment'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <Chat />
    </div>
  );
}

export default function CourseCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <Header />
          <main className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </main>
          <Footer />
          <Chat />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
