# FivedIT Website - Next.js

This is a Next.js version of the FivedIT website, converted from React + Vite.

## Getting Started

### Installation

Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build

Build the production version:

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Project Structure

- `app/` - Next.js App Router directory
  - `layout.tsx` - Root layout with metadata and Google Analytics
  - `page.tsx` - Home page
  - `globals.css` - Global styles
- `components/` - React components
  - Client components (with `'use client'`): `Header.tsx`, `Contact.tsx`, `Chat.tsx`
  - Server components: `About.tsx`, `Hero.tsx`, `Services.tsx`, `Technologies.tsx`, `WhyChooseUs.tsx`, `Industries.tsx`, `Footer.tsx`
- `lib/` - Utility libraries
  - `supabase.ts` - Supabase client configuration

## Migration Notes

- Converted from Vite to Next.js 14 with App Router
- Components using hooks (`useState`, `useEffect`, etc.) are marked with `'use client'`
- Environment variables changed from `VITE_*` to `NEXT_PUBLIC_*`
- Google Analytics now uses Next.js `Script` component
- Old `src/` directory can be removed after verification

## Technologies

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Lucide React (icons)

