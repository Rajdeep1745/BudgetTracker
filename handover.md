# PocketPlan / Budget Tracker handover

Initial inspection and latest explicitly requested update: 19 November 2026. This document describes the checked-out source. Local verification is recorded below; hosted deployment state has not been verified.

## Document ownership and update rule

- Read this file for project context at the start of future work, then inspect the relevant current source before changing anything.
- **Update this file only when the user explicitly asks.** Do not maintain it automatically after tasks, fixes, discoveries, commits, or deployments. This initial creation was explicitly requested.
- Source code can change independently of this snapshot; reconcile discrepancies against current code.
- Do not treat the issues recorded below as authorization to fix them.
- Never record credentials, environment file contents, or private financial records here.

## Product and architecture

PocketPlan is a single shared monthly expense tracker. One monthly allowance is reduced by fixed costs and a savings target, optionally adjusted by carry-in, and split between Personal and Household. Categories organize expenses; they have no individual budget caps.

```text
Browser
  Next.js / React frontend, localhost:3000
    app/page.tsx -> features/home/HomePage.tsx
      lib/api.ts -> fetch NEXT_PUBLIC_API_URL + endpoint
        Express API, localhost:5000/api
          app.js -> routes -> Zod validators -> services
            db.js -> pg.Pool -> PostgreSQL
```

- Root npm workspace contains `frontend` and `backend`; one root lockfile manages dependencies.
- Frontend: Next.js 15, React 19, strict TypeScript, Recharts, Lucide icons, Tailwind CSS 3/PostCSS. Versions here are package.json ranges, not a dependency audit.
- Backend: Node.js ES modules, Express 4, `pg`, Zod 3, dotenv, CORS. SQL is written directly; no ORM.
- Database: PostgreSQL, UUIDs generated through `pgcrypto`; Docker specifies PostgreSQL 16.
- No authentication, users, tenants, authorization middleware, or per-user data separation exists. All clients use the same records.
- The frontend calls Express directly from the browser. There are no Next.js API routes, API proxy rewrites, or server actions in the inspected source.
- Tabs are React state on the single `/` page, not separate routes. Selected tab/month are not URL state.

## Repository map

