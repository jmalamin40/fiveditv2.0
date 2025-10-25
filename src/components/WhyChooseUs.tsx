import { CheckCircle, Rocket, Shield, Zap, MessageCircle, DollarSign, Award } from 'lucide-react';

const reasons = [
  {
    icon: CheckCircle,
    title: 'Production-Tested Expertise',
    description: "We don't just know the technologies—we've deployed them in real production environments handling thousands of users. Our solutions are battle-tested, not theoretical.",
  },
  {
    icon: Rocket,
    title: 'Scalability-First Architecture',
    description: 'Every system we build is designed to scale. From day one, your infrastructure can handle growth without expensive rewrites or migrations.',
  },
  {
    icon: Shield,
    title: 'Proactive Security',
    description: "Security isn't an afterthought. We implement defense-in-depth strategies, automated security updates, and continuous monitoring.",
  },
  {
    icon: Zap,
    title: 'Rapid Response Times',
    description: 'When issues arise, speed matters. Our experienced team diagnoses problems quickly and implements solutions that fix root causes.',
  },
  {
    icon: MessageCircle,
    title: 'Transparent Communication',
    description: "We explain technical decisions in plain language. You'll always understand what we're building and why.",
  },
  {
    icon: DollarSign,
    title: 'Cost-Effective Solutions',
    description: 'We optimize for your budget without compromising quality. Maximum ROI through efficient architectures and smart hosting choices.',
  },
  {
    icon: Award,
    title: 'End-to-End Ownership',
    description: 'From consultation to deployment to maintenance, we own the entire lifecycle. Single point of contact who understands your ecosystem.',
  },
];

export default function WhyChooseUs() {
  return (
    <section id="why-us" className="py-20 px-4 bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-700 text-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Why Choose FivedIT
          </h2>
          <div className="w-24 h-1 bg-white mx-auto mb-8"></div>
          <p className="text-xl text-blue-50 max-w-3xl mx-auto">
            Professional excellence backed by real-world production experience.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm p-8 rounded-xl hover:bg-white/20 transition-all border border-white/20"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">{reason.title}</h3>
                    <p className="text-blue-50 leading-relaxed">{reason.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-white/20">
          <div className="text-center">
            <h3 className="text-3xl font-bold mb-4">Professional Objectivity</h3>
            <p className="text-xl text-blue-50 max-w-3xl mx-auto leading-relaxed">
              We prioritize technical accuracy and truthfulness over validating beliefs. Our focus is on facts and problem-solving, providing direct, objective technical guidance. When needed, we respectfully disagree to ensure you get the best solution for your business.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
