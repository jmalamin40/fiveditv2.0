'use client'

import { useState } from 'react';
import { ShoppingCart, Check, X, Clock, Star, ExternalLink, Package } from 'lucide-react';
import { codecanyonScripts, CodeCanyonScript, InstallationPlan, defaultPlans } from '@/lib/codecanyon-scripts';
import Link from 'next/link';

export default function CodeCanyonScripts() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const categories = ['All', ...Array.from(new Set(codecanyonScripts.map(s => s.category)))];
  const filteredScripts = selectedCategory === 'All' 
    ? codecanyonScripts 
    : codecanyonScripts.filter(s => s.category === selectedCategory);

  return (
    <section id="codecanyon-scripts" className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Package size={16} />
            CodeCanyon Script Installation Service
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Professional <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Installation Plans</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose from our flexible installation plans designed to meet your specific needs. We support all CodeCanyon scripts.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Scripts Grid */}
        <div className="space-y-16">
          {filteredScripts.map((script) => (
            <ScriptCard key={script.id} script={script} />
          ))}
        </div>

        {/* Generic Plans Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4 text-gray-900">
              Don't See Your Script?
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We install and configure any CodeCanyon script. Contact us with your script details and we'll provide a custom quote.
            </p>
          </div>
          <GenericPlansSection />
        </div>
      </div>
    </section>
  );
}

function ScriptCard({ script }: { script: CodeCanyonScript }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-8 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
              {script.category}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{script.name}</h3>
            <p className="text-gray-600">{script.description}</p>
          </div>
          {script.codecanyonUrl && (
            <a
              href={script.codecanyonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              View on CodeCanyon
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
      
      <div className="p-8">
        <PlansGrid plans={script.plans} scriptName={script.name} />
      </div>
    </div>
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

      <Link
        href={`#contact?service=CodeCanyon Installation&plan=${plan.name}&script=${encodeURIComponent(scriptName)}`}
        className={`block w-full text-center py-3 rounded-lg font-semibold transition-all ${
          plan.popular
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        <ShoppingCart size={18} className="inline mr-2" />
        Select Plan
      </Link>
    </div>
  );
}

function GenericPlansSection() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold mb-4 text-gray-900">
          Standard Installation Plans
        </h3>
        <p className="text-gray-600">
          These plans apply to any CodeCanyon script. Custom quotes available for complex requirements.
        </p>
      </div>
      <PlansGrid plans={defaultPlans} scriptName="Your CodeCanyon Script" />
    </div>
  );
}

