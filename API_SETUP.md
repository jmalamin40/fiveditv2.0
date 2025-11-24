# API Setup Guide

This guide explains how to set up and use the Express.js API with MySQL database for the FivedIT website.

## Project Structure

```
api/
├── config/
│   └── database.js          # MySQL connection configuration
├── routes/
│   ├── services.js          # Services API endpoints
│   ├── reviews.js           # Reviews API endpoints
│   └── codecanyon.js        # CodeCanyon scripts API endpoints
├── scripts/
│   ├── migrate.js           # Database migration script
│   └── seed.js              # Database seeding script
├── server.js                # Express.js server
├── package.json            # API dependencies
└── .env.example            # Environment variables template
```

## Setup Instructions

### 1. Install API Dependencies

```bash
cd api
npm install
```

### 2. Configure Database

1. Create a `.env` file in the `api` folder:
```bash
cp .env.example .env
```

2. Edit `.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fivedit_db
DB_PORT=3306
PORT=3001
NODE_ENV=development
```

### 3. Run Database Migration

This creates all necessary tables:
```bash
npm run migrate
```

### 4. Seed Database with JSON Data

This imports all data from JSON files into MySQL:
```bash
npm run seed
```

### 5. Start the API Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3001/api`

## API Endpoints

### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID with plans
- `GET /api/services/categories/list` - Get all service categories

### Reviews
- `GET /api/reviews` - Get all reviews
  - Query params: `rating`, `repeatClient`, `search`, `page`, `limit`
- `GET /api/reviews/:id` - Get review by ID
- `POST /api/reviews/:id/helpful` - Increment helpful count

### CodeCanyon Scripts
- `GET /api/codecanyon` - Get all scripts
- `GET /api/codecanyon/:id` - Get script by ID with plans
- `GET /api/codecanyon/category/:category` - Get scripts by category

## Frontend Integration

### 1. Configure API URL

Add to your `.env.local` (or `.env`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

For production, update to your production API URL:
```env
NEXT_PUBLIC_API_URL=https://api.fivedit.com/api
```

### 2. Use API Functions

The frontend now uses API functions from `lib/api.ts`:

```typescript
import { fetchServices, fetchServiceById, fetchReviews } from '@/lib/api';

// Fetch all services
const services = await fetchServices();

// Fetch a specific service
const service = await fetchServiceById('vps-setup');

// Fetch reviews with filters
const { reviews, stats } = await fetchReviews({
  rating: 5,
  page: 1,
  limit: 10
});
```

## Database Schema

### Tables Created:
- `services` - Main services data
- `service_plans` - Service pricing plans
- `plan_features` - Features for each plan
- `reviews` - Customer reviews
- `codecanyon_scripts` - CodeCanyon scripts
- `script_plans` - Script pricing plans

## Deployment

### API Server Deployment

1. Set up MySQL database on your server
2. Configure environment variables
3. Run migration: `npm run migrate`
4. Run seeding: `npm run seed`
5. Start the server (use PM2 or similar):
```bash
pm2 start server.js --name fivedit-api
```

### Next.js Frontend

Update `NEXT_PUBLIC_API_URL` in your production environment to point to your API server.

## Notes

- The API server runs on port 3001 by default
- All data is migrated from JSON files to MySQL
- The frontend components have been updated to use API endpoints
- CORS is enabled for cross-origin requests
- The API includes pagination, filtering, and search capabilities

