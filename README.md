# AgriTrack

Multi-tenant farm management app with **SuperAdmin** and **Farm Admin** interfaces, powered by Supabase and deployable to Netlify.

## Architecture

| Role | Landing page | Capabilities |
|------|-------------|--------------|
| **Super Admin** | `/superadmin` | Manage all farms and users |
| **Farm Admin** | `/app` | Dashboard + manage farm team |
| **Farm User** | `/app` | Dashboard (read-only user management) |

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (Auth, Postgres, Row Level Security, Edge Functions)
- **Deploy:** Netlify

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run `supabase/migrations/001_initial_schema.sql`
3. Deploy the Edge Function for user creation:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy create-user
```

4. Create your first user via **Authentication → Users → Add user** in the Supabase dashboard
5. Promote that user to superadmin (edit email in `supabase/seed.sql` first):

```sql
update public.profiles
set role = 'superadmin', company_id = null
where email = 'you@example.com';
```

### 2. Local development

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase → Settings → API

npm install
npm run dev
```

### 3. Deploy to Netlify

1. Push this repo to GitHub
2. In Netlify: **Add new site → Import from Git**
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

## Project structure

```
src/
  components/     # UI, layouts, auth guards
  contexts/       # AuthProvider
  lib/            # Supabase client, types
  pages/
    auth/         # Login
    superadmin/   # Farms, users, dashboard
    company/      # Farm dashboard, team
supabase/
  migrations/     # Database schema + RLS
  functions/      # create-user Edge Function
```

## Next steps

- Add herd and livestock tracking features under `/app`
- Extend RLS policies as you add domain tables (animals, fields, etc.)
- Add password reset and invite-by-email flows
- Wire up Supabase CLI for local migrations
