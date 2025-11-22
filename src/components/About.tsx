import { Target, Zap, Shield } from 'lucide-react';

export default function About() {
  return (
    <section id="about" className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            About <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">FivedIT</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              FivedIT is a specialized full-stack software development and DevOps company dedicated to helping startups, SaaS products, and enterprises build robust, scalable digital infrastructure.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              We combine deep technical expertise in microservice architecture with hands-on server management experience to deliver solutions that work—not just in theory, but in production environments handling real-world traffic and complexity.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              From unmanaged VPS setup to AI agent development, from Laravel installations to complete AWS cloud architectures, we've helped dozens of companies transform their technical infrastructure from fragile to resilient.
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-gray-900">Our Approach</h3>
                  <p className="text-gray-700">
                    Understand your business goals, architect the right technical solution, implement it with precision, and ensure it scales as you grow.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-gray-900">Our Mission</h3>
                  <p className="text-gray-700">
                    Transform technical infrastructure from fragile to resilient, empowering businesses to scale without fear.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-gray-900">Our Promise</h3>
                  <p className="text-gray-700">
                    Whether launching your first SaaS or migrating legacy systems, we bring the technical depth and practical experience to get it done right.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
