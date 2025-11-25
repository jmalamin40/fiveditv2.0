# CodeCanyon Script Installation - Data Flow & Code Mapping

This document explains how CodeCanyon script installation information flows from the database to the Next.js frontend.

## Data Flow Overview

```
Database (MySQL) → API (Express.js) → Frontend API Client → Next.js Page → React Component
```

## 1. Database Schema

### `codecanyon_scripts` Table
Stores the main script information:
- `id` (VARCHAR) - Unique script identifier (e.g., 'laravel-script-1')
- `name` (VARCHAR) - Script display name
- `category` (VARCHAR) - Category (e.g., 'E-Commerce', 'Job Portal')
- `short_description` (TEXT) - Brief description for list view
- `description` (TEXT) - Full description for detail page
- `codecanyon_url` (VARCHAR) - Link to CodeCanyon listing
- `image_url` (VARCHAR) - Script image URL
- `use_default_plans` (BOOLEAN) - Whether to use default installation plans

### `script_plans` Table
Stores installation plans for each script:
- `id` (INT) - Auto-increment primary key
- `script_id` (VARCHAR) - Foreign key to `codecanyon_scripts.id`
- `plan_id` (VARCHAR) - Plan identifier (e.g., 'basic', 'standard', 'advanced')
- `name` (VARCHAR) - Plan display name (e.g., 'Basic Installation')
- `price` (DECIMAL) - Plan price
- `currency` (VARCHAR) - Currency code (default: 'USD')
- `description` (TEXT) - Plan description
- `delivery_time` (VARCHAR) - Estimated delivery time (e.g., '2 days')
- `popular` (BOOLEAN) - Whether this plan is marked as popular

### `plan_features` Table
Stores features for each installation plan:
- `id` (INT) - Auto-increment primary key
- `plan_id` (INT) - Foreign key to `script_plans.id`
- `plan_type` (ENUM) - Either 'service' or 'script' (for CodeCanyon: 'script')
- `name` (VARCHAR) - Feature name
- `included` (BOOLEAN) - Whether the feature is included

## 2. API Layer (`/api/routes/codecanyon.js`)

### Endpoint: `GET /api/codecanyon/:id`

**Query Flow:**
1. Fetches script from `codecanyon_scripts` table by `id`
2. Fetches all plans from `script_plans` table where `script_id = id`
3. For each plan, fetches features from `plan_features` where `plan_id = plan.id` AND `plan_type = 'script'`
4. Returns combined JSON object

**Response Structure:**
```json
{
  "id": "laravel-script-1",
  "name": "Laravel Multi-Vendor Marketplace",
  "category": "E-Commerce",
  "short_description": "Complete multi-vendor marketplace...",
  "description": "Launch a fully featured marketplace...",
  "codecanyon_url": "https://codecanyon.net/item/example",
  "image_url": "",
  "use_default_plans": false,
  "plans": [
    {
      "id": 1,
      "script_id": "laravel-script-1",
      "plan_id": "basic",
      "name": "Basic Installation",
      "price": "120.00",
      "currency": "USD",
      "description": "Script installation and environment setup.",
      "delivery_time": "2 days",
      "popular": 0,
      "features": [
        {
          "id": 1,
          "plan_id": 1,
          "plan_type": "script",
          "name": "Script upload and install",
          "included": 1
        },
        {
          "id": 2,
          "plan_id": 1,
          "plan_type": "script",
          "name": "Database configuration",
          "included": 1
        }
      ]
    }
  ]
}
```

## 3. Frontend API Client (`/lib/api.ts`)

### Function: `fetchCodeCanyonScriptById(id: string)`

```typescript
export async function fetchCodeCanyonScriptById(id: string): Promise<CodeCanyonScript> {
  const response = await fetch(`${API_BASE_URL}/codecanyon/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch script');
  }
  return response.json();
}
```

**TypeScript Interface:**
```typescript
export interface CodeCanyonScript {
  id: string;
  name: string;
  category: string;
  shortDescription: string;  // Maps from DB: short_description
  description: string;
  codecanyonUrl: string;      // Maps from DB: codecanyon_url
  imageUrl: string;           // Maps from DB: image_url
  plans?: ServicePlan[];      // Array of installation plans
}

export interface ServicePlan {
  id: string;                 // Maps from DB: plan_id (not the auto-increment id)
  name: string;
  price: number;              // Converted from DECIMAL string
  currency: string;
  description: string;
  deliveryTime: string;       // Maps from DB: delivery_time
  popular?: boolean;          // Converted from 0/1 to boolean
  features: PlanFeature[];
}

