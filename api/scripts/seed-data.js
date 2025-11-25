const categories = [
  {
    id: 'infrastructure',
    name: 'Infrastructure & DevOps',
    slug: 'infrastructure',
    description: 'Infrastructure management, DevOps automation, and high-availability setups.'
  },
  {
    id: 'development',
    name: 'Custom Development',
    slug: 'development',
    description: 'Custom software development and framework installations.'
  },
  {
    id: 'ai-development',
    name: 'AI Development',
    slug: 'ai-development',
    description: 'AI agent, chatbot, and intelligent automation solutions.'
  },
  {
    id: 'architecture',
    name: 'Architecture',
    slug: 'architecture',
    description: 'Microservice and distributed systems architecture design.'
  },
  {
    id: 'installation',
    name: 'Script Installation',
    slug: 'installation',
    description: 'Professional installation and configuration of third-party scripts.'
  }
];

const services = [
  {
    id: 'vps-setup',
    icon: 'Server',
    title: 'Unmanaged VPS Setup & Optimization',
    short: 'Complete server provisioning, security hardening, and performance optimization.',
    description: 'We configure and optimize your VPS for production workloads including security, monitoring, automation, and deployment tooling.',
    features: [
      'Server provisioning and baseline security',
      'Performance tuning (NGINX/Node.js/PHP)',
      'Automated backups and monitoring',
      'SSL/TLS configuration and renewals'
    ],
    color: 'blue',
    categoryId: 'infrastructure',
    categoryName: 'Infrastructure & DevOps',
    link: '/services/vps-setup',
    plans: [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 149,
        currency: 'USD',
        description: 'Essential VPS setup and configuration.',
        deliveryTime: '48 hours',
        popular: false,
        features: [
          { name: 'Initial server provisioning', included: true },
          { name: 'Firewall + SSH hardening', included: true },
          { name: 'Performance tweaks', included: true },
          { name: 'Monitoring setup', included: false },
          { name: 'Automated backups', included: false }
        ]
      },
      {
        id: 'standard',
        name: 'Standard Plan',
        price: 299,
        currency: 'USD',
        description: 'Full-stack optimization with monitoring and backups.',
        deliveryTime: '3 days',
        popular: true,
        features: [
          { name: 'Everything in Basic', included: true },
          { name: 'Application performance tuning', included: true },
          { name: 'Monitoring & alerting', included: true },
          { name: 'Automated backups', included: true },
          { name: 'SSL/TLS automation', included: true }
        ]
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: 499,
        currency: 'USD',
        description: 'Enterprise-ready infrastructure with failover and scaling.',
        deliveryTime: '5 days',
        popular: false,
        features: [
          { name: 'Everything in Standard', included: true },
          { name: 'Disaster recovery setup', included: true },
          { name: 'Horizontal scaling guidance', included: true },
          { name: 'CI/CD automation', included: true },
          { name: 'Priority support (60 days)', included: true }
        ]
      }
    ]
  },
  {
    id: 'laravel-codeigniter',
    icon: 'Code2',
    title: 'Laravel & CodeIgniter Installation',
    short: 'Professional PHP framework setup with optimized environments.',
    description: 'We install Laravel and CodeIgniter apps with best practices for environment configuration, queues, caching, and deployment.',
    features: [
      'Environment configuration and secrets management',
      'Database setup and migrations',
      'Queue/cron configuration',
      'Deployment automation scripts'
    ],
    color: 'cyan',
    categoryId: 'development',
    categoryName: 'Custom Development',
    link: '/services/laravel-codeigniter',
    plans: [
      {
        id: 'basic',
        name: 'Basic Installation',
        price: 199,
        currency: 'USD',
        description: 'Framework installation and environment setup.',
        deliveryTime: '3 days',
        popular: false,
        features: [
          { name: 'Laravel/CodeIgniter installation', included: true },
          { name: 'Database configuration', included: true },
          { name: 'Environment (.env) setup', included: true },
          { name: 'Queue/crons', included: false }
        ]
      },
      {
        id: 'standard',
        name: 'Standard Installation',
        price: 349,
        currency: 'USD',
        description: 'Includes queues, caching, and deployment scripts.',
        deliveryTime: '4 days',
        popular: true,
        features: [
          { name: 'Everything in Basic', included: true },
          { name: 'Queue and cron setup', included: true },
          { name: 'Caching/session tuning', included: true },
          { name: 'Deployment scripts', included: true }
        ]
      },
      {
        id: 'premium',
        name: 'Premium Installation',
        price: 549,
        currency: 'USD',
        description: 'Full production hardening and CI/CD automation.',
        deliveryTime: '6 days',
        popular: false,
        features: [
          { name: 'Everything in Standard', included: true },
          { name: 'CI/CD pipeline configuration', included: true },
          { name: 'Advanced security hardening', included: true },
          { name: '30-day priority support', included: true }
        ]
      }
    ]
  },
  {
    id: 'ai-chatbot',
    icon: 'Bot',
    title: 'AI Agent & Chatbot Development',
    short: 'Conversational AI agents for support, sales, and automation.',
    description: 'We build AI chatbots that connect to your stack, handle context, and automate workflows using cutting-edge NLP.',
    features: [
      'Custom conversation flows',
      'Integrations with Slack/WhatsApp/Web',
      'Knowledge-base ingestion',
      'Analytics and improvement loops'
    ],
    color: 'cyan',
    categoryId: 'ai-development',
    categoryName: 'AI Development',
    link: '/services/ai-chatbot',
    plans: [
      {
        id: 'basic',
        name: 'Starter Bot',
        price: 399,
        currency: 'USD',
        description: 'Single-channel bot with custom intents.',
        deliveryTime: '5 days',
        popular: false,
        features: [
          { name: 'Single channel deployment', included: true },
          { name: 'Up to 10 intents', included: true },
          { name: 'Basic analytics', included: true },
          { name: 'Integration hooks', included: false }
        ]
      },
      {
        id: 'standard',
        name: 'Business Bot',
        price: 699,
        currency: 'USD',
        description: 'Multi-channel automation with integrations.',
        deliveryTime: '7 days',
        popular: true,
        features: [
          { name: 'Everything in Starter', included: true },
          { name: 'Multi-channel support', included: true },
          { name: 'Custom integrations', included: true },
          { name: 'Automated training', included: true }
        ]
      },
      {
        id: 'premium',
        name: 'Enterprise Bot',
        price: 1099,
        currency: 'USD',
        description: 'Advanced AI agent with knowledge base ingestion.',
        deliveryTime: '10 days',
        popular: false,
        features: [
          { name: 'Everything in Business', included: true },
          { name: 'Knowledge base ingestion', included: true },
          { name: 'Human-handoff workflows', included: true },
          { name: 'Analytics & improvement playbooks', included: true }
        ]
      }
    ]
  },
  {
    id: 'microservices',
    icon: 'Network',
    title: 'Microservice Architecture',
    short: 'Design and implementation for distributed systems and APIs.',
    description: 'We architect microservice platforms with service discovery, observability, and deployment automation.',
    features: [
      'Service discovery and API gateway',
      'Containerization (Docker/Kubernetes)',
      'Centralized logging and monitoring',
      'CI/CD pipelines per service'
    ],
    color: 'blue',
    categoryId: 'architecture',
    categoryName: 'Architecture',
    link: '/services/microservices',
    plans: [
      {
        id: 'basic',
        name: 'Blueprint',
        price: 799,
        currency: 'USD',
        description: 'Architecture design and roadmap.',
        deliveryTime: '1 week',
        popular: false,
        features: [
          { name: 'Microservice blueprint', included: true },
          { name: 'Tech stack selection', included: true },
          { name: 'Deployment plan', included: true }
        ]
      },
      {
        id: 'standard',
        name: 'Implementation',
        price: 1499,
        currency: 'USD',
        description: 'Reference implementation with CI/CD.',
        deliveryTime: '2 weeks',
        popular: true,
        features: [
          { name: 'Everything in Blueprint', included: true },
          { name: 'Service templates', included: true },
          { name: 'CI/CD pipelines', included: true },
          { name: 'Monitoring stack', included: true }
        ]
      },
      {
        id: 'premium',
        name: 'Scale Up',
        price: 2499,
        currency: 'USD',
        description: 'Full rollout with observability and onboarding.',
        deliveryTime: '3 weeks',
        popular: false,
        features: [
          { name: 'Everything in Implementation', included: true },
          { name: 'Observability dashboards', included: true },
          { name: 'Developer onboarding docs', included: true },
          { name: 'Coaching & support (30 days)', included: true }
        ]
      }
    ]
  },
  {
    id: 'codecanyon-installation',
    icon: 'Package',
    title: 'CodeCanyon Script Installation',
    short: 'Professional installation and configuration of any CodeCanyon script.',
    description: 'We install and configure CodeCanyon scripts with proper database setup, server configuration, payment gateway integration, and customization. Get your script running quickly with expert setup.',
    features: [
      'Script upload and installation',
      'Database configuration and migration',
      'Server environment setup',
      'Payment gateway integration (Stripe, PayPal)',
      'Email/SMTP configuration',
      'Basic customization and branding',
      'Security hardening and SSL setup',
      'Performance optimization'
    ],
    color: 'blue',
    categoryId: 'installation',
    categoryName: 'Script Installation',
    link: '/services/codecanyon-installation',
    plans: [
      {
        id: 'basic',
        name: 'Basic Installation',
        price: 99,
        currency: 'USD',
        description: 'Script installation and essential configuration.',
        deliveryTime: '2-3 days',
        popular: false,
        features: [
          { name: 'Script upload and installation', included: true },
          { name: 'Database setup and configuration', included: true },
          { name: 'Basic environment configuration', included: true },
          { name: 'Admin panel access setup', included: true },
          { name: 'Payment gateway setup', included: false },
          { name: 'Email/SMTP configuration', included: false },
          { name: 'Customization', included: false }
        ]
      },
      {
        id: 'standard',
        name: 'Standard Installation',
        price: 199,
        currency: 'USD',
        description: 'Complete setup with payment gateways and email configuration.',
        deliveryTime: '3-4 days',
        popular: true,
        features: [
          { name: 'Everything in Basic', included: true },
          { name: 'Payment gateway integration (Stripe/PayPal)', included: true },
          { name: 'Email/SMTP configuration', included: true },
          { name: 'Basic theme customization', included: true },
          { name: 'Logo and branding updates', included: true },
          { name: 'Security hardening', included: false },
          { name: 'Performance optimization', included: false }
        ]
      },
      {
        id: 'premium',
        name: 'Premium Installation',
        price: 399,
        currency: 'USD',
        description: 'Full installation with optimization, security, and customization.',
        deliveryTime: '5-7 days',
        popular: false,
        features: [
          { name: 'Everything in Standard', included: true },
          { name: 'Advanced security hardening', included: true },
          { name: 'SSL/HTTPS setup and configuration', included: true },
          { name: 'Performance optimization', included: true },
          { name: 'Advanced customization', included: true },
          { name: 'Mobile responsiveness check', included: true },
          { name: '30-day priority support', included: true }
        ]
      }
    ]
  },
];

