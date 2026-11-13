# Working on this repo

- Stack and architecture: see `README.md`. Data access happens only in server functions (`src/api/`), never in components.
- **Schema changes** go in a new numbered file in `db/migrations/` and are applied to the Neon `dev` branch, tested, then applied to `production`. Never edit an applied migration.
- Every new tenant table needs a `business_id`, composite foreign keys to `(business_id, id)`, RLS with `app_business()`, and role rules (`app_role()`) for writes.
- Business logic that changes several rows (stock, payments, sales) belongs in a SQL function that runs in one transaction.
- Money is `numeric(14,2)`; quantities `numeric(14,3)`. Never use floats for stored money.
- Do not fabricate transactions, stock or financial figures. Distinguish demo data from real data.
- Before pushing: `npm run lint && npx tsc --noEmit && npx vitest run && npx vite build`.
- Push verified changes to both `neon-migration` (preview) and `main` (production). Do not rewrite published history.
- Never commit secrets; `.env` is git-ignored.
