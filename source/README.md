# MSK Hacks Physiotherapy website

React + Vite + Tailwind site with online booking for MSK Hacks Physiotherapy (Carletonville).

- **Going live / staff logins:** see `SETUP.md`.
- **Database:** `supabase/schema.sql` (tables, row-level security, booking functions).
- **Settings:** `public/config.js` (Supabase URL + anon key). Empty = demo mode (browser-only sample data).
- **Practice details, services, hours:** `src/data/mockData.ts`.
- **Data layer:** `src/lib/backend.ts` (Supabase in live mode, localStorage in demo mode).

```bash
npm install --legacy-peer-deps
npm run dev        # local development
npm run build      # production build in dist/ (upload dist/ to Netlify)
npm run build:demo # single-file demo build
```
