# Kioo POS (Imarapos)

A multi-tenant POS and business-management app for SMEs in Kenya: inventory, suppliers, sales, customers, payments and reporting, with row-level data isolation per business.

**Stack:** TanStack Start (React 19, Vite, Nitro) · Neon Postgres + Neon Auth (managed Better Auth) · Tailwind 4 + shadcn/ui · Vercel.

## Status
Done: sign-in, business setup, roles, inventory (products, categories, stock adjustments with history, edit/archive), suppliers.
Next: staff invites, sales and checkout, customers and credit, M-Pesa, reports, PWA/offline. See `roadmap.md`.

## How it works
- The browser never talks to the database. Server functions in `src/api/functions.ts` verify the caller's Neon Auth JWT (`src/server/verify-token.ts`), then run in one transaction as the restricted `imarapos_app` role (`src/server/db.ts`).
- Every transaction sets `app.user_id` and `app.business_id`. Postgres row-level security uses them to isolate each business and to enforce roles (`owner`, `manager`, `cashier`), so a missed filter in code cannot leak or modify another business's data.
- Business rules that must be atomic live in SQL functions (`create_business`, `add_product_with_stock`, `adjust_inventory`, `update_product`, `accept_invite`, `update_member`, `list_team`).

## Environments
| Vercel env | Git branch | Neon branch |
|---|---|---|
| Production | `main` | `production` |
| Preview | `neon-migration` and other branches | `dev` |

Push every change to both `neon-migration` and `main` once it is verified.

## Environment variables
See `.env.example`. `NEON_AUTH_URL` and `DATABASE_URL` are server-only. `VITE_NEON_AUTH_URL` is baked into the client at build time, so redeploy after changing it. Use the pooled connection string for the `imarapos_app` role, never the owner role.

## Database migrations
Plain SQL in `db/migrations/`, applied in order to the `dev` branch first, then `production`. Neon Auth must be enabled on the branch first because tables reference `neon_auth."user"`.

## Develop
```bash
npm install
cp .env.example .env   # fill in the dev branch values
npm run dev
npm run lint && npx tsc --noEmit && npx vitest run
```

## Security notes
- Never commit `.env`. Rotate database passwords if they are shared.
- Cashiers can read data but cannot change products, stock, suppliers or team (enforced in the database as well as the UI).
- Payments must never be marked confirmed without a payment time; provider callbacks will be the only path to `confirmed` for M-Pesa.
