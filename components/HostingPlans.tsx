'use client'

import { useState } from 'react';
import { Check, Server, Shield, Zap, Globe, Mail, Database, Cloud, Lock, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';

interface HostingPlan {
  id: string;
  name: string;
  price: number;
  period: 'monthly' | 'yearly';
  popular?: boolean;
  features: {
    storage: string;
    bandwidth: string;
    domains: string;
    emailAccounts: string;
    databases: string;
    ssl: boolean;
    backups: string;
    support: string;
    cpanel: boolean;
    wordpress: boolean;
    phpVersion: string;
    nodejs: boolean;
    python: boolean;
  };
}

const monthlyPlans: HostingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 4.99,
    period: 'monthly',
    features: {
      storage: '10 GB',
      bandwidth: '100 GB',
      domains: '1',
      emailAccounts: '5',
      databases: '5',
      ssl: true,
      backups: 'Weekly',
      support: 'Email',
      cpanel: true,
      wordpress: true,
      phpVersion: '8.1',
      nodejs: false,
      python: false,
    },
  },
  {
    id: 'business',
    name: 'Business',
    price: 9.99,
    period: 'monthly',
    popular: true,
    features: {
      storage: '50 GB',
      bandwidth: '500 GB',
      domains: '5',
      emailAccounts: '25',
      databases: '25',
      ssl: true,
      backups: 'Daily',
      support: 'Priority Email',
      cpanel: true,
      wordpress: true,
      phpVersion: '8.1',
      nodejs: true,
      python: false,
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 19.99,
    period: 'monthly',
    features: {
      storage: '100 GB',
      bandwidth: 'Unlimited',
      domains: 'Unlimited',
      emailAccounts: 'Unlimited',
      databases: 'Unlimited',
      ssl: true,
      backups: 'Daily + On-Demand',
      support: '24/7 Priority',
      cpanel: true,
      wordpress: true,
      phpVersion: '8.1',
      nodejs: true,
      python: true,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 39.99,
    period: 'monthly',
    features: {
      storage: '200 GB',
      bandwidth: 'Unlimited',
      domains: 'Unlimited',
      emailAccounts: 'Unlimited',
      databases: 'Unlimited',
      ssl: true,
      backups: 'Real-time + On-Demand',
      support: '24/7 Dedicated',
      cpanel: true,
      wordpress: true,
      phpVersion: '8.1',
      nodejs: true,
      python: true,
    },
  },
];

const yearlyPlans: HostingPlan[] = monthlyPlans.map(plan => ({
  ...plan,
  price: plan.price * 10, // 2 months free (10 months price for 12 months)
  period: 'yearly',
}));

export default function HostingPlans() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const plans = billingPeriod === 'monthly' ? monthlyPlans : yearlyPlans;

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Server className="w-4 h-4" />
            Premium Web Hosting
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
            Choose Your <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Hosting Plan</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Fast, reliable, and secure hosting solutions powered by our reseller infrastructure. 
            Get started with our affordable plans today.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 bg-white p-2 rounded-lg shadow-md">
            <button
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

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
                plan.popular
                  ? 'border-2 border-blue-500 scale-105 md:scale-110 lg:scale-105'
                  : 'border border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Star className="w-4 h-4 fill-current" />
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-600">/{plan.period === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  {plan.period === 'yearly' && (
                    <p className="text-sm text-gray-500 mt-1">
                      ${(plan.price / 12).toFixed(2)}/month billed annually
                    </p>
                  )}
                </div>

                <Link
                  href={`/contact?plan=${plan.id}&period=${plan.period}`}
                  className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all mb-6 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg hover:scale-105'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Get Started
                  <ArrowRight className="inline ml-2 w-4 h-4" />
                </Link>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.storage} Storage</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.bandwidth} Bandwidth</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.domains} Domain{plan.features.domains !== 'Unlimited' && plan.features.domains !== '1' ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.emailAccounts} Email Account{plan.features.emailAccounts !== 'Unlimited' && plan.features.emailAccounts !== '1' ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.databases} Database{plan.features.databases !== 'Unlimited' && plan.features.databases !== '1' ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">Free SSL Certificate</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.backups} Backups</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{plan.features.support} Support</span>
                  </div>
                  {plan.features.cpanel && (
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">cPanel Included</span>
                    </div>
                  )}
                  {plan.features.wordpress && (
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">WordPress Optimized</span>
                    </div>
                  )}
                  {plan.features.nodejs && (
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">Node.js Support</span>
                    </div>
                  )}
                  {plan.features.python && (
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">Python Support</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Why Choose Our Hosting?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Lightning Fast</h3>
              <p className="text-gray-600">
                SSD storage and optimized servers ensure your website loads in milliseconds.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">99.9% Uptime</h3>
              <p className="text-gray-600">
                Guaranteed uptime with redundant infrastructure and 24/7 monitoring.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Lock className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Secure by Default</h3>
              <p className="text-gray-600">
                Free SSL certificates, daily backups, and advanced security measures included.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 md:p-12 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of satisfied customers hosting their websites with us.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:shadow-xl transition-all hover:scale-105"
          >
            Contact Us Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

