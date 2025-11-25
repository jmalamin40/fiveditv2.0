# CodeCanyon Script Installation Service - Mapping Guide

This document explains how the CodeCanyon Script Installation service is mapped in the system.

## Service Details

**Service ID:** `codecanyon-installation`  
**Service Name:** CodeCanyon Script Installation  
**Category:** Script Installation (`installation`)  
**Icon:** Package (Lucide React)  
**Link:** `/services/codecanyon-installation`

## Database Mapping

### Services Table
```sql
INSERT INTO services (
  id,                    -- 'codecanyon-installation'
  icon,                   -- 'Package'
  title,                  -- 'CodeCanyon Script Installation'
  short,                  -- 'Professional installation...'
  description,            -- Full description
  features,               -- JSON array of features
  color,                  -- 'blue'
  category,               -- 'Script Installation'
  category_id,            -- 'installation'
  link                    -- '/services/codecanyon-installation'
)
```

### Service Plans Table
Three plans are created:

1. **Basic Installation** (`plan_id: 'basic'`)
   - Price: $99
   - Delivery: 2-3 days
   - Features: Script upload, database setup, environment config, admin panel

2. **Standard Installation** (`plan_id: 'standard'`)
   - Price: $199 (Most Popular)
   - Delivery: 3-4 days
   - Features: Everything in Basic + Payment gateways, Email/SMTP, branding

3. **Premium Installation** (`plan_id: 'premium'`)
   - Price: $399
   - Delivery: 5-7 days
   - Features: Everything in Standard + Security, SSL, optimization, support

### Plan Features Table
Each plan has features stored in `plan_features` with `plan_type = 'service'`.

## Frontend Mapping

### Service List (`/services`)
- Service appears in the services list with Package icon
- Links to `/services/codecanyon-installation`

### Service Detail Page (`/services/codecanyon-installation`)
- Route: `/app/services/[id]/page.tsx`
- Component: `ServiceDetail` from `/components/ServiceDetail.tsx`
- Fetches service via: `fetchServiceById('codecanyon-installation')`
- Displays all three installation plans with features

### API Endpoint
- **GET** `/api/services/codecanyon-installation`
- Returns service with plans and features

## Relationship to CodeCanyon Scripts

This service is **separate** from individual CodeCanyon scripts:

1. **CodeCanyon Script Installation Service** (`codecanyon-installation`)
   - General service offering
   - Shows installation plans and pricing
   - Located at: `/services/codecanyon-installation`

2. **Individual CodeCanyon Scripts** (e.g., `laravel-script-1`)
   - Specific script pages
   - Shows script-specific installation plans
   - Located at: `/services/codecanyon/[id]`

### Usage Flow

**Option 1: General Service Page**
- User visits `/services/codecanyon-installation`
- Sees general installation plans
- Can contact for any CodeCanyon script installation

**Option 2: Specific Script Page**
- User visits `/services/codecanyon/laravel-script-1`
- Sees script-specific installation plans
- Can contact for that specific script installation

## Seeding

The service is seeded via `/api/scripts/seed-data.js`:

```javascript
{
  id: 'codecanyon-installation',
  icon: 'Package',
  title: 'CodeCanyon Script Installation',
  categoryId: 'installation',
  plans: [/* Basic, Standard, Premium */]
}
```

To seed:
```bash
cd api
npm run seed
# or
npm run reseed  # to reset and re-seed everything
```

## Icon Mapping

The `Package` icon is added to the icon map in `/components/Services.tsx`:

```typescript
import { Package } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  // ... other icons
  Package,
};
```

## Admin Portal

The service can be managed via the admin portal:
- **View:** See service in services list
- **Edit:** Modify service details, plans, and features
- **Delete:** Remove service (cascades to plans and features)

**Admin Route:** `/admin` → Services tab → Find "CodeCanyon Script Installation"

## Summary

✅ Service added to seeder with 3 installation plans  
✅ Icon (Package) added to icon map  
✅ Category mapped to "Script Installation"  
✅ Dynamic route handles service detail page  
✅ API endpoint returns service with plans and features  
✅ Admin portal can manage the service  

The service is now fully integrated and will appear in:
- Services list on homepage
- Services page (`/services`)
- Service detail page (`/services/codecanyon-installation`)
- Admin portal for management

