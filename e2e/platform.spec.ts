import { expect, test, type Browser, type Page } from '@playwright/test';

// Against a dev API with the seeded Super User. Every run registers a NEW business (unique name, KRA PIN and owner email),
// then suspends, reactivates and licenses it. Run it only against a development database.
const SUPER = { email: process.env.E2E_SUPER_EMAIL ?? 'superuser@ultimatepos.local', password: process.env.E2E_SUPER_PASSWORD ?? 'SuperUser@12345' };
const stamp = Date.now().toString().slice(-9);
const business = { name: `E2E Duka ${stamp}`, kraPin: `P${stamp.padStart(9, '0')}X` };
const owner = { name: `E2E Owner ${stamp}`, email: `e2e.owner.${stamp}@example.test`, newPassword: `Owner${stamp}a` };

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test.describe.serial('Super User: register, force a password change, suspend, license', () => {
  let superPage: Page;
  let ownerPage: Page;
  let temporaryPassword = '';
  let businessUrl = '';

  test.beforeAll(async ({ browser }) => {
    superPage = await newPage(browser);
    ownerPage = await newPage(browser);
  });

  test('the Super User lands in the platform and registers a business with a new owner', async () => {
    await signIn(superPage, SUPER.email, SUPER.password);
    await expect(superPage).toHaveURL(/\/platform$/);
    await expect(superPage.getByText('Platform', { exact: true })).toBeVisible();

    await superPage.goto('/platform/businesses/new');
    await superPage.getByLabel(/Registered name/).fill(business.name);
    await superPage.getByLabel(/KRA PIN/).fill(business.kraPin);
    await superPage.getByRole('button', { name: /Next/ }).click();
    await superPage.getByLabel(/Full name/).fill(owner.name);
    await superPage.getByLabel(/^Email/).fill(owner.email);
    await superPage.getByRole('button', { name: /Next/ }).click();
    await superPage.getByRole('button', { name: 'Register business' }).click();

    temporaryPassword = ((await superPage.getByTestId('temporary-password').textContent()) ?? '').trim();
    expect(temporaryPassword.length).toBeGreaterThan(5);
    await superPage.getByRole('link', { name: 'Open business' }).click();
    await superPage.waitForURL(/\/platform\/businesses\/[0-9a-f-]+/);
    businessUrl = superPage.url().split('?')[0];
  });

  test('the owner signs in with the temporary password and must change it', async () => {
    await signIn(ownerPage, owner.email, temporaryPassword);
    await expect(ownerPage).toHaveURL(/\/change-password/);
    // Nothing else is reachable first.
    await ownerPage.goto('/sales');
    await expect(ownerPage).toHaveURL(/\/change-password/);

    await ownerPage.getByLabel('Current password').fill(temporaryPassword);
    await ownerPage.getByLabel('New password', { exact: true }).fill(owner.newPassword);
    await ownerPage.getByLabel('Confirm new password').fill(owner.newPassword);
    await ownerPage.getByRole('button', { name: 'Change password and continue' }).click();
    await ownerPage.waitForURL((url) => !url.pathname.startsWith('/change-password'));
    await expect(ownerPage).not.toHaveURL(/\/platform/);
  });

  test('suspending the business blocks the owner’s next request', async () => {
    await superPage.goto(businessUrl);
    await superPage.getByRole('button', { name: 'Suspend' }).click();
    await superPage.getByLabel(/Reason/).fill('E2E: licence fee unpaid');
    await superPage.getByRole('button', { name: 'Suspend business' }).click();
    await expect(superPage.getByText('Suspended', { exact: true }).first()).toBeVisible();

    await ownerPage.goto('/products');
    await expect(ownerPage).toHaveURL(/\/blocked\?code=BUSINESS_SUSPENDED/);
    await expect(ownerPage.getByRole('heading', { name: 'This business is suspended' })).toBeVisible();
    await expect(ownerPage.getByText(/E2E: licence fee unpaid/)).toBeVisible();
  });

  test('reactivating and issuing a 12-month licence extends the end date', async () => {
    await superPage.goto(businessUrl);
    await superPage.getByRole('button', { name: 'Reactivate' }).click();
    await superPage.getByRole('button', { name: 'Reactivate', exact: true }).last().click();
    await expect(superPage.getByRole('button', { name: 'Suspend' })).toBeVisible();

    const before = await superPage.locator('main').getByText(/Licence to /).first().textContent();
    await superPage.goto(`${businessUrl}?tab=licenses`);
    await superPage.getByRole('button', { name: /Renew licence|Issue licence/ }).last().click();
    await superPage.getByLabel('Plan').fill('Standard');
    await superPage.getByLabel('Amount (KES)').fill('12000');
    await superPage.getByLabel('Paid by').selectOption({ label: 'Cash' });
    const preview = (await superPage.getByTestId('license-period').textContent()) ?? '';
    expect(preview).toContain('continues from the current licence');
    await superPage.getByRole('button', { name: 'Save licence' }).click();

    await expect(superPage.getByRole('cell', { name: 'Standard' })).toBeVisible();
    const after = await superPage.locator('main').getByText(/Licence to /).first().textContent();
    expect(after).not.toEqual(before);
  });
});
