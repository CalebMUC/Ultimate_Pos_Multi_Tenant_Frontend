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
