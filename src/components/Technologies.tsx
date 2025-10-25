import { Code, Cloud, Database, Shield, Boxes, TestTube } from 'lucide-react';

const techCategories = [
  {
    icon: Code,
    title: 'Backend Development',
    items: [
      'Node.js (Express.js, Nest.js)',
      'PHP (Laravel, CodeIgniter)',
      'RESTful APIs & GraphQL',
      'JWT & OAuth 2.0',
      'Microservice Architecture'
    ],
  },
  {
    icon: Cloud,
    title: 'Cloud & DevOps',
    items: [
      'AWS (EC2, Lambda, S3, DynamoDB)',
      'DigitalOcean & Docker',
      'CI/CD Pipelines',
      'Nginx & Apache',
      'Linux Server Administration'
    ],
  },
  {
    icon: Database,
    title: 'Databases',
    items: [
      'MySQL & PostgreSQL',
      'MongoDB & DynamoDB',
      'Redis & Memcached',
      'Query Optimization',
      'Backup Strategies'
    ],
  },
  {
    icon: Shield,
    title: 'Security & Networking',
    items: [
      'Firewall Configuration (UFW)',
      'SSL/TLS Management',
      'Cloudflare & CDN',
      'VPC & WAF',
      'SSH Hardening'
    ],
  },
  {
    icon: Boxes,
    title: 'Message Queues & Search',
    items: [
      'RabbitMQ',
      'OpenSearch & Logstash',
      'Pub/Sub Patterns',
      'Log Aggregation',
      'Full-Text Search'
    ],
  },
  {
    icon: TestTube,
    title: 'AI & Testing',
    items: [
      'NLP & AI Agents',
      'Spam Detection Models',
      'Jest & Mocha/Chai',
      'PHPUnit',
      'Bash Automation'
    ],
  },
];

export default function Technologies() {
  return (
    <section id="technologies" className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Technologies & <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Expertise</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Battle-tested technology stack deployed in real production environments.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {techCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-xl border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-lg"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900">{category.title}</h3>
                <ul className="space-y-2">
                  {category.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h3 className="text-3xl font-bold mb-4">Full-Stack Capabilities</h3>
          <p className="text-xl mb-6 text-blue-50">
            React.js, Next.js, Redux, React Native, and modern frontend technologies
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {['React.js', 'Next.js', 'Redux', 'React Native', 'TypeScript', 'Tailwind CSS'].map((tech) => (
              <span key={tech} className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg font-medium">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
