import { Server, Code2, ShoppingCart, Bot, Network, Settings, Activity, Lock, Plug, Wrench, LucideIcon } from 'lucide-react';
import servicesData from '@/data/services.json';

// Import individual service files (excluding codecanyon-installation)
import vpsSetup from '@/data/services/vps-setup.json';
import laravelCodeigniter from '@/data/services/laravel-codeigniter.json';
import aiChatbot from '@/data/services/ai-chatbot.json';
import microservices from '@/data/services/microservices.json';
import serverScriptSetup from '@/data/services/server-script-setup.json';
import serverManagement from '@/data/services/server-management.json';
import sslManagement from '@/data/services/ssl-management.json';
import apiIntegration from '@/data/services/api-integration.json';
import customDevelopment from '@/data/services/custom-development.json';

// Icon mapping - maps icon names from JSON to actual icon components
const iconMap: Record<string, LucideIcon> = {
  Server,
  Code2,
  ShoppingCart,
  Bot,
  Network,
  Settings,
  Activity,
  Lock,
  Plug,
  Wrench,
};

// Plan feature interface
export interface PlanFeature {
  name: string;
  included: boolean;
}

// Service plan interface
export interface ServicePlan {
  id: 'basic' | 'standard' | 'premium';
  name: string;
  price: number;
  currency?: string;
  description: string;
  features: PlanFeature[];
  deliveryTime: string;
  popular?: boolean;
}

// JSON Service interface (what comes from JSON)
interface JsonService {
  id: string;
  icon: string;
  title: string;
  short: string;
  description: string;
  features: string[];
  color: 'blue' | 'cyan';
  link?: string;
  category?: string;
}

// Service interface with icon component (for listing)
export interface Service {
  id: string;
  icon: LucideIcon;
  title: string;
  short: string;
  description: string;
  features: string[];
  color: 'blue' | 'cyan';
  link?: string;
  category?: string;
}

// Service with plans interface (for detail pages)
// Note: icon is stored as string name, not component, to avoid passing functions to client components
export interface ServiceWithPlans {
  id: string;
  icon: string; // Icon name as string, not component
  title: string;
  short: string;
  description: string;
  features: string[];
  color: 'blue' | 'cyan';
  link?: string;
  category?: string;
  plans: ServicePlan[];
}

// Mapping of service IDs to their full data with plans
const serviceDataMap: Record<string, any> = {
  'vps-setup': vpsSetup,
  'laravel-codeigniter': laravelCodeigniter,
  'ai-chatbot': aiChatbot,
  'microservices': microservices,
  'server-script-setup': serverScriptSetup,
  'server-management': serverManagement,
  'ssl-management': sslManagement,
  'api-integration': apiIntegration,
  'custom-development': customDevelopment,
};

// Load services from JSON and map icons
function loadServicesFromJson(): Service[] {
  const jsonServices = servicesData.services as JsonService[];
  
  return jsonServices.map((jsonService) => {
    const IconComponent = iconMap[jsonService.icon];
    
    if (!IconComponent) {
      console.warn(`Icon "${jsonService.icon}" not found in iconMap. Using Settings as fallback.`);
    }
    
    return {
      ...jsonService,
      icon: IconComponent || Settings,
    };
  });
}

// Export services loaded from JSON (for listing)
export const allServices: Service[] = loadServicesFromJson();

// Helper function to get service by ID with plans
export function getServiceWithPlansById(id: string): ServiceWithPlans | undefined {
  const serviceData = serviceDataMap[id];
  if (!serviceData) {
    return undefined;
  }
  
  return {
    id: serviceData.id,
    icon: serviceData.icon, // Keep as string name, not component
    title: serviceData.title,
    short: serviceData.short,
    description: serviceData.description,
    features: serviceData.features,
    color: serviceData.color,
    link: serviceData.link,
    category: serviceData.category,
    plans: serviceData.plans as ServicePlan[],
  };
}

// Helper functions (existing - for backward compatibility)
export function getServiceById(id: string): Service | undefined {
  return allServices.find(service => service.id === id);
}

export function getServicesByCategory(category: string): Service[] {
  return allServices.filter(service => service.category === category);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(allServices.map(service => service.category).filter(Boolean))) as string[];
}

