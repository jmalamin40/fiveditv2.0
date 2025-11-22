// CodeCanyon Script Installation Service Plans
// This file manages all CodeCanyon scripts and their installation plans

export interface PlanFeature {
  name: string;
  included: boolean;
}

export interface InstallationPlan {
  id: 'basic' | 'standard' | 'advanced';
  name: string;
  price: number;
  currency?: string;
  description: string;
  features: PlanFeature[];
  deliveryTime: string;
  popular?: boolean;
}

export interface CodeCanyonScript {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  codecanyonUrl?: string;
  plans: InstallationPlan[];
}

// Default plan structure that can be applied to any script
export const defaultPlans: InstallationPlan[] = [
  {
    id: 'basic',
    name: 'Basic Installation',
    price: 99,
    currency: 'USD',
    description: 'Perfect for getting started quickly',
    deliveryTime: '24-48 hours',
    features: [
      { name: 'Script installation on your server', included: true },
      { name: 'Database configuration', included: true },
      { name: 'Basic server requirements check', included: true },
      { name: 'Initial setup and configuration', included: true },
      { name: 'Email configuration', included: false },
      { name: 'Payment gateway setup', included: false },
      { name: 'Custom modifications', included: false },
      { name: 'Theme customization', included: false },
      { name: 'Plugin installation', included: false },
      { name: 'Performance optimization', included: false },
      { name: 'Security hardening', included: false },
      { name: '30 days support', included: false },
    ],
  },
  {
    id: 'standard',
    name: 'Standard Installation',
    price: 199,
    currency: 'USD',
    description: 'Most popular choice with essential features',
    deliveryTime: '48-72 hours',
    popular: true,
    features: [
      { name: 'Everything in Basic', included: true },
      { name: 'Email configuration (SMTP/SendGrid)', included: true },
      { name: 'Payment gateway setup (Stripe/PayPal)', included: true },
      { name: 'Basic theme customization', included: true },
      { name: 'Essential plugin installation', included: true },
      { name: 'SEO basic configuration', included: true },
      { name: 'Custom modifications', included: false },
      { name: 'Advanced theme customization', included: false },
      { name: 'Performance optimization', included: false },
      { name: 'Security hardening', included: false },
      { name: '30 days support', included: true },
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced Installation',
    price: 399,
    currency: 'USD',
    description: 'Complete solution with all features',
    deliveryTime: '72-96 hours',
    features: [
      { name: 'Everything in Standard', included: true },
      { name: 'Custom modifications (up to 5 hours)', included: true },
      { name: 'Advanced theme customization', included: true },
      { name: 'Performance optimization', included: true },
      { name: 'Security hardening & SSL setup', included: true },
      { name: 'CDN configuration', included: true },
      { name: 'Backup system setup', included: true },
      { name: 'Advanced SEO configuration', included: true },
      { name: 'Analytics integration', included: true },
      { name: '60 days support', included: true },
      { name: 'Priority support', included: true },
    ],
  },
];

// Example CodeCanyon scripts - you can add more here
export const codecanyonScripts: CodeCanyonScript[] = [
  {
    id: 'laravel-script-1',
    name: 'Laravel Multi-Vendor Marketplace',
    category: 'E-Commerce',
    description: 'Complete multi-vendor marketplace solution built with Laravel',
    codecanyonUrl: 'https://codecanyon.net/item/example',
    plans: defaultPlans,
  },
  {
    id: 'php-script-1',
    name: 'PHP Job Portal Script',
    category: 'Job Portal',
    description: 'Professional job portal with employer and candidate management',
    codecanyonUrl: 'https://codecanyon.net/item/example',
    plans: defaultPlans,
  },
  {
    id: 'wordpress-theme-1',
    name: 'WordPress Business Theme',
    category: 'WordPress',
    description: 'Modern WordPress theme for business websites',
    codecanyonUrl: 'https://codecanyon.net/item/example',
    plans: defaultPlans,
  },
];

// Helper function to get a script by ID
export function getScriptById(id: string): CodeCanyonScript | undefined {
  return codecanyonScripts.find(script => script.id === id);
}

// Helper function to get all scripts
export function getAllScripts(): CodeCanyonScript[] {
  return codecanyonScripts;
}

// Helper function to get scripts by category
export function getScriptsByCategory(category: string): CodeCanyonScript[] {
  return codecanyonScripts.filter(script => script.category === category);
}

