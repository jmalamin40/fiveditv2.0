# FivedIT Admin Portal

React (Vite) dashboard for managing categories, services, and CodeCanyon scripts via the new admin API.

## Setup

```bash
cd admin
npm install
```

Create a `.env` file (or `.env.local`) with the API URL:

```
VITE_API_BASE_URL=http://localhost:3001/api
```

## Development

```bash
npm run dev
```

The dev server runs on <http://localhost:5174>. Make sure the API is running and seeded (default admin user is `admin@fivedit.com / ChangeMe123!` unless overridden via env vars).

## Build

```bash
npm run build
```

Outputs static assets to `dist/`, ready for deployment behind any static host.