| Location                            | Responsibility                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json` | Workspace dependencies and root scripts; concurrently starts both development servers.                                                                                                   |
| `README.md`                         | Product description and local setup overview.                                                                                                                                            |
| `DEPLOYMENT.md`                     | Manual SQL upgrade and Vercel/Render/Neon instructions; some historical Git setup text is stale.                                                                                         |
| `start-budget-tracker.bat`          | Windows launcher; checks Node/npm and backend environment file, installs if root node_modules is absent, sets local ports/API origin, runs dev. Does not start PostgreSQL or migrate it. |
| `docker-compose.yml`                | PostgreSQL, API, frontend, persisted database volume, fresh-install SQL mount. See Docker caveats below.                                                                                 |
| `render.yaml`                       | Render API Blueprint rooted at backend, production mode, health path, secret placeholders.                                                                                               |
| `neon.ts`                           | Neon tooling config: auth disabled and new non-default branches get a seven-day TTL. Not imported by the application connection layer.                                                   |
| `.gitignore`                        | Excludes environment secrets, node_modules, generated Next output, coverage and Neon local metadata; allows example environment files.                                                   |
| `frontend/app`                      | Route entry, root layout, theme tokens and global styles.                                                                                                                                |
| `frontend/features`                 | Home orchestration plus dashboard, budget, reports, settings and transaction views.                                                                                                      |
| `frontend/components`               | Shared display, money fields, notifications and confirmation UI.                                                                                                                         |
| `frontend/lib`                      | Fetch wrapper, date formatting and native date/month picker helper.                                                                                                                      |
| `frontend/types/index.ts`           | Shared frontend data contracts and component prop types. No generated/shared backend contract package.                                                                                   |
| `backend/src`                       | Express entry points, database pool, routes, validators, services, errors and date utility.                                                                                              |
| `database`                          | Fresh schema/seed and five manually applied upgrade scripts (V1–V5).                                                                                                                     |
| `backend/test/transactions.test.js` | Node test runner coverage using an isolated PostgreSQL cluster and real API requests.                                                                                                    |
| `frontend/public/logo`              | Original supplied PNG and the simplified SVG mark used by the app and favicon.                                                                                                           |

## Frontend connections and state

`app/layout.tsx` imports theme.css and globals.css, sets PocketPlan metadata and wraps the app in `ToastProvider`. `app/page.tsx` renders `HomePage`.

`components/BrandLogo.tsx` is shared by the desktop sidebar and mobile header. It renders `/logo/pocketplan-mark.svg` through next/image alongside a navy/green PocketPlan wordmark. The image is decorative (empty alt) because the adjacent text names the brand. The SVG is a simplified vector interpretation of the supplied `public/logo/PocketPlan Budget Tracker Logo.png`, retaining the pocket/checklist/coin/growth-arrow motifs; the original PNG is preserved. Root layout metadata uses the same SVG as the browser-tab favicon. Brand styling uses Tailwind utilities inside the shared component, which is covered by the existing Tailwind content scan.

`features/home/HomePage.tsx` is the main state and network coordinator. It owns the selected month/tab, dashboard data, transaction results/filter/sort/page, budget form values, settings, category creation and transaction mutations. Feature components largely receive data and callbacks through props. There is no Redux, query-cache library or separate persistent frontend store.

On mount it requests dashboard data for the selected month, transactions for that month, and settings for the actual current month. Changing month reloads dashboard and transactions and resets the report day/page. Changing tabs uses the same shared data. Dashboard and Reports share transaction filters, sorting and pagination.

Transaction creation/edit/deletion reload dashboard and transaction data. Budget save reloads dashboard. Category creation reloads dashboard, whose categories also populate dropdowns. Fixed-cost and carry-in changes reload settings and dashboard. Dashboard reload also replaces budget input values, so unrelated mutations can overwrite unsaved budget edits.

| Feature/file                                   | Behavior                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/dashboard/DashboardTab.tsx`          | Budget/spent/remaining/daily pace cards, threshold warning, spending chart, add transaction form, group split and transaction browser.                                                                                                                               |
| `features/budget/BudgetTab.tsx`                | Editable allowance, monthly fixed costs, optional signed carry-in, shared existing savings, monthly savings target and Personal percentage; live calculation/split preview. Group overview uses saved data.                                                          |
| `features/reports/ReportsTab.tsx`              | Per-group cumulative actual/ideal/projected charts, spending on selected day, remaining daily allowance after that day, top five categories per group, category totals, shared transaction browser. All report calculations use dashboard aggregates in the browser. |
| `features/settings/SettingsTab.tsx`            | Display currency, alert percentage, carry-in toggle, fixed-cost type creation/archive and category creation. Settings operations use the actual current month, regardless of selected historical month.                                                              |
| `features/transactions/TransactionForm.tsx`    | Expense creation; amount/date/category required, optional description. Date defaults/resets to local today, not selected month.                                                                                                                                      |
| `features/transactions/TransactionBrowser.tsx` | Draft filters applied by button, sortable table, inline editing, confirmed deletion and ten-row pages. Parent delays loading 250ms when applied search is nonempty; search typing alone does not apply filters.                                                      |

Shared components: `Stat` renders metric cards; `GroupCard` renders allocation/progress; `MoneyField` renders currency-number inputs; `SplitPreview` renders draft allocation; `EmptyState` renders no-data messaging; `ConfirmDialog` handles deletion confirmation, Escape/backdrop cancellation and busy controls; `ToastProvider` supplies success/error/info messages with five-second automatic dismissal and live-region roles.

`lib/api.ts` concatenates base URL and path, returns the raw successful Response, and throws the API JSON `error` on HTTP failure. It does not add JSON headers automatically; mutation callers supply them. No retries, request cancellation or authentication handling exists.

`lib/format.ts` builds local YYYY-MM-DD, formats transaction dates with UTC to avoid date shifts, and formats month labels with en-IN. Money formatting is en-IN with two decimals. `openPickerFromLabel.ts` invokes native showPicker when supported, otherwise focuses the input.

### Persistence boundaries

