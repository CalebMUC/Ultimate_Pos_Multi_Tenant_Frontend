# Backend gaps

Places where the Ultimate POS API (`F:\Ultimate_Multi_Tenant_V2_POS\src`) and the frontend build prompt disagree, or where the
API is missing something a screen needs. The API code wins; this file records the difference and the workaround.

## Found while building

| # | Area | Gap | Frontend workaround |
|---|------|-----|---------------------|
| 1 | POS / products | `GET /products/get-products` returns no prices. Product cards can't show a price without one more call per product. | Cards load `GET /products/{id}` (`ProductDetailDto`, needs only `Products.View`) and pick the latest price tier for the price type. `/sales/preview` stays the source of truth. A `currentPrice` (or price tiers) on `ProductDto` would remove N calls per grid page. |
| 2 | POS / units | `GET /products/{id}/unit-conversions` needs `Products.ManageUnitConversions`, which cashiers don't hold. | The POS reads active conversions from `ProductDetailDto.unitConversions`. |
| 3 | Roles | `RoleDto.permissions` are names, but `PUT /roles/{id}/permissions` takes permission **ids**. | The matrix joins names to ids through `GET /permissions`. |
| 4 | Receipts | `SalePrescriptionDto.dispensedBy` is a user id with no name. The prescription register has `dispensedByName`, the sale doesn't. | The receipt resolves the name from `GET /users` when the cashier may view users, else shows the cashier (`createdByName`), who is the dispenser. |
| 5 | Login | A remembered `businessId` the user no longer belongs to returns `403 FORBIDDEN` instead of falling back to the default business. | Login retries once without `businessId`. |
| 6 | Validation paths | Model-binding errors key fields as `lines[0].quantity`. | The client converts them to `lines.0.quantity` for react-hook-form. |

## Water refilling station onboarding (2026-10-19)

The API side is in `F:\Ultimate_Multi_Tenant_V2_POS\docs\WATER_REFILL_STATION_ONBOARDING.md` (§12 lists what the frontend needed) and
`docs/BACKEND_API_GAPS.md`. Done here:

| §12 item | Frontend change |
|---|---|
| 1. Allow negative stock | *Allow selling below zero stock* switch on Business settings and the registration wizard (sent as `allowNegativeStock`); shown on the platform business page. A missing value is read as `true`, the API default. |
| 2. Checkout stock rules | A short line blocks *Charge* only when it is batch-tracked or the business refuses negative stock; otherwise it is a warning ("stock will show below zero"). Before this, every short line blocked. A 409 `INSUFFICIENT_STOCK` keeps the cart and re-prices it so the short lines show. |
| 2. Quick keys | Pin a cart line (product + unit) as a POS quick key, e.g. 1L / 10L / 20L of one water product. Saved per device and business (`preferences.quickKeys`). |
| 3. Till payment taken | On 400 `INVALID_ASSIGNMENT` for a till sale the choice is cleared and the unmatched list reloads. |
| 4. Receive conflict | On 400 `INVALID_ASSIGNMENT` the order reloads and the rows show what is still outstanding; nothing left disables *Receive*. |
| 5. Double void | A failed void reloads the sale; if it is already voided the dialog closes with a note. |
| 6. Sales report | *By cashier* and *Sales by size* (`byCashier`, `topProductUnits`), with CSV. |
| 7. New customer at checkout | *Register new customer* button beside the POS customer picker (`Customers.Register`): name and phone, then the sale uses the new customer. No client-side phone workaround existed. |
| 8. Dashboard | A *Today* row: sales, supplies received, expenses, owed to suppliers, and for the day's best sellers the quantity sold against stock left (litres for water). Each card needs the permission of its endpoint. |

Delivery orders and containers (onboarding §12 items 9–13, 2026-10-20):

| § | Frontend change |
|---|---|
| 9. Container toggle | The container for each refill size is set on the product page (*Container* on a pack unit; API `PUT /products/{id}/unit-conversions/{id}/container`) and read from `unitConversions[]`. *Customer has a container* on the cart and the delivery form: off adds a container line under each such refill, kept at the refill's quantity. Inactive containers are never added. Pack units only (not the base unit). |
| 10. Delivery orders | *Deliveries* board (Pending / Out for delivery / Delivered today, plus an all-orders table), *New delivery order* (customer picker with register, address, phone, quick keys, container toggle, estimated total from `/sales/preview`), *Dispatch* (rider name), *Cancel* (reason), *Record delivery* (edit lines, Cash with change, M-Pesa till, or *Pay later*), *Rider cash-up*. |
| 10, 12, 13. Pay later | As agreed with the owner, kept simple: **pay later is an ordinary credit sale on the customer's ledger account**. No promise date is asked for, so there is no date picker at the counter and no promise column in ageing. The API was changed to make `paymentDueDate` optional on a credit delivery; *Pay later* still needs `DeliveryOrders.AcceptCredit` (managers). |
| 11. Stock | Stock levels show *On delivery orders* and *Available*; product and adjustment pages and the dashboard show held stock; transfers offer only available stock. |

Still open on the API (from `docs/BACKEND_API_GAPS.md`), so no screen exists for them:

- **R1** cancel of a purchase order is not locked against a receipt; **R2** no unique index on `MpesaReceiptNumber`. Both marked "fix soon".
- **G7** close a purchase order short, **G10** daily cash-up report: recommended for the station.
- G1 bank transfer at the counter (deferred by the owner), G2 split payments, the rest of G4 (delivery fee, time slots, proof of delivery),
  G6 maintenance log, G11 approvals, G15 customer prices: need owner decisions. G3/G4 delivery orders are built; G5 deposits are not
  used (containers are sold).
