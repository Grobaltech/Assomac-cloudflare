# ASSOMAC Platform

Production foundation for ASSOMAC governance, companies, branches, people, historical records and transfers.

## Stack
- React + TypeScript + Vite
- Tailwind CSS
- Cloudflare Worker API
- Supabase PostgreSQL/Auth/Storage

## Phase 1
Includes database schema/RLS for companies, branches, users, roles/permissions, people, assignments/transfers, audit logs and historical/manual migration batches.

## Setup
1. Create a Supabase project.
2. Run `supabase/migrations/0001_foundation.sql` in Supabase SQL Editor.
3. Copy `frontend/.env.example` to `frontend/.env` and set Supabase URL/key.
4. `cd frontend && npm install && npm run dev`

Never put a Supabase service-role key in the frontend.