- PostgreSQL: budgets, expense transactions, categories, fixed-cost definitions/monthly snapshots, global savings and carry-in default.
- Browser localStorage: `pocketplan.currency` (default INR; USD/EUR/GBP also offered) and `pocketplan.alertThreshold` (default 80).
- Currency is display formatting only; no exchange conversion or currency column exists in PostgreSQL.
- Component memory only: selected tab/month/day, filter/sort/page, drafts and dismissed budget alert. Reload resets these.
- Settings fixed-cost definitions are global but month-effective. Monthly fixed-cost amounts are separate values, not automatically recurring expense transactions.

### Styling

`app/theme.css` defines purple/accent colors, surfaces, status colors, font sizes/weights and other CSS variables. `app/globals.css` contains most actual styling, Tailwind directives, charts/tables/modals/toasts and responsive breakpoints at 1100, 820 and 560px. Desktop sidebar switches to mobile navigation. Existing JSX predominantly uses custom semantic classes and some inline dynamic chart/progress colors.

Tailwind content currently scans only app and components, omitting features. Future utility classes in feature files may not be emitted unless the configuration is adjusted. Preserve existing theme/global behavior; follow the user's Tailwind-first policy for future work.

## Backend structure and API contract

`server.js` imports app and listens on PORT or 5000. `app.js` configures CORS from a comma-separated origin list, JSON parsing, health, five route modules and final error middleware. Imports through services initialize db.js before requests are served.

All paths below are relative to `/api`. Dashboard/settings/transaction GET requests default omitted month to the server's UTC YYYY-MM. The browser normally supplies month explicitly.

| Method/path                                      | Input and result                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                                    | `{ok:true}`; process health only, no database query.                                                                                   |
| GET `/categories`                                | All categories ordered by group/name.                                                                                                  |
| POST `/categories`                               | `{name, groupName}` -> 201 category. Group Personal or Household; trimmed name 1–60 chars.                                             |
| GET `/dashboard?month=YYYY-MM`                   | `{month, totals, budget, groups, categories, daily, groupDaily}`; main read model for all tabs.                                        |
| PUT `/budgets`                                   | `{month, allowance, personalPercent, carryIn, carryInEnabled, alreadySaved, savingsTarget, fixedCosts:[{id,amount}]}` -> saved budget. |
| GET `/settings?month=YYYY-MM`                    | Global carry-in default plus fixed-cost types active in requested month.                                                               |
| POST `/settings/fixed-costs`                     | `{name,effectiveMonth}` -> 201 fixed-cost type.                                                                                        |
| DELETE `/settings/fixed-costs/:id?month=YYYY-MM` | Archives type and removes saved amounts from effective month onward; 404 if not found/already archived.                                |
| PUT `/settings/carry-in`                         | `{enabled,effectiveMonth}` -> `{carryInEnabled}`; updates default and existing budgets from effective month onward.                    |
| GET `/transactions`                              | Month plus optional filters below -> `{items,total,page,pageSize}`.                                                                    |
| POST `/transactions`                             | `{categoryId,description?,amount,transactionDate}` -> 201 newly inserted or merged daily row.                                          |
| PUT `/transactions/:id`                          | Same expense fields; full validated replacement, 404 if missing, 409 if another row occupies the target category/date.                 |
| DELETE `/transactions/:id`                       | 204, including if UUID is valid but no row exists.                                                                                     |

Transaction query fields: page (default 1), pageSize (default 10, maximum 100), sortBy (date/category/description/amount), sortDirection (asc/desc; default desc), search (up to 140 chars), categoryId UUID, from/to ISO dates with from <= to. Filters always remain inside the requested month. Search uses ILIKE across category, description, textual date and amount. SQL values are parameterized; sort columns are allowlisted. Sorting adds date/created_at/id tie breakers.

Request validation lives in `validators/{budget,category,settings,transaction}.js`; routes parse and delegate to matching services. IDs must be UUIDs. Expenses must be positive; new descriptions have a 140-character limit and default empty. `transactionUpdateSchema` permits longer descriptions so merged descriptions remain editable through the API. The frontend inline description input still has maxLength=140, so extending long descriptions in that field remains a limitation. Budget amounts are finite/nonnegative except signed carry-in; percentage is 0–100; duplicate fixed-cost IDs are rejected. Month validation checks YYYY-MM shape only, not calendar month range.

