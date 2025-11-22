// CodeCanyon Script Installation Service Plans
// This file loads data from JSON and provides helper functions

import codecanyonData from '@/data/codecanyon-scripts.json';

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
  shortDescription: string;
  description: string;
  imageUrl?: string;
  codecanyonUrl?: string;
  plans: InstallationPlan[];
}

// Load default plans from JSON
export const defaultPlans: InstallationPlan[] = codecanyonData.defaultPlans as InstallationPlan[];

// Load scripts from JSON and attach plans
function loadScriptsFromJson(): CodeCanyonScript[] {
  const jsonScripts = codecanyonData.scripts;
  
  return jsonScripts.map((jsonScript: any) => {
    // Use default plans if useDefaultPlans is true, otherwise use custom plans if provided
    const plans = jsonScript.useDefaultPlans 
      ? defaultPlans 
      : (jsonScript.plans || defaultPlans);
    
    return {
      id: jsonScript.id,
      name: jsonScript.name,
      category: jsonScript.category,
      shortDescription: jsonScript.shortDescription,
      description: jsonScript.description,
      imageUrl: jsonScript.imageUrl,
      codecanyonUrl: jsonScript.codecanyonUrl,
      plans: plans,
    };
  });
}

// Export scripts loaded from JSON
export const codecanyonScripts: CodeCanyonScript[] = loadScriptsFromJson();

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

// Helper function to get all categories
export function getAllCategories(): string[] {
  return Array.from(new Set(codecanyonScripts.map(script => script.category)));
}

