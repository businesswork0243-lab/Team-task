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

1. **Database**: Supabase Dashboard → SQL Editor me `supabase/schema.sql` run karo. Ye dobara chalana safe hai; schema badalne par (naye functions) ise phir se run karo.
2. **Auth**: Authentication → URL Configuration me *Site URL* ko Vercel URL par set karo, aur wahi URL *Redirect URLs* me add karo. *Confirm email* ON rakho; invites aur demo data sirf confirmed email ko milte hain.
3. **Vercel env vars**: `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` (Project Settings → Environment Variables). Build command `npm run build`, output `dist` (`vercel.json` me already set hai).
4. **Local**: `.env` banao (`.env.example` dekho), phir `npm install` aur `npm run dev`, aur http://localhost:5173 kholo.

## Team member login

Owner Team member add/edit karte waqt **Work email** aur **Login password** bharta hai. Account turant ban jata hai (email confirm ki zaroorat nahi), aur member usi email/password se login karta hai. Owner wahi field se password reset bhi kar sakta hai. Ye `app_set_member_login` function se hota hai, jo sirf us workspace ke banaye accounts (ya kabhi confirm na hue accounts) ka password badalta hai; kisi ka apna account ho to wo apne password se hi login karta hai.

Password ke bina sirf email daalne par member khud website par usi email se Sign up karke jud sakta hai.

## Notifications aur Web Push

Kisi ko task assign hote hi us member ko app me notification milta hai (ghanti 🔔). Ghanti me **Turn on** dabane par us device par Web Push chalu ho jata hai, aur app band hone par bhi phone/computer par alert aata hai. iPhone par pehle site ko Share → Add to Home Screen karna hota hai, phir wahan se app kholkar Turn on.

Kaise: notification save hone ke baad assign karne wale ka browser `POST /api/push` (Vercel function, `api/push.js`) call karta hai. Function check karta hai ki caller usi workspace ka member hai aur notification usi ne banaya hai, phir `app_push_subs` me saved devices par push bhejta hai (har notification sirf ek baar, `app_push_log`).

Vercel → Settings → Environment Variables me ye do daalo (Production), phir redeploy:

| Name | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` / secret key |
| `VAPID_PRIVATE_KEY` | Local `.env` file me hai (git me nahi) |

`VAPID_PUBLIC_KEY` [push-config.js](push-config.js) me commit hai. Keys badalni ho to `npx web-push generate-vapid-keys` chalao, public key `push-config.js` me aur private key Vercel me daalo; tab sab devices ko dobara Turn on karna hoga.

## Data model

- `app_workspaces`: ek row per workspace.
- `app_members`: kaun kis workspace me hai (`email`, `user_id`, `person_id`, `role`). Owner app me team member add karta hai to email ka invite yahan banta hai; us email se login karne par `user_id` claim ho jata hai.
- `app_items`: workspace ka saara data. `coll` = collection (`tasks`, `ledger`, `clients`, `people`, `leaves`, `series`, `audit`, `grants`, `feat`, ya chhoti settings lists ke liye `_doc`), `id` = record id. Delete soft hote hain (`deleted = true`).

App sirf badle hue records save karta hai (~0.6s debounce), aur Supabase Realtime se doosre logon ke changes turant apply karta hai.

## Security note

Workspaces ek-doosre se RLS ke through puri tarah alag hain. Workspace ke andar ki permissions (Finance access, Payroll, Viewing as, waghaira) app me enforce hoti hain, database me nahi. Matlab workspace ka koi bhi member API se us workspace ka saara data padh/likh sakta hai. Sensitive data ke liye isse dhyan me rakho.
