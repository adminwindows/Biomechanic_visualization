import { test, expect, type Page } from '@playwright/test';
import { CALIBRATION_KEY, type CalibrationNotebook } from '../src/calibrationGuide';
import { STORAGE_KEY, type LabState } from '../src/state';

async function openGuide(page: Page) {
  await page.getByRole('button', { name: 'Measure & calibrate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Measure before you infer', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Measurement and calibration guide', exact: true })).toBeVisible();
}
async function provenance(page: Page, name: string) {
  await page.getByLabel('Measurement name', { exact: true }).fill(name);
  await page.getByLabel('Instrument and resolution', { exact: true }).fill('User test instrument; 1 mm or 0.1 N resolution as recorded');
  await page.getByLabel('Source, observer and measurement date', { exact: true }).fill('User test observations · 2026-10-28');
  await page.getByLabel('Actual measurement protocol', { exact: true }).fill('Repositioned independently for each reading; defined endpoints and fixed setup. Browser test data is synthetic, not empirical validation.');
}
const notebook = (page: Page): Promise<CalibrationNotebook> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), CALIBRATION_KEY);
const comparison = (page: Page): Promise<LabState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const flush = (page: Page) => page.evaluate(() => { const detail = { errors: [] as string[] }; window.dispatchEvent(new CustomEvent('biomechanics:flush-workspaces', { detail })); return detail.errors; });

test('records and applies body readings, preserves unfinished drafts, and imports without replacing records', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await openGuide(page);
  await expect(page.getByLabel('Repeated readings', { exact: true })).toHaveValue('');
  await provenance(page, 'Upper-arm repeat test');
  await page.getByLabel('Repeated readings', { exact: true }).fill('36\n37\n38');
  await expect(page.locator('.calibration-results')).toContainText('0.37');
  await page.getByRole('button', { name: 'Record & apply mean', exact: true }).click();
  await expect.poll(async () => (await comparison(page)).profiles[0].values.upperArm).toBeCloseTo(.37, 10);
  expect((await comparison(page)).profiles[0].provenance.upperArm).toBe('measured');
  expect((await comparison(page)).profiles[1].values.upperArm).toBeCloseTo(.37, 10);
  await openGuide(page);
  await page.getByLabel('Repeated readings', { exact: true }).fill('36, unfinished reading');
  expect(await flush(page)).toEqual([]);
  expect((await notebook(page)).draft.readings).toBe('36, unfinished reading');
  await page.reload(); await openGuide(page);
  await expect(page.getByLabel('Repeated readings', { exact: true })).toHaveValue('36, unfinished reading');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export calibration notebook', exact: true }).click();
  const stream = await (await pending).createReadStream(); let exported = ''; for await (const part of stream!) exported += part;
  expect(JSON.parse(exported).records).toHaveLength(1);
  await page.getByLabel('Import calibration file', { exact: true }).setInputFiles({ name: 'calibration.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await page.getByRole('button', { name: 'Merge records, keep my draft', exact: true }).click();
  await expect.poll(async () => (await notebook(page))?.records.length).toBe(2);
  const records = (await notebook(page)).records; expect(records[0].id).not.toBe(records[1].id);
  await expect(page.getByLabel('Repeated readings', { exact: true })).toHaveValue('36, unfinished reading');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('keeps failed weight checks as observations but blocks application until the check is resolved', async ({ page }) => {
  await page.goto('/'); await openGuide(page);
  await page.getByLabel('Measurement type', { exact: true }).selectOption('cable-force');
  await page.getByLabel('Measurement unit', { exact: true }).selectOption('kgf');
  await provenance(page, 'Attachment force repeat test');
  await page.getByLabel('Repeated readings', { exact: true }).fill('5\n6');
  await page.getByText('Zero & independently known weight check', { exact: true }).click();
  await page.getByLabel('Independently known check mass (kg)', { exact: true }).fill('10');
  await page.getByLabel('Readings with known check weight (kgf)', { exact: true }).fill('8');
  await page.getByLabel('Chosen check tolerance (kgf)', { exact: true }).fill('.1');
  await expect(page.locator('.calibration-check-result')).toContainText('fails');
  const before = (await comparison(page)).setups[0].tension;
  await page.getByRole('button', { name: 'Record measurement', exact: true }).click();
  await expect.poll(async () => (await notebook(page))?.records.length).toBe(1);
  await page.getByRole('button', { name: 'Record & apply mean', exact: true }).click();
  await expect(page.locator('.calibration-notice')).toContainText('known-weight check failed');
  expect((await comparison(page)).setups[0].tension).toBe(before);
  await page.getByLabel('Readings with known check weight (kgf)', { exact: true }).fill('10');
  await expect(page.locator('.calibration-check-result')).toContainText('passes');
  await page.getByRole('button', { name: 'Record & apply mean', exact: true }).click();
  await expect.poll(async () => (await comparison(page)).setups[0].tension).toBeCloseTo(5.5 * 9.80665, 8);
  expect((await comparison(page)).setups[0].loadMode).toBe('force');
});

test('protects an unreadable calibration original and explicitly backs it up before enabling saves', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{original malformed measurement data'), CALIBRATION_KEY);
  await page.goto('/'); await openGuide(page);
  await expect(page.getByRole('button', { name: 'Preserve original & enable saving', exact: true })).toBeVisible();
  await page.getByLabel('Measurement name', { exact: true }).fill('Recoverable in-memory draft');
  expect((await flush(page)).some(error => error.includes('unreadable calibration original'))).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), CALIBRATION_KEY)).toBe('{original malformed measurement data');
  await page.getByRole('button', { name: 'Preserve original & enable saving', exact: true }).click();
  const recovery = await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(key + '.recovery.')).map(k => localStorage.getItem(k)), CALIBRATION_KEY);
  expect(recovery).toContain('{original malformed measurement data');
  expect((await notebook(page)).draft.name).toBe('Recoverable in-memory draft');
  expect(await flush(page)).toEqual([]);
});