- G8, G9, G12, G13, G14, G16: optional.

## Invoices for unpaid credit sales (2026-11-04)

The water refill station bills customers who pay later (a Sacco taking refills through the month). A printable A4 invoice, logo
centred, opens from *Invoice* on a credit sale's page and on a customer's page (every unpaid credit sale, oldest first). What is
still owed comes from `GET /reports/customer-aging?customerId=…&includeInvoices=true`.

*Send payment to* and the terms are the business's (API `docs/Frontend-Invoice-Payment-Details-Prompt.md`, migration
`BusinessInvoicePaymentDetails`): `PUT /businesses/current/invoice-settings` (`Businesses.Update`, a full replace of nine fields),
optional `invoice` on `POST /businesses`, returned as `BusinessDto.invoice`. Bank name and branch, account name and number, the
bank's paybill, a Buy Goods till, a send-money phone; days to pay and a note. Edited on *Settings → Invoices* (read-only with
`Businesses.View`, with a live preview and *Clear all*), under *Payment details* in the invoice dialog, and on the optional
*Payment details* step of the register wizard. Printed on invoices and on credit-sale receipts (80 mm and A4), never on paid ones.
Printed only: never filled from, or in place of, the M-Pesa till and paybill that route payments. With no bank, till or phone set the
block is left off. An older API (no `invoice`) gets a note on the form instead of a Save.

A reprinted receipt of a credit sale that has since been paid still carries the block: the receipt does not ask the aging report.

Client logos can ship with the frontend under `public/tenants/<client>/` and be set as the business's Logo URL (there is no upload
endpoint). Aqua Hub: `public/tenants/aqua-hub/logo.png`.

| Gap | Frontend workaround |
|---|---|
| No invoice record for a customer's account invoice. | Numbered `ACC-yymmdd-XXXX` (day + start of the customer id): not stored, but the same all day, so a reprint matches. A one-sale invoice uses the sale number (`INV-…`). |
| Aging needs `CustomerReports.View`. | Without it a sale's invoice shows its whole total as due, and the customer's invoice is not offered. |

## Age-restricted sales and the Liquor sector (2026-11-05)

API `docs/Frontend-Liquor-Age-Check-Prompt.md`, migrations `LiquorAgeRestrictedSales` and `AgeRestrictedSalesSwitch`. Liquor
businesses only, and each can switch it off: *Use age-restricted sales* on *Settings → Age-restricted sales* sends
`ageRestrictedSales.enabled` (the API was changed for this: a `Businesses.AgeRestrictedSalesEnabled` column, on by default; `true`
outside Liquor is a 400). Off means off: the API drops the `ageRestricted` module and stops the age check and the hours, and the
frontend hides the 18+ chips, toggle, filter and register; products keep their mark for when it is back on. With the module on, it
shows the *Age-restricted (18+)* product toggle and list filter, the minimum age and selling hours (`Businesses.Update`) and
*Reports → Age-check register* (`SalesReports.View`). Wherever the preview says
`requiresAgeCheck`, *Pay* first asks how the age was checked (one tap, never pre-selected or remembered, nothing typed) and sends
`ageCheck`; a 422 `AGE_CHECK_REQUIRED` from an older preview asks and resends. Outside the hours (`withinSellingHours: false`) the cart
shows a red banner and *Pay*, or *Send with rider*, stays disabled; taking a delivery order without a rider is still allowed. *Complete
sale* on a delivery asks how the rider checked the age at the door. Receipts print *Age checked: …*. Liquor businesses start new
products age-restricted, and their container toggle reads *Customer brought a crate of empties?*.

| Gap | Frontend workaround |
|---|---|
| `DeliveryOrderLineDto` has no `isAgeRestricted`, so a delivery order does not say whether it carries alcohol. | The ids of every age-restricted product are loaded once (`GET /products/get-products?isAgeRestricted=true`, 200 a page, cached 5 min) and matched against the order's lines for the *18+: see ID before handing over* line on the delivery note and the board card. Needs `Products.View`; without it the line is left off (the API still asks for the age check when the delivery is recorded). *Complete sale* uses the sale preview's `requiresAgeCheck` instead. An `isAgeRestricted` on the order line (or the order) would remove the extra call. |
| `DeliveryTripOrderDto` has no lines. | The trip list on *Trips & fuel* carries no 18+ mark; the board and the delivery note do. |
| `GET /sales/age-checks` takes no `branchId` (the prescription register does). | The register has no branch filter: it lists what the API returns for the caller. |

## Not supported by the API yet (from the build prompt §17)

- KRA eTIMS submission and control numbers (an empty `<EtimsBlock />` slot stays on the receipt).
- Bulk-import columns for barcode, batch tracking and medicine fields.
- A sales report netted for returns and excluding VAT (use Profit & Loss).
- Split or partial payments; card payments at the POS.
- Customer groups, brands, product images.
- Branches, locations, stock transfers.
- Purchase returns to suppliers; posting a supplier bill reversal.
- Forgot-password email and self-service sign-up.
- Notifications, server-side settings, server-side export or PDF.
- Till sessions (open/close, supervisor approval).
- Field-keyed errors everywhere (older rules still return a single `INVALID_ASSIGNMENT` message).
