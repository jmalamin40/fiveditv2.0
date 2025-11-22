# CodeCanyon Script Management Guide

This guide explains how to manage CodeCanyon scripts and their installation plans.

## File Structure

The CodeCanyon script data is managed in `/lib/codecanyon-scripts.ts`. This file contains:
- Script definitions
- Installation plans (Basic, Standard, Advanced)
- Helper functions

## Adding a New Script

To add a new CodeCanyon script, edit `/lib/codecanyon-scripts.ts` and add to the `codecanyonScripts` array:

```typescript
{
  id: 'unique-script-id',
  name: 'Script Name',
  category: 'Category Name', // e.g., 'E-Commerce', 'WordPress', 'PHP'
  description: 'Brief description of the script',
  codecanyonUrl: 'https://codecanyon.net/item/your-script-url',
  plans: defaultPlans, // Use default plans or create custom ones
}
```

## Customizing Plans

### Using Default Plans

Most scripts can use the `defaultPlans` which include:
- **Basic**: $99 - Basic installation and setup
- **Standard**: $199 - Most popular with essential features
- **Advanced**: $399 - Complete solution with all features

### Creating Custom Plans

For scripts that need different pricing or features, create custom plans:

```typescript
const customPlans: InstallationPlan[] = [
  {
    id: 'basic',
    name: 'Basic Installation',
    price: 149, // Custom price
    currency: 'USD',
    description: 'Custom description',
    deliveryTime: '24-48 hours',
    features: [
      { name: 'Feature 1', included: true },
      { name: 'Feature 2', included: false },
      // ... more features
    ],
  },
  // ... more plans
];
```

Then assign to your script:
```typescript
{
  id: 'my-script',
  name: 'My Script',
  // ...
  plans: customPlans, // Use custom plans instead of defaultPlans
}
```

## Plan Features

Each plan has a `features` array. Features can be:
- **Included** (`included: true`) - Shows with a checkmark
- **Not Included** (`included: false`) - Shows with an X and strikethrough

## Categories

Scripts are organized by categories. Common categories:
- E-Commerce
- Job Portal
- WordPress
- PHP
- Laravel
- SaaS
- Marketplace

The category filter is automatically generated from all scripts.

## Display

Scripts are displayed on `/codecanyon` page with:
- Category filtering
- Plan comparison (Basic, Standard, Advanced)
- Direct links to CodeCanyon
- Contact form integration with pre-filled service details

## Contact Form Integration

When users click "Select Plan", they're redirected to the contact form with:
- Service: "CodeCanyon Installation"
- Plan: Selected plan name
- Script: Script name

This information is automatically pre-filled in the contact form message.

## Helper Functions

- `getScriptById(id)` - Get a specific script by ID
- `getAllScripts()` - Get all scripts
- `getScriptsByCategory(category)` - Filter scripts by category

## Example: Adding a Laravel E-Commerce Script

```typescript
{
  id: 'laravel-ecommerce-pro',
  name: 'Laravel E-Commerce Pro',
  category: 'E-Commerce',
  description: 'Complete e-commerce solution built with Laravel',
  codecanyonUrl: 'https://codecanyon.net/item/laravel-ecommerce-pro/12345678',
  plans: defaultPlans,
}
```

## Updating Prices

To update prices globally, modify the `defaultPlans` array. To update prices for a specific script, create custom plans for that script.

## Best Practices

1. **Use descriptive IDs**: Use kebab-case (e.g., `laravel-marketplace`)
2. **Keep descriptions concise**: 1-2 sentences
3. **Use real CodeCanyon URLs**: Helps with SEO and user trust
4. **Test plan features**: Ensure all features are clearly defined
5. **Update delivery times**: Keep realistic delivery timeframes

