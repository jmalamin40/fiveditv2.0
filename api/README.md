# FivedIT API Server

Express.js API server with MySQL database for FivedIT website.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Run database migration:
```bash
npm run migrate
```

4. Seed the database with JSON data:
```bash
npm run seed
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `GET /api/services/categories/list` - Get all categories

### Reviews
- `GET /api/reviews` - Get all reviews (with filters: rating, repeatClient, search, page, limit)
- `GET /api/reviews/:id` - Get review by ID
- `POST /api/reviews/:id/helpful` - Increment helpful count

### CodeCanyon Scripts
- `GET /api/codecanyon` - Get all scripts
- `GET /api/codecanyon/:id` - Get script by ID
- `GET /api/codecanyon/category/:category` - Get scripts by category

## Database Schema

- `services` - Main services table
- `service_plans` - Service pricing plans
- `plan_features` - Features for each plan
- `reviews` - Customer reviews
- `codecanyon_scripts` - CodeCanyon scripts
- `script_plans` - Script pricing plans

