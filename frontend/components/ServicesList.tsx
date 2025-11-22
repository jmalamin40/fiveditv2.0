'use client'

import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, Check } from 'lucide-react';
import { allServices, Service, getAllCategories } from '@/lib/services-data';
import Link from 'next/link';

export default function ServicesList() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedService, setExpandedService] = useState<string | null>(null);
  
  const categories = ['All', ...getAllCategories()];
  const filteredServices = selectedCategory === 'All' 
    ? allServices 
    : allServices.filter(s => s.category === selectedCategory);

  const toggleService = (serviceId: string) => {
    setExpandedService(expandedService === serviceId ? null : serviceId);
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900">
            Our <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Services</span>
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive technical solutions from infrastructure to deployment, tailored to your business needs.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setExpandedService(null);
              }}
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

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isExpanded={expandedService === service.id}
              onToggle={() => toggleService(service.id)}
            />
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-white rounded-2xl p-8 md:p-12 shadow-lg">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Let&apos;s discuss your project and find the perfect solution for your needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-lg hover:shadow-xl transition-all hover:scale-105 font-semibold text-lg"
            >
              Get a Free Consultation
              <ArrowRight size={20} />
            </a>
            <a
              href="tel:+1234567890"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-50 transition-all border-2 border-blue-600 font-semibold text-lg"
            >
              Call Us Now
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ 
  service, 
  isExpanded, 
  onToggle 
}: { 
  service: Service; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const Icon = service.icon;
  const colorClass = service.color === 'blue'
    ? 'from-blue-600 to-blue-700'
    : 'from-cyan-600 to-cyan-700';

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden">
      <div className="p-6">
        <div className={`w-14 h-14 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center mb-4`}>
          <Icon className="text-white" size={28} />
        </div>
        
        <h3 className="text-xl font-bold mb-3 text-gray-900">{service.title}</h3>
        <p className="text-gray-600 leading-relaxed mb-4">{service.short}</p>

        {service.category && (
          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
            {service.category}
          </span>
        )}

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-in slide-in-from-top-2">
            <p className="text-gray-700 mb-4 leading-relaxed">{service.description}</p>
            
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-3">Key Features:</h4>
              <ul className="space-y-2">
                {service.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {service.link && (
              <Link
                href={service.link}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm mb-4"
              >
                View Details & Pricing
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="w-full mt-4 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {isExpanded ? (
            <>
              Show Less
              <ChevronUp size={16} />
            </>
          ) : (
            <>
              Learn More
              <ChevronDown size={16} />
            </>
          )}
        </button>

        {/* Quick Contact Button */}
        <a
          href={`#contact?service=${encodeURIComponent(service.title)}`}
          className="block w-full mt-3 text-center bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all hover:scale-105 font-semibold text-sm"
        >
          Get Quote
        </a>
      </div>
    </div>
  );
}

