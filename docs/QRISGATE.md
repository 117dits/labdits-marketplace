# QRISGate backend integration

This request explicitly adds a production backend to the frontend-only prototype in `AGENTS.md`. Nothing here deploys automatically. The browser must never receive `QRISGATE_API_KEY`, `QRISGATE_WEBHOOK_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`.

## Setup (operator only)

1. Review and apply `supabase/migrations/20261110000000_qrisgate.sql` to the intended Supabase database using your normal migration workflow. Test in staging first. Do not apply migrations to production without a backup.
2. Configure Edge Function secrets `QRISGATE_API_KEY`, `QRISGATE_WEBHOOK_SECRET`, `QRISGATE_ALLOWED_ORIGIN` (exact HTTPS storefront origin, no trailing slash), and Supabase-provided `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never place these in `VITE_` variables or git. Missing values return HTTP 503.
3. Deploy `qrisgate-api` with **JWT verification disabled for this function** (e.g. `supabase functions deploy qrisgate-api --no-verify-jwt` after review). This is mandatory because the webhook has no Supabase JWT. The function checks a Supabase user JWT itself for checkout/status and independently checks the webhook HMAC. No deployment was performed here.
4. Set QRISGate dashboard webhook URL to `https://<project-ref>.supabase.co/functions/v1/qrisgate-api/webhook`. Confirm the secret is the same one configured in the function. Verify dashboard callback/return URLs allow `https://<storefront>/order/<order_id>`.
5. Run `npx vitest run src/test/qrisgate-backend.test.ts src/test/qrisgate-schema.test.ts`; test authenticated checkout, duplicate webhook, replay, bad signature, and owner/non-owner status against staging before enabling purchases. Local database integration requires a working Postgres/Supabase stack; the included schema tests are static and do not replace DB integration testing.

## Browser contract

`POST /functions/v1/qrisgate-api/checkout`: `Authorization: Bearer <Supabase user access token>`, `apikey: <Supabase public/publishable key>`, body `{ "items":[{"productId":"1","license":"personal","quantity":1}],"customer_name":"...","customer_whatsapp":"...","payment_method":"QRIS","return_url":"https://<storefront>/account/orders" }`. `license` is `personal`, `commercial`, or `installation`; quantity 1–10; 1–20 lines. Prices are read transactionally from published `public.products.data.price`, `.commercialPrice`, or `.installationPrice` as integer rupiah. The submitted return URL is origin-checked; the backend supplies QRISGate a return URL of `<allowed-origin>/order/<generated-order-id>`. Success (201): `{order_id,transaction_id,checkout_url,total_amount,expires_at}`. `QRIS` dan `BANK_TRANSFER` diteruskan ke provider sesuai pilihan pembeli; pemilihan `bank_code` spesifik belum tersedia di UI. Provider HTTP 400/402/429 are passed as status codes with sanitized messages; provider payloads and secrets are not returned.

`GET /functions/v1/qrisgate-api/status?order_id=<id>` with the same headers returns `{order_id,status,total_amount,expires_at,checkout_url}` for the authenticated owner only. Status strings are `Initializing`, `Pending`, `Paid`, `Expired`, `Cancelled`, or `Failed` (case-sensitive). On `Pending`, the server attempts QRISGate `GET /api/v1/transactions/{id}` and applies a matching terminal response atomically; if the provider is unavailable, it returns the locally persisted state. Polling requires matching `transaction_id`, `external_order_id`, `base_amount`, and `total_amount`; no browser-supplied status can mark an order Paid. Do not treat the return redirect or checkout page as payment confirmation.

`POST /functions/v1/qrisgate-api/webhook` is public but requires `X-QRISGate-Timestamp` (Unix seconds), `X-QRISGate-Signature` (hex SHA-256, optionally `sha256=` prefixed), and `X-QRISGate-Delivery-Id`. It verifies HMAC over the **exact** `timestamp + '.' + raw body` bytes with a five-minute replay window and fixed-length comparison. Payload is flat: `event`, `external_order_id`, `transaction_id`, `base_amount`, `total_amount`, `paid_at`. The signed delivery ID is unique in the database; the RPC locks the order and payment, checks transaction ID and amounts, and changes only `Pending` to a terminal state. Duplicate or late terminal callbacks cannot overwrite Paid. Signature verification must occur before JSON parsing.

## End-to-end test walkthrough

