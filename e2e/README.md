# End-to-end tests

They run in a real browser against the dev API, so they need the API, its database and seeded data.

```bash
npx playwright install chromium        # once
# with the API running on http://localhost:5062:
E2E_EMAIL=… E2E_PASSWORD=… E2E_SKU=… E2E_OTHER_BUSINESS="…" npm run e2e
```

| Variable | |
|---|---|
| `E2E_EMAIL`, `E2E_PASSWORD` | A user with `Sales.Create`, `PurchaseOrders.Create` and `AuditLog.View`, belonging to two businesses. |
| `E2E_SKU` | A priced finished good in the first business that drops below its reorder level when `E2E_QUANTITY` (default 1) is sold, and has no open low-stock alert. |
| `E2E_OTHER_BUSINESS` | The name of the user's second business. |
| `E2E_BASE_URL` | Optional: test a frontend that is already running instead of starting `npm run dev`. |

Tests skip themselves when a variable is missing.

## Platform (`platform.spec.ts`)

Uses the seeded dev Super User (`superuser@ultimatepos.local` / `SuperUser@12345`, or `E2E_SUPER_EMAIL` / `E2E_SUPER_PASSWORD`).
Each run **registers a new business and owner** in the database, then suspends, reactivates and licenses it, so run it against a
development database only.
