# Setting Up Supabase Authentication for E-Skedyul

This project uses **Supabase** for user authentication and profile management. Follow the quick guide below to connect your own Supabase project.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in or sign up.
2. Click **New Project**.
3. Choose your organization, give your project a name (e.g. `eskedyul-parish`), set a database password, and pick a region near your users (e.g. `Southeast Asia (Singapore)`).
4. Click **Create new project** and wait ~1–2 minutes for setup to complete.

---

## 2. Obtain Your Project URL and Anon API Key

1. In your Supabase Dashboard, navigate to **Project Settings** (gear icon in the sidebar) → **API**.
2. Find the **Project URL** (e.g. `https://abcdefghijklm.supabase.co`).
3. Find the **Project API keys** and copy the **`anon` `public`** key.

---

## 3. Configure Your Environment Variables

Open the `.env` file in the root folder of this project:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The app automatically reads these variables on launch and displays **Server Live (Supabase Connected)**!

---

## 4. Run the Database Schema (Profiles & Triggers)

1. In your Supabase Dashboard, open the **SQL Editor** from the left sidebar.
2. Click **New Query**.
3. Open the file [`supabase-schema.sql`](./supabase-schema.sql) in this repository and copy its contents.
4. Paste the SQL into the editor and click **Run**.

This script sets up:
* The `public.profiles` table linked to Supabase Auth.
* The `public.organizations` table for parish groups and ministries.
* The `public.events` table for scheduling liturgical masses and events.
* Row Level Security (RLS) policies allowing users and administrators to safely interact with data.
* An automatic trigger that creates a profile record every time a new volunteer or administrator registers.
* Starter seed data for organizations and events.

---

## 5. Enable Email Auth in Supabase

1. Go to **Authentication** → **Providers** → **Email**.
2. Ensure **Enable Email provider** is turned **ON**.
3. *(Optional for development)* Under **Authentication** → **URL Configuration**, set the Site URL to `http://localhost:8443` (or your preview URL).
4. *(Optional for development)* If you wish users to log in immediately without waiting for a confirmation email, you can turn off **"Confirm email"** in **Authentication** → **Email Templates / Settings**.

---

## 6. Creating an Administrator Account

1. Register an account through the app's **Create Account** screen with the **Administrator** role, or in the Supabase Dashboard under **Authentication** → **Users** → **Add User**.
2. To ensure administrative access, run this in the Supabase SQL editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@yourparish.com';
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb WHERE email = 'admin@yourparish.com';
```

---

## 7. Demo / Offline Mode

If Supabase is not configured or offline, the app runs in **Demo Mode**:
* You can test **Volunteer Demo** or **Admin Demo** with 1 click.
* Admin demo login: username `admin`, password `admin123`.
* As soon as valid Supabase credentials are in `.env`, live Supabase authentication is activated immediately!