1. `npm run test -- --run` → semua test harus hijau (8 unit + tes backend).
2. Deploy Edge Function: `npx supabase functions deploy qrisgate-api --no-verify-jwt`
3. Tambah produk ke keranjang → checkout → pilih QRIS/Transfer Bank → isi nama & WA → **Buat Tagihan QRISGate**.
4. Browser diarahkan ke `https://qrisgate.web.id/pay/trx_...` — bayar nominal **tepat** (sertakan kode unik Rp 1–10).
5. Webhook masuk → DB berubah `Paid`. Halaman `/order/<id>` menampilkan status lunas secara polling (3 s).
6. **Fallback tanpa webhook:** halaman `/order/<id>` polling `GET /status?order_id=...` yang di-server-side menarik status dari QRISGate API jika state masih `Pending`.

## Error codes

| Kode HTTP | Penyebab | Tindakan |
|---|---|---|
| 503 | Env secret belum diset | Set secrets, redeploy |
| 402 | Saldo kredit merchant habis | Top up di dashboard QRISGate |
| 400 | `return_url` tidak diizinkan / validasi gagal | Periksa `QRISGATE_ALLOWED_ORIGIN` |
| 401 | Signature webhook salah atau replay >5 menit | Cocokkan `QRISGATE_WEBHOOK_SECRET` |
| 502 | QRISGate unreachable | Coba lagi; fallback polling memperbaiki |

## File yang dimodifikasi / dibuat

| File | Peran |
|---|---|
| `supabase/functions/qrisgate-api/index.ts` | Edge Function entry |
| `supabase/functions/qrisgate-api/logic.ts` | Handler logic (testable) |
| `supabase/migrations/20261110000000_qrisgate.sql` | Skema DB, RPC, trigger, RLS |
| `src/services/qrisgate-service.ts` | Browser service → Edge Function |
| `src/components/views/qrisgate-order.tsx` | Halaman status pesanan `/order/$id` |
| `src/routes/order.$id.tsx` | Route TanStack Router |
| `src/components/views/commerce.tsx` | Checkout frontend |
| `src/components/admin/admin-pages.tsx` | Opsi mode pembayaran di admin |
| `src/test/qrisgate-client.test.ts` | Unit test browser service |
| `src/test/qrisgate-ui.test.ts` | Boundary test UI |
| `src/test/qrisgate-backend.test.ts` | Unit test Edge Function handler |

## Operational cautions

- QRISGate's [published API docs](https://qrisgate.web.id/docs) explicitly specify `timestamp + '.' + rawBody`. A previously supplied `HMAC(rawBody)` example conflicts with those docs and is **not** implemented. The documented transaction creation response uses `data.transaction_id`, `checkout_url`, `base_amount`, `total_amount`, `unique_code`, `expires_at`; checkout validates amount arithmetic and gateway checkout URL. Docs show `POST /api/v1/transactions` and the webhook schema; confirm the actual GET transaction status values and payload in staging because that response is not shown in the cited docs. Polling is conservative and leaves Pending unchanged if values do not match.
- Database `orders.total` stores the buyer's provider total (base + unique code) after activation; `qrisgate_payments.base_amount` retains the catalog total. QRISGate's platform fee is merchant-funded. If the create request succeeds but its response is malformed or persistence fails, the order stays `Initializing` and needs manual reconciliation with QRISGate; never retry checkout blindly, because it could allocate a second transaction. Failed provider HTTP responses transition it to `Failed`.
- License issuance, downloads, entitlements, automated refunds, email notifications, and cleanup of stranded `Initializing` orders are **not** implemented. Paid is payment confirmation only; implement an idempotent fulfillment worker separately before real digital delivery. Rate limiting/anti-abuse and provider status contract verification should be completed before production launch.
- Public demo order/customer/item policies predate this backend. The migration adds write guards around real `orders` and `order_items` and service-role-only payment RPCs; legacy demo rows remain possible. Validate privileges and RLS with actual authenticated and anonymous users in staging.
- `[functions.qrisgate-api] verify_jwt = false` is required for HMAC-signed provider callbacks; the handler still authenticates checkout/status with a Supabase user token. Confirm this setting after deploy. Do not disable the handler's webhook signature verification.
- The paid callback takes precedence over an earlier expiry/cancellation only after the provider identity and amounts match. Provider response mismatch or a webhook arriving before checkout activation still requires manual reconciliation; inspect stranded `Initializing` orders and QRISGate transactions before enabling payment for buyers.
- The current account order/download page is legacy browser/mock state, not QRISGate fulfillment. Do not advertise automatic product delivery or release real purchases until owner-scoped order history, entitlements, and authorized product-specific downloads are implemented.
- Deployment prerequisite: a verified backup or staging rehearsal, project access for the Supabase CLI, and test payments covering webhook, retries, expiration, delayed paid events, and reconciliation. Local unit tests and a build are not a live-payment test.
