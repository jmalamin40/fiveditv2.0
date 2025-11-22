'use client'

import { ShoppingCart, Check, X, Clock, ArrowLeft, Server, Code2, Bot, Network, Settings, Activity, Lock, Plug, Wrench, LucideIcon } from 'lucide-react';
import { ServiceWithPlans, ServicePlan } from '@/lib/services-data';
import Link from 'next/link';

// Icon mapping - maps icon names from JSON to actual icon components
const iconMap: Record<string, LucideIcon> = {
  Server,
  Code2,
  ShoppingCart,
  Bot,
  Network,
  Settings,
  Activity,
  Lock,
  Plug,
  Wrench,
};

interface ServiceDetailProps {
  service: ServiceWithPlans;
}

export default function ServiceDetail({ service }: ServiceDetailProps) {
  const Icon = iconMap[service.icon] || Settings;
  const colorClass = service.color === 'blue'
    ? 'from-blue-600 to-blue-700'
    : 'from-cyan-600 to-cyan-700';

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        {/* Back Button */}
        <Link
          href="/services"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-8"
        >
          <ArrowLeft size={18} />
          Back to Services
        </Link>

        {/* Service Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12">
          <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
            <div className={`w-20 h-20 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon className="text-white" size={40} />
            </div>
            <div className="flex-1">
              <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                {service.category}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {service.title}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                {service.description}
              </p>
              
              {/* Features List */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Key Features:</h3>
                <ul className="grid md:grid-cols-2 gap-2">
                  {service.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Service Plans */}
        <div className="mb-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Service <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Plans</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that best fits your needs. All plans include professional service delivery.
            </p>
          </div>

          <PlansGrid plans={service.plans} serviceName={service.title} />
        </div>
      </div>
    </section>
  );
}

function PlansGrid({ plans, serviceName }: { plans: ServicePlan[]; serviceName: string }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} serviceName={serviceName} />
      ))}
    </div>
  );
}

function PlanCard({ plan, serviceName }: { plan: ServicePlan; serviceName: string }) {
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
        href={`/contact?service=${encodeURIComponent(serviceName)}&plan=${encodeURIComponent(plan.name)}`}
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