const scripts = [
  {
    id: 'laravel-script-1',
    name: 'Laravel Multi-Vendor Marketplace',
    category: 'E-Commerce',
    shortDescription: 'Complete multi-vendor marketplace solution built with Laravel.',
    description: 'Launch a fully featured marketplace with vendor onboarding, catalogs, checkout, and analytics.',
    codecanyonUrl: 'https://codecanyon.net/item/example',
    imageUrl: '',
    useDefaultPlans: false,
    plans: [
      {
        id: 'basic',
        name: 'Basic Installation',
        price: 120,
        currency: 'USD',
        description: 'Script installation and environment setup.',
        deliveryTime: '2 days',
        popular: false,
        features: [
          { name: 'Script upload and install', included: true },
          { name: 'Database configuration', included: true },
          { name: 'Email setup', included: false }
        ]
      },
      {
        id: 'standard',
        name: 'Standard Installation',
        price: 249,
        currency: 'USD',
        description: 'Payment gateways, emails, and essential customizations.',
        deliveryTime: '3 days',
        popular: true,
        features: [
          { name: 'Everything in Basic', included: true },
          { name: 'Stripe + PayPal setup', included: true },
          { name: 'Basic theme tweaks', included: true }
        ]
      },
      {
        id: 'advanced',
        name: 'Advanced Installation',
        price: 449,
        currency: 'USD',
        description: 'Advanced customization and optimization.',
        deliveryTime: '5 days',
        popular: false,
        features: [
          { name: 'Everything in Standard', included: true },
          { name: 'Performance optimization', included: true },
          { name: 'Security hardening + SSL', included: true }
        ]
      }
    ]
  },
  {
    id: 'php-script-1',
    name: 'PHP Job Portal Script',
    category: 'Job Portal',
    shortDescription: 'Professional job portal with employer and candidate management.',
    description: 'Launch a hiring portal with CV uploads, employer dashboards, and candidate search.',
    codecanyonUrl: 'https://codecanyon.net/item/example',
    imageUrl: '',
    useDefaultPlans: false,
    plans: [
      {
        id: 'basic',
        name: 'Basic Install',
        price: 100,
        currency: 'USD',
        description: 'Installation and configuration.',
        deliveryTime: '2 days',
        popular: false,
        features: [
          { name: 'Script installation', included: true },
          { name: 'Database setup', included: true }
        ]
      },
      {
        id: 'standard',
        name: 'Standard Install',
        price: 220,
        currency: 'USD',
        description: 'Includes branding and email setup.',
        deliveryTime: '3 days',
        popular: true,
        features: [
          { name: 'Everything in Basic', included: true },
          { name: 'Email/SMTP configuration', included: true },
          { name: 'Basic branding updates', included: true }
        ]
      }
    ]
  }
];