`middleware/errorHandler.js` logs errors, maps Zod to 400 (first issue), explicit statusCode errors to their status/message, remaining unique violations to 409 (category/fixed-cost messages), and other failures to generic 500. Explicit status/message takes priority over generic duplicate messages, allowing transaction edit conflicts to explain the occupied category/date. Unknown category foreign keys and invalid database dates currently fall through to 500.

### Service responsibilities

- `budgetService.saveBudget`: one DB transaction upserts monthly budget, validates requested fixed-cost types against effective dates with FOR SHARE, replaces that month's fixed-cost snapshots, and updates global total_saved. Rollback on failure; client always released.
- `settingsService`: reads global/default settings and month-active cost types; creates types; transactionally archives types/removes current-future saved amounts; transactionally changes carry-in defaults/current-future budget flags.
- `dashboardService`: sums monthly expenses by category/group/day, reads monthly budget/global settings/fixed-cost snapshots, supplies active unsaved types at zero, computes allocations and remaining balances.
- `transactionService`: filtered count/page queries, daily merging on addition, replacement edits and delete. Count and rows run concurrently and are not a single consistent snapshot. Addition begins a SQL transaction, locks the category row to serialize concurrent additions (including when no daily row exists), locks matching transactions, sums amounts in SQL and concatenates nonempty trimmed descriptions with comma-space. It retains the oldest row by created_at/id, removes additional legacy matches if present, commits or rolls back, and always releases the client. Updates map the daily unique-index violation to a descriptive HTTP 409 without merging or changing either row.
- `categoryService`: list/create categories only; there are no category edit/delete endpoints.
- `utils/dates.js`: appends `-01` for SQL month dates; also exports a month regex.

## Budget and reporting rules

There is one expense row per category and calendar date after V5. Adding more expenses to that category/date increases its amount and appends nonempty descriptions with `, `; blank descriptions introduce no extra separators. Different categories/dates stay separate. SQL NUMERIC arithmetic avoids floating-point accumulation in the merge. Transactions count daily category rows rather than the number of individual additions; overall/category/day spending totals remain unchanged by consolidation. Editing a row replaces its amount/description; it is not an additional expense.

```text
fixedCostTotal = sum(monthly fixed-cost amounts)
effectiveAllowance = allowance - fixedCostTotal + (carryInEnabled ? carryIn : 0)
spendableBudget = effectiveAllowance - savingsTarget
allocationBase = max(spendableBudget, 0)
Personal allocation = allocationBase * personalPercent / 100
Household allocation = allocationBase * (100 - personalPercent) / 100
remaining = max(budget - spent, 0)       # overall and per group
```

- Spendable budget can be negative; allocations and remaining balances clamp to zero. No automatic rejection when fixed costs/savings exceed allowance.
- Unconfigured month defaults: allowance/carry-in/savings target zero, Personal 40%, global carry-in default (otherwise true), active fixed-cost amounts zero. No automatic prior-month budget copy.
- Existing savings is a manually entered singleton balance shared across months. Saving any month's budget updates that same balance. Monthly savings targets are deductions, not automatic deposits into total_saved.
- Carry-in is manually entered; no automatic previous-month rollover. Disabling it preserves the stored signed amount.
- Fixed costs reduce the budget but are not included in expense totals unless separately entered as transactions.
- Fixed-cost availability is created_month <= month and archived_month absent or > month. Archiving preserves earlier snapshots and removes saved amounts from effective month onward. Historical names are snapshotted.
- API accepts an arbitrary effectiveMonth; the current UI enforces current-month behavior by choosing the current month itself.
- Budget alerts require positive overall/group budget and compare rounded, capped group usage against local threshold. Dismissal lasts in component state for that month.
- Charts use elapsed days: full month for past months, today for current month, zero for future months. Projection extrapolates average spending through elapsed days; ideal pace divides allocation across month days. Selected report day affects day spending/daily allowance, not chart projection cutoff.
- Daily allowed spending uses cumulative spend through selected day, clamps remaining to zero, and divides by days strictly after that day; month-end allowance is zero.
- Report top-five lists rank categories, not individual transactions. Category/report aggregates cover the entire selected month regardless of transaction-list filters. The report transaction count currently follows the filtered list total.

