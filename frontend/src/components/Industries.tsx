import { Sparkles, Building2, ShoppingBag, Users, Briefcase, BookOpen, CreditCard, GraduationCap } from 'lucide-react';

const industries = [
  {
    icon: Sparkles,
    title: 'Startups & MVP Development',
    description: 'Launch your product fast with scalable architecture that grows with you. Avoid costly technical mistakes while shipping quickly.',
  },
  {
    icon: Building2,
    title: 'SaaS Companies',
    description: 'Build robust multi-tenant platforms with microservice architectures, automated scaling, and enterprise-grade security.',
  },
  {
    icon: ShoppingBag,
    title: 'E-Commerce Platforms',
    description: 'High-performance infrastructure for online stores with payment gateways, inventory management, and peak traffic handling.',
  },
  {
    icon: Users,
    title: 'Digital Agencies',
    description: 'White-label server management and DevOps support for agencies managing multiple client projects.',
  },
  {
    icon: Briefcase,
    title: 'Enterprise Applications',
    description: 'Complex business systems requiring custom integrations, legacy modernization, and compliance-ready infrastructure.',
  },
  {
    icon: BookOpen,
    title: 'Content Platforms & Media',
    description: 'Scalable content delivery with CDN integration, media processing pipelines, and high-availability for traffic spikes.',
  },
  {
    icon: CreditCard,
    title: 'FinTech & Financial Services',
    description: 'Secure, compliant infrastructure with encryption, audit logging, and regulatory adherence.',
  },
  {
    icon: GraduationCap,
    title: 'EdTech & Learning Platforms',
    description: 'Scalable LMS with user management, content delivery, and real-time collaboration features.',
  },
];

export default function Industries() {
  return (
    <section id="industries" className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Industries We <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Serve</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Trusted by startups, SaaS founders, SMBs, and agencies worldwide for expert backend, AI, and server support.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-50 to-blue-50 p-6 rounded-xl hover:shadow-xl transition-all hover:-translate-y-1 border border-blue-100"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">{industry.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{industry.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 md:p-12 border-2 border-blue-100">
          <div className="text-center">
            <h3 className="text-3xl font-bold mb-4 text-gray-900">Your Industry Not Listed?</h3>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
              We work with businesses across all sectors. If you need expert backend development, server management, or AI solutions, we can help.
            </p>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-lg hover:shadow-xl transition-all hover:scale-105 font-semibold"
            >
              Let's Discuss Your Needs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
