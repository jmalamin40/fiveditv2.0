'use client'

import { ShoppingCart, Check, X, Clock, ExternalLink, ArrowLeft } from 'lucide-react';
import { CodeCanyonScript, InstallationPlan } from '@/lib/codecanyon-scripts';
import Link from 'next/link';

interface CodeCanyonScriptDetailProps {
  script: CodeCanyonScript;
}

export default function CodeCanyonScriptDetail({ script }: CodeCanyonScriptDetailProps) {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        {/* Back Button */}
        <Link
          href="/services/codecanyon"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-8"
        >
          <ArrowLeft size={18} />
          Back to Scripts List
        </Link>

        {/* Script Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div className="flex-1">
              <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                {script.category}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {script.name}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                {script.description}
              </p>
              {script.codecanyonUrl && (
                <a
                  href={script.codecanyonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  View on CodeCanyon
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Installation Plans */}
        <div className="mb-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Installation <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Plans</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that best fits your needs. All plans include professional installation and setup.
            </p>
          </div>

          <PlansGrid plans={script.plans} scriptName={script.name} />
        </div>
      </div>
    </section>
  );
}

function PlansGrid({ plans, scriptName }: { plans: InstallationPlan[]; scriptName: string }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} scriptName={scriptName} />
      ))}
    </div>
  );
}

function PlanCard({ plan, scriptName }: { plan: InstallationPlan; scriptName: string }) {
  return (
    <div
      className={`relative bg-gradient-to-br ${
        plan.popular
          ? 'from-blue-600 to-cyan-600 text-white scale-105 shadow-2xl'
          : 'from-white to-gray-50 text-gray-900 border-2 border-gray-200'
      } rounded-xl p-6 transition-all hover:shadow-xl`}
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
        <p className={`text-sm mb-4 ${plan.popular ? 'text-blue-50' : 'text-gray-600'}`}>
          {plan.description}
        </p>
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
            ${plan.price}
          </span>
          <span className={`text-sm ${plan.popular ? 'text-blue-50' : 'text-gray-600'}`}>
            {plan.currency || 'USD'}
          </span>
        </div>
        <div className={`flex items-center gap-2 mt-2 text-sm ${plan.popular ? 'text-blue-50' : 'text-gray-600'}`}>
          <Clock size={14} />
          <span>Delivery: {plan.deliveryTime}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            {feature.included ? (
              <Check
                size={18}
                className={`flex-shrink-0 mt-0.5 ${
                  plan.popular ? 'text-white' : 'text-green-600'
                }`}
              />
            ) : (
              <X
                size={18}
                className={`flex-shrink-0 mt-0.5 ${
                  plan.popular ? 'text-blue-200' : 'text-gray-300'
                }`}
              />
            )}
            <span
              className={`text-sm ${
                feature.included
                  ? plan.popular
                    ? 'text-white'
                    : 'text-gray-700'
                  : plan.popular
                  ? 'text-blue-200 line-through'
                  : 'text-gray-400 line-through'
              }`}
            >
              {feature.name}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={`#contact?service=CodeCanyon Installation&plan=${plan.name}&script=${encodeURIComponent(scriptName)}`}
        className={`block w-full text-center py-3 rounded-lg font-semibold transition-all ${
          plan.popular
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        <ShoppingCart size={18} className="inline mr-2" />
        Select Plan
      </a>
    </div>
  );
}

