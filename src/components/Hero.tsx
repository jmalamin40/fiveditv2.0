import { ArrowRight, Cloud, Code, Cpu } from 'lucide-react';

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Cpu size={16} />
            Full-Stack Development & DevOps Excellence
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent leading-tight">
            Engineering Scalable Solutions, Delivering Seamless Infrastructure
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            We architect microservice-based solutions and enterprise-grade server infrastructure that empower startups and SaaS companies to scale fearlessly.
          </p>

          <p className="text-lg text-gray-700 mb-12 max-w-4xl mx-auto">
            Build, deploy, and scale with confidence. Expert microservice architecture, VPS optimization, and AI agent development for modern businesses.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg hover:scale-105 font-semibold text-lg"
            >
              Get a Free Consultation
              <ArrowRight size={20} />
            </a>
            <a
              href="/services"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-50 transition-all border-2 border-blue-600 font-semibold text-lg"
            >
              View Our Services
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Cloud className="text-blue-600" size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Cloud & DevOps</h3>
              <p className="text-gray-600">AWS, DigitalOcean, Docker, CI/CD pipelines</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Code className="text-cyan-600" size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Microservices</h3>
              <p className="text-gray-600">Node.js, Laravel, scalable architecture</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Cpu className="text-blue-600" size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">AI Development</h3>
              <p className="text-gray-600">AI agents, chatbots, NLP solutions</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
