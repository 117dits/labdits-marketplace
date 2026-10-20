# Public LABDITS demos (Lovable)

LABDITS is the **catalog and viewer**, not a general-purpose build host. A product with slug `dashboardkeren` has a friendly viewer URL at `https://labdits.lovable.app/dashboardkeren` once **this repository is deployed/synced to Lovable**. Its actual app must be hosted at a separate public HTTPS origin, for example `https://dashboardkeren.example.com`. The viewer embeds that URL and offers an open-in-new-tab link. `/demo/dashboardkeren` remains a compatible viewer route.

## First public workflow (no arbitrary code execution)

1. Build and deploy the website independently on a provider that supports its framework. Configure its own environment and database there; do not put private credentials in the uploaded bundle. Confirm its URL works from another device on HTTPS. If it blocks iframe embedding via CSP `frame-ancestors` or `X-Frame-Options`, visitors use the external open link instead.
2. Sign in to LABDITS with a Supabase Auth user that has the `admin` role in `public.user_roles`. The existing migration defines the role and RLS; role assignment must be performed through a trusted admin process, **not** by exposing a service/secret key to the browser.
3. Add a product with a unique, non-reserved slug. Upload project files only if you want to retain/analyze source; selection/upload alone does **not** host them on Lovable. Continue to Demo configuration and enter the public HTTPS URL, using Embedded website mode. Save/publish after readiness checks.
4. Check the product in a fresh browser session at `https://labdits.lovable.app/<slug>`. Ensure the product is actually in Supabase, not just in local browser storage; test on a second device. Check iframe *and* open-in-new-tab.

## Automated uploaded-source hosting is a separate backend project

`VITE_LABDITS_API_URL` currently points to a deployment API adapter. The included `scripts/local-deployment-server.mjs` binds loopback and runs npm install/build on the local machine; it is **not safe to expose publicly** (no production auth or isolated build worker). Lovable cannot turn arbitrary ZIP/TypeScript uploads into hosted websites merely by adding dependencies to its frontend. A production worker needs authenticated upload, archive limits/path validation, sandboxed builds with CPU/memory/time/network restrictions, immutable static artifact storage, dedicated preview origins and a verified HTTPS health check. SSR, backend and databases require additional isolation. Do not set a secret/service key as `VITE_*` or commit it in `.env`.

## Release checks

- `npm test` and `npm run build` with Node >=22.12 (this repo's TanStack dependencies require it).
- Publish only a product with a reachable public demo. A local `127.0.0.1` preview does not qualify.
- Sync/push the reviewed branch to the connected Lovable repository, deploy there, then verify the **public** URL. A local build alone does not update `labdits.lovable.app`.
- The checkout/orders experience is still a prototype; public demos do not imply working payments.
