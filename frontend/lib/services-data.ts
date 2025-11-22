import { Server, Code2, ShoppingCart, Bot, Network, Settings, Activity, Lock, Plug, Wrench, LucideIcon } from 'lucide-react';
import servicesData from '@/data/services.json';

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

// Service interface with icon component
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

// Export services loaded from JSON
export const allServices: Service[] = loadServicesFromJson();

// Helper functions
export function getServiceById(id: string): Service | undefined {
  return allServices.find(service => service.id === id);
}

export function getServicesByCategory(category: string): Service[] {
  return allServices.filter(service => service.category === category);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(allServices.map(service => service.category).filter(Boolean))) as string[];
}

