import path from 'node:path';
import { expect, test } from '@playwright/test';

const authorizedEmail = process.env.E2E_AUTHORIZED_EMAIL;
const authorizedPassword = process.env.E2E_AUTHORIZED_PASSWORD;
const fixtureInvoice = path.resolve(new URL('./fixtures/invoice-simple.pdf', import.meta.url).pathname);

test.describe('authorized upload and review flow', () => {
  test.skip(!authorizedEmail || !authorizedPassword, 'Set E2E_AUTHORIZED_EMAIL and E2E_AUTHORIZED_PASSWORD to run authorized flow tests.');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('authorized user can log in, upload an invoice, and reach review', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(authorizedEmail!);
    await page.getByLabel('Password').fill(authorizedPassword!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/upload$/);
    await page.getByTestId('invoice-file-input').setInputFiles(fixtureInvoice);
    await page.getByTestId('extract-button').click();

    await expect(page.getByTestId('review-heading')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByDisplayValue('Test Vendor LLC')).toBeVisible();
    await expect(page.getByDisplayValue('2026-03-30')).toBeVisible();
    await expect(page.getByDisplayValue('150.00')).toBeVisible();
  });

  test('authorized user can request enhanced accuracy and see extraction summary in review', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(authorizedEmail!);
    await page.getByLabel('Password').fill(authorizedPassword!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/upload$/);
    await page.getByTestId('enhanced-accuracy-toggle').click();
    await page.getByTestId('invoice-file-input').setInputFiles(fixtureInvoice);
    await page.getByTestId('extract-button').click();

    await expect(page.getByTestId('review-heading')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('extraction-summary-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Extraction Summary/i)).toBeVisible();
  });
});
