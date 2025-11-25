# FivedIT API Server

Express.js API server with MySQL database for FivedIT website.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (create `.env` in the `api/` folder):

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fivedit_db
DB_PORT=3306
PORT=3001
JWT_SECRET=change-me
ADMIN_EMAIL=admin@fivedit.com
ADMIN_PASSWORD=ChangeMe123!
```

> `JWT_SECRET` is required for the admin APIs.  
> `ADMIN_EMAIL` / `ADMIN_PASSWORD` control the default admin user created by the seeder.

3. Run database migration:
```bash
npm run migrate
```

4. Seed the database with the default dataset:
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

### Auth
- `POST /api/auth/login` – Admin login, returns JWT

### Public Services
- `GET /api/services` – Get all services (with plans)
- `GET /api/services/:id` – Get service by ID
- `GET /api/services/categories/list` – Get categories (names only)

### Reviews
- `GET /api/reviews` – Filterable reviews list
- `GET /api/reviews/:id` – Review details
- `POST /api/reviews/:id/helpful` – Increment helpful count

### CodeCanyon Scripts
- `GET /api/codecanyon` – Get all scripts
- `GET /api/codecanyon/:id` – Script details
- `GET /api/codecanyon/category/:category` – Filter by category

### Admin-only (JWT required)
- `GET /api/admin/categories` – List categories
- `POST /api/admin/categories` – Create category
- `PUT /api/admin/categories/:id` – Update category
- `DELETE /api/admin/categories/:id` – Delete category
- `GET /api/admin/services` – List services (with plans)
- `POST /api/admin/services` – Create service + plans
- `PUT /api/admin/services/:id` – Update service + plans
- `DELETE /api/admin/services/:id` – Delete service
- `GET /api/admin/codecanyon` – List CodeCanyon scripts
- `POST /api/admin/codecanyon` – Create script
- `PUT /api/admin/codecanyon/:id` – Update script
- `DELETE /api/admin/codecanyon/:id` – Delete script

## Database Schema (key tables)

- `services` - Main services table
- `categories` - Service categories
- `service_plans` - Service pricing plans
- `plan_features` - Features for each plan
- `reviews` - Customer reviews
- `codecanyon_scripts` - CodeCanyon scripts
- `script_plans` - Script pricing plans
- `users` - Authenticated users (admin portal)

