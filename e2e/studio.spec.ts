import { expect, test } from '@playwright/test';
import { createInitialState } from '../src/state';

const key = 'exercise-biomechanics-lab.comparison.v1';
test.beforeEach(async ({ page }) => { await page.goto('/#toString'); await expect(page.getByRole('heading', { name: 'Compare the mechanics.', exact: true })).toBeVisible(); });

test('command search routes a chosen exercise to B and restores that workspace after reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Find a tool or exercise', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Command exercise target').selectOption('1');
  const query = dialog.getByRole('combobox', { name: 'Search tools and exercises' });
  await query.fill('barbell row'); await query.press('Enter');
  await expect(page.getByRole('button', { name: 'Compound movements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('B compound exercise', { exact: true })).toHaveValue('row-barbell');
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('biomechanics.compound-workbench.v1'))).not.toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Compound movements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('B compound exercise', { exact: true })).toHaveValue('row-barbell');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('inspector edits remain independent, switch sides deliberately, and return focus when closed', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Edit setup A', exact: true });
  await opener.click();
  const inspector = page.getByRole('complementary', { name: 'Setup inspector', exact: true });
  await expect(inspector).toBeVisible();
  const height = inspector.getByLabel('A · Pulley height value', { exact: true });
  await height.fill('190'); await height.press('Tab');
  await expect.poll(async () => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey) ?? '{}').setups?.[0]?.pulleyHeight, key)).toBe(1.9);
  await inspector.getByRole('button', { name: 'Configuration B', exact: true }).click();
  await expect(inspector.getByLabel('B · Pulley height value', { exact: true })).toHaveValue(String(createInitialState().setups[1].pulleyHeight * 100));
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden(); await expect(opener).toBeFocused();
  await page.locator('.analysis-workbench > summary').click();
  await expect(page.getByRole('region', { name: 'Comparison analysis', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('study starters and library remain reachable from keyboard command search on narrow screens', async ({ page }) => {
  await page.getByRole('button', { name: 'New study', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Start a study', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Lateral raise: cable versus dumbbell', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close Start a study' }).click();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Search tools and exercises' });
  await search.fill('Library & backup'); await search.press('Enter');
  const library = page.getByRole('dialog', { name: 'Library & backup', exact: true });
  await expect(library).toBeVisible();
  await library.getByRole('button', { name: 'Close Library & backup' }).click();
  await page.getByRole('button', { name: 'Find a setup & research', exact: true }).click();
  await expect(page.getByLabel('Search objective', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