## Database schema and relationships

`database/init.sql` creates the complete fresh schema and seed. It is not an existing-database upgrade script and most CREATE TABLE statements are not idempotent.

| Table                        | Key fields and relationships                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`                 | UUID PK, unique case-sensitive name, constrained group_name Personal/Household, color, created_at.                                                  |
| `transactions`               | UUID PK, category_id FK -> categories (delete restrict), description, positive NUMERIC(12,2) amount, transaction_date DATE, created_at TIMESTAMPTZ. |
| `monthly_budgets`            | UUID PK, unique first-of-month DATE, total_amount (API allowance), personal_percent, carry_in, carry_in_enabled, savings_target.                    |
| `app_settings`               | Singleton id=1; total_saved and carry_in_enabled. No currency/alert settings here.                                                                  |
| `budget_fixed_cost_types`    | UUID PK, name, first-of-month created_month and optional archived_month; partial unique lower(name) index for unarchived types.                     |
| `monthly_budget_fixed_costs` | Composite PK (monthly_budget_id, fixed_cost_type_id); budget FK cascade, type FK restrict, name_snapshot, nonnegative amount.                       |

Transactions have date/category indexes plus composite recent-order, category/recent-order and amount indexes. `transactions_category_date_uidx` uniquely indexes (category_id, transaction_date) in fresh init and after V5. Monthly fixed costs have a type/budget lookup index. Money is stored with two decimal places in SQL; some raw `pg` NUMERIC values return as strings despite frontend number types. Aggregated dashboard values are explicitly converted/cast to numbers; the transaction table converts amount with Number when displaying/editing.

Seed categories: Personal = Food, Transportation, Medical, Entertainment, Shopping, Education, Gifts, Miscellaneous. Household = Vegetables, Meat, Fish, Groceries, Bills. Default fixed costs Rent and Didi fees have stable UUIDs ending 0001 and 0002 and created_month 0001-01-01. Fresh init also includes legacy category remapping/deletion statements.

### Schema upgrades

For existing installations, inspect the actual schema and previously applied upgrades, back up, then apply required versions in order:

1. `V1__budget_plan.sql`: adds legacy rent/didi_fees, carry_in, savings_target and singleton savings settings.
2. `V2__flexible_budget_costs.sql`: adds carry-in flags, effective-dated fixed-cost types and monthly snapshots; copies legacy Rent/Didi fees amounts without overwriting existing snapshots. Legacy columns remain in upgraded DBs, but runtime no longer uses them.
3. `V3__transaction_browsing.sql`: adds transaction browsing indexes.
4. `V4__household_group.sql`: changes Grocery to Household and replaces category group constraint, preserving IDs/references.
5. `V5__daily_category_transactions.sql`: consolidates all historical duplicate category/date groups, retains oldest ID/timestamp, sums amounts and comma-joins nonempty descriptions in created_at/id order, then adds the daily unique index. Runs in one transaction with an exclusive table lock; safe to rerun. Numeric overflow rolls everything back.

Before V5, back up the database and pause writes; apply V5, deploy the updated API, then resume writes and reload clients. Original individual rows cannot be reconstructed reliably from comma-joined descriptions; recovery requires the backup. See DEPLOYMENT.md for pg_dump/psql commands and a duplicate-check query. Fresh databases already get the unique index from init.sql. The migration was verified on a disposable database; the user subsequently reported the feature works, but no assistant-run migration against their application/production database was performed.

Scripts include rerun safeguards, but there is no migration runner/version ledger in the repository. Do not run V1/V2 merely because a fresh init already exists: it would add legacy columns unnecessarily. SQL is never automatically applied by API startup, npm build or Git deployment. Docker init runs only on first initialization of its database volume.

## Configuration, startup and deployment connections

| Variable              | Consumer             | Meaning                                                                                                   |
| --------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | backend db.js        | Required PostgreSQL connection string; secret.                                                            |
| `NODE_ENV`            | backend db.js / Next | Backend permits remote DB hosts only when exactly production; Next chooses .next-dev versus .next output. |
| `PORT`                | backend server.js    | Defaults 5000; hosting platform can supply it.                                                            |
| `CORS_ORIGIN`         | backend app.js       | Comma-separated allowed browser origins; defaults http://localhost:3000.                                  |
| `NEXT_PUBLIC_API_URL` | frontend lib/api.ts  | Public build-time API base including /api; defaults http://localhost:5000/api.                            |

db.js loads only backend/.env when present; dotenv does not override variables already supplied by the process. It does not load root .env.local. Outside production it accepts only localhost, 127.0.0.1 or [::1], rejecting remote/container hostname URLs. Pool uses the connection string directly, including SSL parameters; there is no independent SSL configuration.

Local setup: install Node/npm and local PostgreSQL, create database, copy backend/.env.example to backend/.env with local credentials, apply fresh init or needed existing-schema upgrades, run npm install at root, then npm run dev. Frontend/.env.local is optional for a different public API base. No actual secret environment files were opened during this inspection.

| Command                     | Effect                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`               | concurrently runs frontend and backend workspace dev scripts.                                        |
| `npm run build`             | Frontend production build only.                                                                      |
| `npm start`                 | Backend only; does not start frontend.                                                               |
| `npm run dev -w backend`    | node --watch src/server.js.                                                                          |
| `npm run start -w backend`  | node src/server.js.                                                                                  |
| `npm test -w backend`       | Runs backend Node tests with a disposable PostgreSQL cluster and real HTTP API integration coverage. |
| `npm run dev -w frontend`   | next dev on 3000, output .next-dev.                                                                  |
| `npm run start -w frontend` | next start on 3000, requires production build in .next.                                              |

