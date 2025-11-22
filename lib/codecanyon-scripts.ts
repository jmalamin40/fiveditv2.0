// CodeCanyon Script Installation Service Plans
// This file loads data from JSON and provides helper functions

import scriptsIndex from '@/data/codecanyon/scripts-index.json';

// Import individual script files
import laravelScript1 from '@/data/codecanyon/scripts/laravel-script-1.json';
import phpScript1 from '@/data/codecanyon/scripts/php-script-1.json';
import wordpressTheme1 from '@/data/codecanyon/scripts/wordpress-theme-1.json';
import laravelSaas1 from '@/data/codecanyon/scripts/laravel-saas-1.json';
import phpLms1 from '@/data/codecanyon/scripts/php-lms-1.json';

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

// Script summary interface (for listing page, without plans)
export interface CodeCanyonScriptSummary {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  codecanyonUrl?: string;
  imageUrl?: string;
}

// Mapping of script IDs to their full data
const scriptDataMap: Record<string, CodeCanyonScript> = {
  'laravel-script-1': laravelScript1 as CodeCanyonScript,
  'php-script-1': phpScript1 as CodeCanyonScript,
  'wordpress-theme-1': wordpressTheme1 as CodeCanyonScript,
  'laravel-saas-1': laravelSaas1 as CodeCanyonScript,
  'php-lms-1': phpLms1 as CodeCanyonScript,
};

// Load scripts summary from index (for listing page)
function loadScriptsSummary(): CodeCanyonScriptSummary[] {
  return scriptsIndex.scripts.map((script: any) => ({
    id: script.id,
    name: script.name,
    category: script.category,
    shortDescription: script.shortDescription,
    codecanyonUrl: script.codecanyonUrl,
    imageUrl: script.imageUrl,
  }));
}

// Export scripts summary for listing page (without plans to keep it lightweight)
export const codecanyonScripts: CodeCanyonScriptSummary[] = loadScriptsSummary();

// Helper function to get a script by ID with full details including plans
export function getScriptById(id: string): CodeCanyonScript | undefined {
  return scriptDataMap[id];
}

// Helper function to get all scripts (summary only, for listing)
export function getAllScripts(): CodeCanyonScriptSummary[] {
  return codecanyonScripts;
}

// Helper function to get scripts by category (summary only)
export function getScriptsByCategory(category: string): CodeCanyonScriptSummary[] {
  return codecanyonScripts.filter(script => script.category === category);
}

// Helper function to get all categories
export function getAllCategories(): string[] {
  return Array.from(new Set(codecanyonScripts.map(script => script.category)));
}

