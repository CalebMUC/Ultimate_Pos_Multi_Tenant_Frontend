# Ultimate POS frontend

Next.js 14 (App Router) client for the Ultimate POS API (`F:\Ultimate_Multi_Tenant_V2_POS`).

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

The browser calls `/api/v1` on the same origin, and `next.config.mjs` proxies it to the API (`API_PROXY_TARGET`, default
`http://localhost:5062`), so CORS isn't needed in development. To call the API directly instead, set
`NEXT_PUBLIC_API_BASE_URL` to its full URL and add this origin to the API's `Cors:AllowedOrigins`. See `.env.example`.

| Script | |
|---|---|
| `npm run build` / `npm start` | production build and server |
| `npm test` | unit tests (Vitest + MSW) |
| `npm run typecheck`, `npm run lint` | checks |

## How it is put together

- `src/api`: the only place that talks HTTP. `client.ts` unwraps the `{ success, data, error, meta }` envelope, turns errors into
  `ApiError` (field errors mapped to form paths), and refreshes the session once for concurrent 401s (refresh tokens rotate).
  `mappers.ts` turns DTO fields the API sends as display strings into enums.
- `src/stores`: session (access token in memory only), per-business POS cart (session storage), device preferences.
- Query keys are `[resource, businessId, params]` and every cache, cart and profile is cleared on business switch.
- Menus and pages are gated by permission (`Can`, `PermissionRoute`, `src/config/navigation.ts`). The API enforces permissions.
- What a business uses comes from the API as `modules` (worked out from its sector and kind) on the sign-in memberships and on
  `GET /businesses/current`. `useActiveBusiness().hasModule(key)` reads it; nothing in the frontend maps sectors to menus. A menu item
  or page needs its module **and** its permission (`module` on nav items and `PermissionRoute`); a missing module shows "Not used by
  this business". Modules only hide setup and entry points: a batch-tracked or prescription-only product, or a pack with a container,
  still gets its fields. The profile is re-read on focus and after a token refresh, so a reclassified business sees its new menus
  without signing out. `src/config/sectors.ts` holds only the registration form's suggestions (kind, overselling default).
- The POS never computes prices: every line is priced by `POST /sales/preview`. Sales are never retried automatically.
