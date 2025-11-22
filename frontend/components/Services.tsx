import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { allServices } from '@/lib/services-data';

export default function Services() {
  return (
    <section id="services" className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Our <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Services</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive technical solutions from infrastructure to deployment, tailored to your business needs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {allServices.slice(0, 6).map((service) => {
            const Icon = service.icon;
            const colorClass = service.color === 'blue'
              ? 'from-blue-600 to-blue-700'
              : 'from-cyan-600 to-cyan-700';

            return (
              <div
                key={service.id}
                className="bg-white p-8 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-4">{service.short}</p>
                {service.link && (
                  <Link
                    href={service.link}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    View Plans & Pricing
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-lg hover:shadow-xl transition-all hover:scale-105 font-semibold text-lg"
          >
            View All Services
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

