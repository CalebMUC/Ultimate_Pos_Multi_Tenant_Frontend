import { expect, test, type Page } from '@playwright/test';

// Needs a dev API with:
//  E2E_EMAIL / E2E_PASSWORD   a user with PurchaseOrders.Create, Sales.Create and AuditLog.View, member of two businesses;
//  E2E_SKU                    a finished good in the first business, priced, whose stock falls below its reorder level
//                             after selling E2E_QUANTITY (default 1) and that is not already alerted;
//  E2E_OTHER_BUSINESS         the name of the user's second business.
const env = (name: string) => {
  const v = process.env[name];
  if (!v) test.skip(true, `${name} is not set`);
  return v!;
};

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(env('E2E_EMAIL'));
  await page.getByLabel('Password').fill(env('E2E_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  if (page.url().includes('/select-business')) {
    await page.locator('ul button').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/select-business'));
  }
}

const bell = (page: Page) => page.getByRole('button', { name: /^Notifications, \d+ unread$/ });
async function unreadCount(page: Page) {
  const label = await bell(page).getAttribute('aria-label');
  return Number(/(\d+) unread/.exec(label ?? '')?.[1] ?? 0);
}

test('a sale below the reorder level notifies, links to the stock, and is audited per business', async ({ page }) => {
  const sku = env('E2E_SKU');
  const otherBusiness = env('E2E_OTHER_BUSINESS');
  await signIn(page);
  await expect(bell(page)).toBeVisible();
  const before = await unreadCount(page);

  // Sell the product for cash.
  await page.goto('/pos');
  const search = page.getByLabel('Product search');
  await search.fill(sku);
  await search.press('Enter');
  const quantity = process.env.E2E_QUANTITY ?? '1';
  if (quantity !== '1') await page.getByLabel('Quantity').first().fill(quantity);
  const charge = page.getByRole('button', { name: /^Charge/ });
  await expect(charge).toBeEnabled();
  await charge.click();
  await page.getByRole('button', { name: 'Exact' }).click();
  await page.getByRole('button', { name: /^Complete sale/ }).click();
  const receiptTitle = page.getByRole('heading', { name: /^Sale .+ complete$/ });
  await expect(receiptTitle).toBeVisible();
  const saleNumber = /^Sale (.+) complete$/.exec((await receiptTitle.textContent()) ?? '')![1];
  await page.getByRole('button', { name: 'New sale' }).click();

  // Within about 10 s the worker notifies and the bell picks it up.
  await expect.poll(() => unreadCount(page), { timeout: 20_000 }).toBeGreaterThan(before);
  await bell(page).click();
  await page.getByRole('dialog').getByText(/Low stock|Out of stock/).first().click();
  await expect(page).toHaveURL(/\/inventory\?productId=/);
  await expect(page.getByText(/^Showing /)).toBeVisible();

  // The sale is in the audit log...
  await page.goto('/admin/audit-log');
  await page.getByLabel('Search').fill(saleNumber);
  await expect(page.getByRole('row', { name: new RegExp(saleNumber) }).first()).toBeVisible();

  // ...and neither the notification nor the entry shows in the other business.
  await page.getByRole('button', { name: 'Switch business' }).click();
  await page.getByRole('menuitem', { name: new RegExp(otherBusiness) }).click();
  await expect(page.getByRole('button', { name: 'Switch business' })).toContainText(otherBusiness);
  await page.goto('/admin/audit-log');
  await page.getByLabel('Search').fill(saleNumber);
  await expect(page.getByText('Nothing recorded')).toBeVisible();
  await bell(page).click();
  await expect(page.getByRole('dialog').getByText(new RegExp(sku))).toHaveCount(0);
});
