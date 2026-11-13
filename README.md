# Budget Tracker

PocketPlan tracks one monthly budget and splits it between **Personal** and **Grocery** by percentage. Categories organize transactions and reports; they do not have individual budget limits.

The app has four tabs:

- **Dashboard** — monthly overview, spending pace, group allocations, and adding, filtering, sorting, editing, or reviewing transactions. The transaction list is paginated.
- **Budget** — enter the monthly allowance, subtract rent and Didi fees, add a carry-in (which may be negative), set existing savings and a monthly savings target, then split the spendable remainder between Personal and Grocery.
- **Reports** — compare Personal and Grocery cumulative spending against their ideal and projected pace, see each group's top five expenses and spending on a selected day, and check the remaining per-day allowance for the rest of the month.
- **Settings** — choose the display currency and budget alert threshold, and add categories.

The supplied categories are Food, Vegetables, Meat, Fish, Groceries, Transportation, Medical, Entertainment, Shopping, Education, Bills, Gifts, and Miscellaneous. Grocery includes Vegetables, Meat, Fish, Groceries, and Bills; all other categories are Personal. These allocations remain part of the budget calculation, but are not shown beside categories in transaction lists.

## Start locally

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, or use `neon env pull` from the project root to create the ignored root `.env.local`. The backend loads `DATABASE_URL` from `.env.local` first, then root `.env`, then `backend/.env`; environment variables supplied by the hosting platform take precedence.
   Copy `frontend/.env.example` to `frontend/.env.local` if you need to change the frontend API URL.
2. Create the database and run `database/init.sql`.
   For an existing database, run the applicable files in `database/` as described in [DEPLOYMENT.md](./DEPLOYMENT.md); do not run the fresh-install script over production data.
3. Run `npm install` from this folder.
4. Run `npm run dev`, then open `http://localhost:3000`.

On Windows, you can also double-click `start-budget-tracker.bat` in the project folder. It starts the frontend on port 3000 and backend on port 5000 in the same terminal. Keep that window open while using the app; press Ctrl+C to stop the services.

Or, with Docker installed, run `docker compose up --build`. The API runs at port 5000 and the Next.js client runs at port 3000.

## Project structure

- `frontend/app` contains the Next.js route entry point and global styles.
- `frontend/features` contains the home shell and dashboard, budget, reports, settings, and transaction features.
- `frontend/components`, `frontend/lib`, and `frontend/types` hold shared UI, API/format helpers, and shared types.
- `backend/src/routes` defines API endpoints; `services` contains database operations; `validators` holds request schemas; `middleware` and `utils` contain shared server helpers.

## Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Vercel + Render + Neon setup, including where to set production environment variables and which database SQL script to run.

The monthly budget calculation is: **effective allowance = monthly allowance − rent − Didi fees + carry-in**; **spendable budget = effective allowance − monthly savings target**. The Personal/Grocery percentages apply to the spendable budget. The existing savings total is a shared balance across months and is not deducted again; each month has its own savings target.
