# Deploy PocketPlan

Production deployment uses:

- **Vercel** for the Next.js frontend.
- **Render** for the Express API, configured by the repository's `render.yaml`.
- **Neon** for the shared PostgreSQL database.

## Before deploying

The app currently has no login or per-user data separation. Anyone who can reach the app or API can read and change the same budget. CORS only controls browser behavior; it is not authentication. Do not put private financial data in a publicly reachable deployment until access control has been added.

Create a **private** empty GitHub repository for the project. This local repository is initialized on `main`, but it has no commit or remote yet. From PowerShell in the project root, replace the URL below with the HTTPS URL GitHub gives you:

```powershell
git add .
git commit -m "Prepare PocketPlan deployment"
git remote add origin https://github.com/YOUR-USER/YOUR-REPOSITORY.git
git push -u origin main
```

Do not upload `.env` files, passwords, database URLs, or other credentials. The root `.gitignore` excludes local environment files while allowing the `.env.example` templates.

## Local development database

Use a local PostgreSQL instance for development. Set `DATABASE_URL` in `backend/.env` to that local instance; the backend rejects remote database hosts outside production and does not read the root `.env.local`. The root `.env.local` may contain production credentials and must not be used by local development.

For a fresh local database, run `database/init.sql`. To upgrade an existing local database, run the versioned migrations in order:

1. `database/V1__budget_plan.sql`
2. `database/V2__flexible_budget_costs.sql`
3. `database/V3__transaction_browsing.sql`
4. `database/V4__household_group.sql`

The migration scripts are safe to rerun. V2 depends on the budget columns introduced by V1; V3 adds indexes for the existing transactions table; V4 renames the Grocery group to Household without changing category IDs or transaction references.

## 1. Create the production database

1. Create a PostgreSQL project on Neon.
2. Copy the pooled connection string from the Neon console. Keep it secret.
3. For a new, empty database, run `database/init.sql` using Neon's SQL Editor.
4. For an existing PocketPlan database, back it up and run the applicable versioned migrations instead of `init.sql`, before deploying the updated API. Run `V1` through `V4` in order when upgrading from the original schema. V1 adds budget plan fields, V2 converts Rent and Didi fees into configurable fixed costs and adds the carry-in toggle while preserving saved amounts and past-month values, V3 adds transaction indexes, and V4 renames the Grocery group to Household without changing category IDs or transaction references. If a migration version is already present in the database, do not rerun it solely because a new app version was deployed.

The hosting setup does not copy an existing local database into Neon. Export/import your current database separately if you need to keep its transactions and budget data.

Pushing code to GitHub redeploys the Vercel frontend and Render API, but it does **not** apply SQL to Neon. Migrations should be tested against the local PostgreSQL database first; only when deploying a schema-dependent release, apply the same required migration versions to Neon production after taking a backup. Use Neon's SQL Editor or a direct (non-pooled) connection for production migrations; do not use the pooled app connection. These indexes and flexible-budget tables are also included in `database/init.sql` for fresh installations.

## 2. Deploy the API on Render

1. In Render, choose **New → Blueprint**, connect the private GitHub repository, and approve the `pocketplan-api` service defined in `render.yaml`. The Blueprint uses the `backend` directory, `npm install`, and `npm start`. If creating a Web Service instead, use **Root Directory** `backend`, **Build Command** `npm install`, and **Start Command** `npm start`.
2. In the API service's **Environment** settings, add:
   - `DATABASE_URL` — the Neon connection string, including its SSL query parameters.
   - `CORS_ORIGIN` — the exact public Vercel origin, for example `https://your-project.vercel.app` (no trailing slash). Multiple comma-separated origins are supported.

   If you have not created the Vercel project yet, temporarily set `CORS_ORIGIN` to `http://localhost:3000`; replace it with the Vercel production origin and redeploy the API after step 3.
3. Deploy and wait for the service to become healthy. Its health endpoint is `https://YOUR-API.onrender.com/api/health` and should return `{"ok":true}`. To confirm the API can also reach Neon, open `https://YOUR-API.onrender.com/api/categories`; it should return the category list.

Render provides `PORT` automatically. Do not set it to the local development port.

## 3. Deploy the frontend on Vercel

1. Import the GitHub repository as a Vercel project.
2. Set **Root Directory** to `frontend` and select the Next.js framework. Leave the detected install/build settings in place.
3. In **Project Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` — `https://YOUR-API.onrender.com/api`
4. Enable it for the **Production** environment, save, and redeploy. Only enable it for Preview if you intentionally want preview deployments to use the shared production API.

`NEXT_PUBLIC_API_URL` is public and is embedded in the frontend build. Never put the Neon URL, password, or other secrets in a `NEXT_PUBLIC_*` variable.

## 4. Verify

If you used the temporary CORS origin, update Render's `CORS_ORIGIN` to the Vercel production origin and redeploy the API now. Then open the Vercel URL and confirm that the dashboard loads, a transaction can be added, and it remains after a reload. Test from another device to confirm both clients use the same database. Render's free service may take time to wake after inactivity.

## Local environment files

- Backend: copy `backend/.env.example` to `backend/.env`, then set `DATABASE_URL` to local PostgreSQL and `CORS_ORIGIN` to the local frontend origin.
- Frontend: copy `frontend/.env.example` to `frontend/.env.local` only if you need a non-default local API URL.

Keep those local files out of Git. Configure production values in the Render and Vercel dashboards, not in the repository.
