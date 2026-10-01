# Operations Workspace — Cloud Database & Vercel Deployment Guide

A modern Operations & Team Management Platform with **Supabase Cloud Database (PostgreSQL)**, real-time live synchronization, role-based client security, and calendar task scheduling.

---

## 🚀 Quick Overview

- **Frontend**: Vite + Vanilla JS + CSS (super fast, lightweight, zero framework bloat)
- **Database**: Supabase PostgreSQL (free, real-time multi-user synchronization)
- **Deployment Target**: Vercel (Production HTTPS with 1-click CI/CD)
- **Fallback Mode**: Automatically runs with local demo store if Supabase credentials are not yet provided, so your app **never crashes**!

---

## 🗄️ Step 1: Supabase Cloud Database Setup (Free - 2 Minutes)

1. **Sign Up**: [supabase.com](https://supabase.com) par free account banayein aur ek **"New Project"** create karein (e.g. `operations-workspace`).
2. **Database Tables Banayein**:
   - Supabase dashboard ke left menu me **SQL Editor** par click karein.
   - Project ke andar di gayi file [supabase-schema.sql](file:///c:/Users/Sameer%20Thakur/Team%20management/supabase-schema.sql) ka pura code copy karein.
   - SQL Editor me paste karke **"Run"** button dabayein.
   - *Isse aapke tables (`clients`, `team_members`, `tasks`), security policies (RLS), aur October 2026 ke seed data turant create ho jayenge!*
3. **API Keys Copy Karein**:
   - Supabase me **Project Settings** (gear icon) > **API** section me jayein.
   - Wahan se 2 values note karein:
     - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
     - **anon / public key** (e.g., `eyJhbGciOi...`)

---

## 💻 Step 2: Local Testing (Optional)

Agar local testing ke dauran Supabase connect karna ho:
1. Ek `.env` file banayein (ya `.env.example` ko copy karke `.env` rename karein):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
2. Dev server start karein:
   ```bash
   npm run dev
   ```
   Aapko header me **🟢 Cloud Database** badge dikhega!

---

## 🔺 Step 3: Vercel Par Deploy Karna (Sabse Aasan)

### Option A: GitHub + Vercel Dashboard (Sabse Best & Recommended)
1. Apne code ko GitHub par push karein:
   ```bash
   git init
   git add .
   git commit -m "Operations Workspace with Cloud Database"
   git branch -M main
   git remote add origin https://github.com/<your-username>/operations-workspace.git
   git push -u origin main
   ```
2. **[vercel.com](https://vercel.com)** par jayein aur login karein.
3. **"Add New Project"** click karein aur apna GitHub repo select karein.
4. **Environment Variables** section expand karein aur yeh 2 keys add karein:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
5. **"Deploy"** button par click karein!
   - 1 minute ke andar aapka project live ho jayega aur ek official HTTPS link mil jayegi!

---

### Option B: Vercel CLI (Seedha Terminal Se)
1. Terminal me run karein:
   ```bash
   npx vercel
   ```
2. On-screen prompts:
   - `Set up and deploy?` -> `y`
   - `Which scope?` -> Select your account
   - `Link to existing project?` -> `N`
   - `Project name?` -> `operations-workspace`
   - `In which directory?` -> `./`
3. Environment variables set karne ke liye:
   ```bash
   npx vercel env add VITE_SUPABASE_URL
   npx vercel env add VITE_SUPABASE_ANON_KEY
   ```
4. Production build deploy karein:
   ```bash
   npx vercel --prod
   ```

---

## 🔄 Real-Time Multi-User Sync Kaise Kaam Karta Hai?

Jab **Founder** kisi task ka status badalta hai ya naya task add karta hai:
1. Data turant Supabase PostgreSQL me update hota hai.
2. Supabase Realtime WebSocket ke through **Rakesh Kumar** aur baaki sabhi team members ki screen par bina page refresh kiye live update ho jata hai!
# Team-task