Configured production topology: Vercel frontend -> public Render Express API -> shared Neon PostgreSQL. Set Vercel root to frontend and its public API URL to Render origin + /api. Render root is backend, build npm install, start npm start, NODE_ENV=production, DATABASE_URL from Neon, CORS_ORIGIN matching Vercel exactly. Neon app connection may be pooled; deployment guidance specifies direct/non-pooled connection or SQL Editor for migrations. Production credentials/endpoints and current service health were not verified.

Git push can trigger hosted code deployments but never applies SQL or copies local financial data. See DEPLOYMENT.md for migration/deployment procedure, while treating its claim of an uncommitted repository with no remote as historical: this checkout has commits and origin https://github.com/Rajdeep1745/BudgetTracker.git.

## Known concerns from source inspection

These are observations/potential issues, not fixes or runtime test results:

- All financial API operations are unauthenticated. CORS is not access control; even a private repository does not make a public app/API private.
- Docker API config uses hostname db without NODE_ENV=production; current db.js rejects that hostname, so the documented Compose setup conflicts with the local database guard.
- Frontend public now exists and contains logo assets, resolving the previously missing-directory concern for the Dockerfile's public COPY. A full Docker build has not been verified.
- Docker Compose sets NEXT_PUBLIC_API_URL on the running web container, while Next embeds it at build time. Default localhost happens to match local use; changing runtime environment alone will not configure a remote browser API destination.
- Compose depends_on expresses startup order, with no DB readiness health check. API health does not test database access.
- Tailwind content omits frontend/features. Existing CSS-variable color concatenation in GroupCard (`var(...)` plus `14`) is not valid hex-alpha syntax; inspect actual rendering before changing it.
- Async frontend loaders lack cancellation/stale-response guards; fast month/filter changes can let older results overwrite newer state. Errors can leave stale data or zero-looking initial UI; no explicit global loading state exists.
- Transaction deletion callback catches failures without returning failure, so its confirmation dialog closes even on an API error. Fixed-cost deletion returns a boolean and keeps its dialog open on failure.
- Most create/save actions lack in-flight guards; repeated clicks can issue duplicate requests.
- ConfirmDialog has dialog semantics and autofocus but no explicit focus trap/restore. Branding was visually reviewed on desktop and mobile; this was not a full accessibility audit.
- YYYY-MM format validation does not reject month 00/13 before PostgreSQL. Browser-local dates and server-UTC default months can diverge near boundaries. Current month is computed once at module load in HomePage.
- Backend/frontend contracts are manually aligned. Missing foreign-key categories return generic 500; numeric precision/type edge cases deserve regression tests before backend changes.

