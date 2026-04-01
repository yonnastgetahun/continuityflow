import { expect, test } from '@playwright/test';

test('new user can sign up and is gated by Continuity access control', async ({ page }) => {
  const email = `continuity.e2e.${Date.now()}@example.com`;
  const password = 'ContinuityQA!2026';

  await page.goto('/');
  await expect(page).toHaveTitle(/Continuity/i);
  await expect(page.getByText('Start Free Trial')).toBeVisible();
  await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

  await page.getByRole('button', { name: 'Create one' }).click();
  await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`Signed in as: ${email}`)).toBeVisible();
  await expect(page.getByText(/currently limited to authorized accounts only/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to home' })).toBeVisible();
});