const reviews = [
  {
    reviewerName: 'khalifwanzo',
    reviewerInitial: 'K',
    location: 'United States',
    countryCode: 'US',
    isRepeatClient: true,
    rating: 5,
    timePosted: '6 months ago',
    reviewText: 'Great work as always!',
    priceRange: '$100-$200',
    duration: '1 day'
  },
  {
    reviewerName: 'tomliebson',
    reviewerInitial: 'T',
    location: 'Germany',
    countryCode: 'DE',
    isRepeatClient: false,
    rating: 5,
    timePosted: '1 year ago',
    reviewText: 'Solved fast the bug. Thanks for your good work. 🎉',
    priceRange: 'Up to $50',
    duration: '1 day'
  },
  {
    reviewerName: 'hackhack501',
    reviewerInitial: 'H',
    location: 'Morocco',
    countryCode: 'MA',
    isRepeatClient: false,
    rating: 5,
    timePosted: '7 hours ago',
    reviewText: 'Identified the issue quickly and delivered a stable fix. Highly recommended.',
    priceRange: '$50-$100',
    duration: '3 days'
  },
  {
    reviewerName: 'boomcarding',
    reviewerInitial: 'B',
    location: 'United States',
    countryCode: 'US',
    isRepeatClient: false,
    rating: 5,
    timePosted: '1 year ago',
    reviewText: 'Excellent work, very responsive and thorough.',
    priceRange: 'Up to $50',
    duration: '1 week'
  },
  {
    reviewerName: 'user86050731',
    reviewerInitial: 'U',
    location: 'Seychelles',
    countryCode: 'SC',
    isRepeatClient: true,
    rating: 5,
    timePosted: '1 year ago',
    reviewText: 'Professional delivery with outstanding patience and support.',
    priceRange: '$50-$100',
    duration: '2 days'
  }
];

const adminUser = {
  name: 'Site Admin',
  email: process.env.ADMIN_EMAIL || 'admin@fivedit.com',
  password: process.env.ADMIN_PASSWORD || 'ChangeMe123!'
};

module.exports = {
  categories,
  services,
  scripts,
  reviews,
  adminUser
};