export interface PlanFeature {
  name: string;
  included: boolean;           // Converted from 0/1 to boolean
}
```

**Note:** The API returns snake_case (e.g., `codecanyon_url`), but the frontend expects camelCase (e.g., `codecanyonUrl`). The mapping happens in the component or needs to be added to the API response transformation.

## 4. Next.js Page (`/app/services/codecanyon/[id]/page.tsx`)

### Server Component Flow:

```typescript
export default async function CodeCanyonScriptPage({ params }: { params: { id: string } }) {
  // 1. Fetch script data from API
  const script = await fetchCodeCanyonScriptById(params.id);
  
  // 2. Pass to client component
  return (
    <CodeCanyonScriptDetail script={script} />
  );
}
```

**Route:** `/services/codecanyon/[id]`
- Example: `/services/codecanyon/laravel-script-1`

## 5. React Component (`/components/CodeCanyonScriptDetail.tsx`)

### Component Structure:

```typescript
export default function CodeCanyonScriptDetail({ script }: CodeCanyonScriptDetailProps) {
  return (
    <section>
      {/* Script Header */}
      <div>
        <h1>{script.name}</h1>
        <p>{script.description}</p>
        <a href={script.codecanyonUrl}>View on CodeCanyon</a>
      </div>
      
      {/* Installation Plans Grid */}
      <PlansGrid plans={script.plans || []} scriptName={script.name} />
    </section>
  );
}
```

### Plan Display (`PlanCard` component):

Each plan shows:
- **Plan Name**: `plan.name` (e.g., "Basic Installation")
- **Price**: `plan.price` formatted as `$${plan.price}`
- **Currency**: `plan.currency` (default: "USD")
- **Description**: `plan.description`
- **Delivery Time**: `plan.deliveryTime` with clock icon
- **Features List**: 
  - ✅ Included features (`feature.included === true`)
  - ❌ Excluded features (`feature.included === false`) - shown with strikethrough
- **Popular Badge**: Shown if `plan.popular === true`
- **CTA Button**: Links to contact form with plan details

### Contact Form Integration:

When user clicks "Select Plan", they're redirected to:
```
/contact?service=CodeCanyon Installation&plan={planName}&script={scriptName}
```

Example:
```
/contact?service=CodeCanyon Installation&plan=Basic Installation&script=Laravel Multi-Vendor Marketplace
```

## 6. Data Transformation Notes

### Database → API Response:
- `popular` (BOOLEAN 0/1) → `popular` (number 0/1) - needs conversion
- `included` (BOOLEAN 0/1) → `included` (number 0/1) - needs conversion
- `price` (DECIMAL) → `price` (string) - needs conversion to number

### API Response → Frontend:
Currently, the API returns snake_case field names, but the frontend expects camelCase. The component should handle this mapping, or the API should transform the response.

**Current API Response:**
```json
{
  "codecanyon_url": "...",
  "short_description": "...",
  "delivery_time": "..."
}
```

**Expected Frontend Format:**
```typescript
{
  codecanyonUrl: "...",
  shortDescription: "...",
  deliveryTime: "..."
}
```

## 7. Seeding Data (`/api/scripts/seed-data.js`)

Scripts are seeded with installation plans:

```javascript
{
  id: 'laravel-script-1',
  name: 'Laravel Multi-Vendor Marketplace',
  category: 'E-Commerce',
  plans: [
    {
      id: 'basic',
      name: 'Basic Installation',
      price: 120,
      features: [
        { name: 'Script upload and install', included: true },
        { name: 'Database configuration', included: true }
      ]
    }
  ]
}
```

## 8. Admin Portal Integration

The admin portal (`/admin`) allows CRUD operations:
- **Create**: Add new scripts with custom installation plans
- **Update**: Modify existing scripts and plans
- **Delete**: Remove scripts (cascades to plans and features)

**API Endpoints:**
- `POST /api/admin/codecanyon` - Create script
- `PUT /api/admin/codecanyon/:id` - Update script
- `DELETE /api/admin/codecanyon/:id` - Delete script

## Summary

The installation information flows as follows:

1. **Database** stores script, plans, and features in separate tables
2. **API** (`/api/codecanyon/:id`) joins the tables and returns JSON
3. **Frontend API client** (`lib/api.ts`) fetches the data
4. **Next.js page** (`app/services/codecanyon/[id]/page.tsx`) renders server-side
5. **React component** (`CodeCanyonScriptDetail.tsx`) displays the installation plans with features

**Key Mapping Points:**
- Database snake_case → Frontend camelCase (needs transformation)
- Boolean 0/1 → JavaScript boolean (needs conversion)
- DECIMAL price → Number (needs parsing)