## Testing, review and future-work instructions

Backend tests now use Node's built-in test runner through `npm test -w backend`, with no new testing dependency. `backend/test/transactions.test.js` initializes a disposable PostgreSQL cluster, runs the fresh schema, starts an ephemeral Express server and tears down the test resources. It overrides DATABASE_URL before importing the backend, so tests do not use the application database. PostgreSQL binaries are required: PG_BIN can override the directory; the current Windows default is C:/Program Files/PostgreSQL/18/bin; other systems use binaries on PATH. Windows pg_ctl avoids captured pipes because inherited server handles otherwise block test startup. Localhost connections require running outside the current restricted sandbox.

All 13 tests passed: validation trimming/defaults; daily decimal sums and description concatenation; blank descriptions; separate category/date rows; simultaneous additions; pre-V5 legacy duplicate merging; long merged descriptions and API edits; invalid inputs without data changes; failed-add rollback; unknown categories; V5 historical consolidation/total preservation/oldest identity/idempotence/unique index; V5 overflow rollback; and edit conflicts preserving both rows. Expected error-path logs are emitted by existing middleware during tests. Tests intentionally drop the daily unique index only inside their isolated database when exercising pre-migration rows.

No standalone lint script/configuration, Prettier configuration or checked-in CI workflow was found. Prettier is available on this machine and has been used on modified supported files. The frontend production build compiles and checks types; it is not a component/interaction test suite.

For future backend work, follow the user's requirement to add unit/integration/regression coverage and execute it, using the established Node runner and isolated PostgreSQL approach. Never use production financial data for tests.

Future frontend work must follow the user's UI UX Pro Max skill requirement, responsive/accessibility/state requirements, Tailwind-first styling and actual UI review. UI UX Pro Max was installed at the user's request from nextlevelbuilder/ui-ux-pro-max-skill into C:/Users/Dell/.codex/skills/ui-ux-pro-max and is now available. Read its SKILL.md and use targeted guidance for the relevant detected stack; the branding task used its Next.js image guidance.

Preserve existing business logic and unrelated user changes, inspect current files first, avoid destructive operations without asking, and format modified files. Do not update this handover unless explicitly requested.

### Initial inspection record

- Read source for entry points, all routes/services/validators, schema and upgrades, frontend features/shared helpers/components, styling/configuration, setup/deployment documents and launch/Docker definitions.
- Inspected Git status/history/remotes. Pre-existing modifications were frontend/next-env.d.ts and package-lock.json; these were left untouched.
- No application servers, browser UI, live databases or hosted services were accessed; no migrations or financial writes were performed.
- No automated tests were written or run, and no build/lint run was needed for this documentation-only change. Runtime behavior and reported configuration concerns remain unverified.
- Only handover.md was created by this task.

### Subsequent implementation and verification (19 November 2026)

- Transaction merging, V5, fresh-schema index, API edit conflicts, 13 tests and README/DEPLOYMENT documentation were committed and pushed to main as db225b7 (`feat: merge daily category transactions and migrate existing data`).
- Branding adds BrandLogo, the shared SVG mark and favicon metadata; preserves the supplied PNG; and uses the same component in desktop/mobile HomePage headers. No backend behavior changed during branding.
- Frontend production build passed after retrying outside the sandbox to resolve Windows EPERM during standalone file copying. Compilation, type checks and static generation completed. Prettier and git diff --check passed for the changes.
- Actual local UI review confirmed desktop/sidebar and mobile/header branding at 390x844, no horizontal overflow at that mobile size, successful visible logo loading, and favicon metadata pointing to the SVG. No full responsive/accessibility test suite was run or added for branding.
- The previously uncommitted package-lock.json changes remove some optional-platform libc metadata and add peer metadata; no dependency version changes were found. They predate this feature work and are included only because the user explicitly requested all uncommitted files be committed.
- This handover update and commit/push were explicitly requested. Continue to update this file only on explicit user request. Hosted deployment success remains unverified; a Git push does not apply database migrations.
