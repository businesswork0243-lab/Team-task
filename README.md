# Operations Workspace

Multi-tenant operations app (clients, tasks, team, payroll, expenses, access control) backed by Supabase and deployed on Vercel.

Har user signup karke apna alag workspace banata hai. Owner apni team ko email se invite karta hai; wahi email se signup karne par member usi workspace me judta hai. Data Supabase me save hota hai aur workspace ke sab logon ko realtime me dikhta hai.

## Structure

| Path | Kya hai |
| --- | --- |
| `src/index.html` | Poora app: template (`<x-dc>`) + logic (`<script data-dc-script>`) |
| `src/cloud.js` | Supabase layer: login, workspaces, members, save/load, realtime |
| `src/vendor/` | dc-runtime aur React (offline copies) |
| `src/fonts/` | Web fonts |
| `supabase/schema.sql` | Tables, RLS policies, RPC functions |
| `build.mjs` | `src/` → `dist/`, Supabase keys se `config.js` banata hai |

## Setup

1. **Database**: Supabase Dashboard → SQL Editor me `supabase/schema.sql` run karo.
   (Local `supabase/setup.sql` me schema + demo data dono hain; ye file git me commit nahi hoti.)
2. **Auth**: Authentication → URL Configuration me *Site URL* ko Vercel URL par set karo, aur wahi URL *Redirect URLs* me add karo. *Confirm email* ON rakho; invites aur demo data sirf confirmed email ko milte hain.
3. **Vercel env vars**: `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` (Project Settings → Environment Variables). Build command `npm run build`, output `dist` (`vercel.json` me already set hai).
4. **Local**: `.env` banao (`.env.example` dekho), phir `npm install` aur `npm run dev`, aur http://localhost:5173 kholo.

## Data model

- `app_workspaces`: ek row per workspace.
- `app_members`: kaun kis workspace me hai (`email`, `user_id`, `person_id`, `role`). Owner app me team member add karta hai to email ka invite yahan banta hai; us email se login karne par `user_id` claim ho jata hai.
- `app_items`: workspace ka saara data. `coll` = collection (`tasks`, `ledger`, `clients`, `people`, `leaves`, `series`, `audit`, `grants`, `feat`, ya chhoti settings lists ke liye `_doc`), `id` = record id. Delete soft hote hain (`deleted = true`).

App sirf badle hue records save karta hai (~0.6s debounce), aur Supabase Realtime se doosre logon ke changes turant apply karta hai.

## Security note

Workspaces ek-doosre se RLS ke through puri tarah alag hain. Workspace ke andar ki permissions (Finance access, Payroll, Viewing as, waghaira) app me enforce hoti hain, database me nahi. Matlab workspace ka koi bhi member API se us workspace ka saara data padh/likh sakta hai. Sensitive data ke liye isse dhyan me rakho.
