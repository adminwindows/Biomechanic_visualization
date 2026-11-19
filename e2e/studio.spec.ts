import { goWorkspace, openDialog } from './studio-helpers';
import { expect, test } from '@playwright/test';
import { createInitialState } from '../src/state';

const key = 'exercise-biomechanics-lab.comparison.v1';
test.beforeEach(async ({ page }) => { await page.goto('/#toString'); await expect(page.getByRole('heading', { name: 'Compare exercises', exact: true })).toBeVisible(); });

test('command search routes a chosen exercise to B and restores that workspace after reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Find a tool or exercise', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Command exercise target').selectOption('1');
  const query = dialog.getByRole('combobox', { name: 'Search tools and exercises' });
  await query.fill('barbell row'); await query.press('Enter');
  await expect(page.locator('#compound-lab')).toBeVisible();
  await expect(page.getByLabel('B compound exercise', { exact: true })).toHaveValue('row-barbell');
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('biomechanics.compound-workbench.v1'))).not.toBeNull();
  await page.reload();
  await expect(page.locator('#compound-lab')).toBeVisible();
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

test('examples and library are reachable from Tools and keyboard search on narrow screens', async ({ page }) => {
  await openDialog(page, 'Example comparisons');
  const dialog = page.getByRole('dialog', { name: 'Example comparisons', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Lateral raise: cable versus dumbbell', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close Example comparisons' }).click();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Search tools and exercises' });
  await search.fill('Library & backup'); await search.press('Enter');
  const library = page.getByRole('dialog', { name: 'Library & backup', exact: true });
  await expect(library).toBeVisible();
  await library.getByRole('button', { name: 'Close Library & backup' }).click();
  await goWorkspace(page, 'Explore setup changes');
  await expect(page.getByLabel('Search objective', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('chooses two compatible exercises without a setup or save step', async ({ page }) => {
  const a = page.getByRole('combobox', { name: 'Exercise A', exact: true });
  const b = page.getByRole('combobox', { name: 'Exercise B', exact: true });
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Comparison name' })).toBeHidden();
  await a.selectOption('raise-cable');
  await page.getByRole('button', { name: 'Search exercise B', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find exercise B', exact: true }).fill('dumbbell lateral raise');
  await page.getByRole('button', { name: 'Leaning dumbbell lateral raise', exact: true }).click();
  await expect(b).toHaveValue('raise-dumbbell');
  const table = page.getByRole('region', { name: 'Resistance comparison', exact: true }).getByRole('table');
  const torque = table.getByRole('row', { name: /External torque/ }).getByRole('cell');
  await expect(torque).toHaveCount(2);
  await expect(torque.first()).toContainText('N·m');
  await expect(torque.last()).toContainText('N·m');
  await expect(table.getByRole('row', { name: /Average resistance/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Applied load/ })).toBeVisible();
  await expect(b.locator('option[value="curl-low"]')).toHaveCount(0);
  await expect(page.locator('.curve-svg')).toHaveCount(1);
  await expect(page.locator('.setup-a .moment')).toContainText('N·m');
  await expect(page.locator('.setup-b .moment')).toContainText('N·m');
  await b.selectOption('raise-cable');
  await expect(b).toHaveValue(await a.inputValue());
  await a.selectOption('compound:row-seated');
  await b.selectOption('compound:row-standing');
  await expect(b.locator('option[value="compound:bench-barbell"]')).toHaveCount(0);
  await expect(page.locator('.compound-a .compound-value')).toBeVisible();
  await expect(page.locator('.compound-b .compound-value')).toBeVisible();
  await a.selectOption('curl-low');
  await expect(a).toHaveValue('curl-low');
  await expect(b).not.toHaveValue(/compound:/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
