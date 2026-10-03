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
3. Deploy the Edge Functions for user invite/delete:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
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
- Wire up Supabase CLI for local migrations

## Demo / test data

As **Super Admin**, open **Farms** and use per-farm actions:

- **Seed demo** — locations, encampments, ~265 animals (pedigrees), inoculations
- **Clear demo** — removes only demo-tagged data
- **Reset farm** — deletes all animals/locations/inoculations/photos for that farm (keeps users)

Requires migration `008_farm_demo_seed_reset.sql` applied (`npx supabase db push` or SQL Editor).
Photos are not seeded (upload in the app).

## Inviting users

Admins invite users by email (no password field). The `create-user` Edge Function calls
Supabase `inviteUserByEmail`, and the invitee sets their password at `/reset-password`.

Invite metadata includes the invitee’s name, role label, farm name (when applicable), and
who sent the invite — used by the branded email template.

1. Deploy functions after changes:
   `npx supabase functions deploy create-user`
   `npx supabase functions deploy delete-user`
2. In Supabase → Authentication → URL Configuration, add your app URL(s) to
   **Redirect URLs**, including `http://localhost:5173/reset-password` and your
   production `/reset-password` URL.
3. Brand the invite email (Dashboard — not auto-deployed from the repo):
   - Open **Authentication → Email Templates → Invite user**
   - Subject: paste from [`supabase/email-templates/invite-subject.txt`](supabase/email-templates/invite-subject.txt)
   - Body: paste from [`supabase/email-templates/invite.html`](supabase/email-templates/invite.html)
   - Save, then send a test invite to confirm the link lands on `/reset-password`
