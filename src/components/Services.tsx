import { Server, Code2, ShoppingCart, Bot, Network, Settings, Activity, Lock, Plug, Wrench } from 'lucide-react';

const services = [
  {
    icon: Server,
    title: 'Unmanaged VPS Setup & Optimization',
    short: 'Complete server provisioning, security hardening, and performance optimization for production environments.',
    color: 'blue',
  },
  {
    icon: Code2,
    title: 'Laravel & CodeIgniter Installation',
    short: 'Professional PHP framework setup with database configuration, environment optimization, and deployment automation.',
    color: 'cyan',
  },
  {
    icon: ShoppingCart,
    title: 'CodeCanyon Script Installation',
    short: 'Professional installation and custom modification of CodeCanyon scripts tailored to your business needs.',
    color: 'blue',
  },
  {
    icon: Bot,
    title: 'AI Agent & Chatbot Development',
    short: 'Custom AI agents and intelligent chatbots powered by NLP and machine learning for customer engagement and automation.',
    color: 'cyan',
  },
  {
    icon: Network,
    title: 'Microservice Architecture',
    short: 'Modern microservice-based backend systems using Node.js and PHP for scalable applications.',
    color: 'blue',
  },
  {
    icon: Settings,
    title: 'Server-Side Script Setup',
    short: 'Installation and configuration of any server-side technology stack tailored to your application requirements.',
    color: 'cyan',
  },
  {
    icon: Activity,
    title: 'Server Management & Monitoring',
    short: 'Ongoing server maintenance, security updates, performance monitoring, and incident response.',
    color: 'blue',
  },
  {
    icon: Lock,
    title: 'SSL/TLS Certificate Management',
    short: 'Secure HTTPS implementation with automated SSL certificate management and renewal workflows.',
    color: 'cyan',
  },
  {
    icon: Plug,
    title: 'Third-Party API Integration',
    short: 'Seamless integration of payment gateways, SaaS platforms, and external services into your applications.',
    color: 'blue',
  },
  {
    icon: Wrench,
    title: 'Custom Software Development',
    short: 'Professional customization of existing applications and development of bespoke software solutions.',
    color: 'cyan',
  },
];

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
          {services.map((service, index) => {
            const Icon = service.icon;
            const colorClass = service.color === 'blue'
              ? 'from-blue-600 to-blue-700'
              : 'from-cyan-600 to-cyan-700';

            return (
              <div
                key={index}
                className="bg-white p-8 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">{service.short}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-lg hover:shadow-xl transition-all hover:scale-105 font-semibold text-lg"
          >
            Discuss Your Project
          </a>
        </div>
      </div>
    </section>
  );
}
