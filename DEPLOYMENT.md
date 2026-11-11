# Deploy PocketPlan

This deployment uses:

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

## 1. Create the shared database

1. Create a PostgreSQL project on Neon.
2. Copy the pooled connection string from the Neon console. Keep it secret.
3. For a new, empty database, run `database/init.sql` using Neon's SQL Editor.
4. For an existing PocketPlan database, run `database/migrate-budget-plan.sql` instead of `init.sql`, after backing up the existing database.

The hosting setup does not copy an existing local database into Neon. Export/import your current database separately if you need to keep its transactions and budget data.

## 2. Deploy the API on Render

1. In Render, choose **New → Blueprint**, connect the private GitHub repository, and approve the `pocketplan-api` service defined in `render.yaml`. The Blueprint uses the `backend` directory, `npm install`, and `npm start`. If creating a Web Service instead, use **Root Directory** `backend`, **Build Command** `npm install`, and **Start Command** `npm start`.
2. In the API service's **Environment** settings, add:
   - `DATABASE_URL` — the Neon connection string, including its SSL query parameters.
   - `CORS_ORIGIN` — the exact public Vercel origin, for example `https://your-project.vercel.app` (no trailing slash). Multiple comma-separated origins are supported.

   If you have not created the Vercel project yet, temporarily set `CORS_ORIGIN` to `http://localhost:3100`; replace it with the Vercel production origin and redeploy the API after step 3.
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

- Backend: copy `backend/.env.example` to `backend/.env`, then set `DATABASE_URL` and local `CORS_ORIGIN`.
- Frontend: copy `frontend/.env.example` to `frontend/.env.local` only if you need a non-default local API URL.

Keep those local files out of Git. Configure production values in the Render and Vercel dashboards, not in the repository.
