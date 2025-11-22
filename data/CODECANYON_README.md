# CodeCanyon Scripts Data Management

This file contains JSON data for CodeCanyon scripts and installation plans.

## File Structure

The JSON file (`codecanyon-scripts.json`) contains:
- `scripts`: Array of CodeCanyon scripts
- `defaultPlans`: Default installation plans (Basic, Standard, Advanced)

## Adding a New Script

Edit `/data/codecanyon-scripts.json` and add a new object to the `scripts` array:

```json
{
  "id": "unique-script-id",
  "name": "Script Name",
  "category": "Category Name",
  "shortDescription": "Brief description for list view",
  "description": "Full detailed description for detail page",
  "codecanyonUrl": "https://codecanyon.net/item/your-script",
  "imageUrl": "",
  "useDefaultPlans": true
}
```

### Fields Explanation

- **id**: Unique identifier (use kebab-case, e.g., `laravel-marketplace`)
- **name**: Display name of the script
- **category**: Category name (e.g., "E-Commerce", "WordPress", "SaaS")
- **shortDescription**: Brief description shown in the list view
- **description**: Full description shown on the detail page
- **codecanyonUrl**: Link to the script on CodeCanyon (optional)
- **imageUrl**: Image URL for the script (optional, currently not used)
- **useDefaultPlans**: Set to `true` to use default plans, or `false` to define custom plans

### Custom Plans

If you want custom plans for a specific script, set `useDefaultPlans` to `false` and add a `plans` array:

```json
{
  "id": "custom-script",
  "name": "Custom Script",
  "category": "Custom",
  "shortDescription": "Description",
  "description": "Full description",
  "useDefaultPlans": false,
  "plans": [
    {
      "id": "basic",
      "name": "Basic Installation",
      "price": 149,
      "currency": "USD",
      "description": "Custom basic plan",
      "deliveryTime": "24-48 hours",
      "popular": false,
      "features": [
        { "name": "Feature 1", "included": true },
        { "name": "Feature 2", "included": false }
      ]
    }
  ]
}
```

## Default Plans

The default plans are defined in the `defaultPlans` array:
- **Basic**: $99 - Basic installation
- **Standard**: $199 - Most popular with essential features
- **Advanced**: $399 - Complete solution

You can modify these plans in the JSON file, and all scripts using `useDefaultPlans: true` will automatically use the updated plans.

## Categories

Current categories:
- E-Commerce
- Job Portal
- WordPress
- SaaS
- Education

Categories are automatically generated from scripts, so add new ones by simply using them in a script's `category` field.

## Page Structure

1. **List Page** (`/services/codecanyon`): Shows all scripts in a grid with:
   - Script name
   - Category badge
   - Short description
   - "View Plans" button
   - "View on CodeCanyon" link (if available)

2. **Detail Page** (`/services/codecanyon/[id]`): Shows full script details with:
   - Full description
   - All installation plans with features
   - Plan pricing and delivery times
   - "Select Plan" buttons that link to contact form

## Updating Plans

### Update Default Plans Globally

Edit the `defaultPlans` array in the JSON file. All scripts using `useDefaultPlans: true` will automatically use the updated plans.

### Update Plans for Specific Script

Set `useDefaultPlans: false` and define custom `plans` array for that script.

## Best Practices

1. **Use descriptive IDs**: Use kebab-case (e.g., `laravel-marketplace`)
2. **Keep descriptions concise**: Short description for list, detailed for detail page
3. **Use real CodeCanyon URLs**: Helps with SEO and user trust
4. **Test plan features**: Ensure all features are clearly defined
5. **Update delivery times**: Keep realistic delivery timeframes

## Example

```json
{
  "id": "laravel-saas-platform",
  "name": "Laravel SaaS Platform",
  "category": "SaaS",
  "shortDescription": "Complete SaaS platform with subscription management",
  "description": "Complete SaaS platform with subscription management, multi-tenancy support, billing integration, user management, and admin dashboard. Perfect for building subscription-based applications.",
  "codecanyonUrl": "https://codecanyon.net/item/laravel-saas-platform/12345678",
  "imageUrl": "",
  "useDefaultPlans": true
}
```

