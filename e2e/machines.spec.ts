import { test, expect } from '@playwright/test';

const KEY = 'biomechanics.machine-workspace.v1';
async function openMachines(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Machines & measured profiles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Machine mechanisms & measured profiles' })).toBeVisible();
}

test('machine A/B edits, undo, calibration domains, portable import and global flush', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openMachines(page);
  const a = page.locator('.machine-a'), b = page.locator('.machine-b');
  await expect(a.locator('.machine-result')).toContainText('60.12 N·m');
  const leverLength = async (panel: typeof a) => panel.locator('.machine-diagram line[stroke="#273e37"]').evaluate(line => Math.hypot(Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')), Number(line.getAttribute('y2')) - Number(line.getAttribute('y1'))));
  expect(await leverLength(b) / await leverLength(a)).toBeCloseTo(.55 / .4, 6);

  await a.getByRole('spinbutton', { name: 'Machine A · Plate mass value', exact: true }).fill('30');
  await expect(a.locator('.machine-result')).toContainText('90.18 N·m');
  await expect(b.locator('.machine-result')).toContainText('82.66 N·m');
  await page.getByRole('button', { name: 'Undo machine edit', exact: true }).click();
  await expect(a.locator('.machine-result')).toContainText('60.12 N·m');
  await page.getByRole('button', { name: 'Redo machine edit', exact: true }).click();
  await expect(a.locator('.machine-result')).toContainText('90.18 N·m');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export machine comparison', exact: true }).click();
  const stream = await (await exported).createReadStream(); let text = ''; for await (const chunk of stream!) text += chunk;
  expect(JSON.parse(text).profiles[0].lever.mass).toBe(30);

  await a.getByLabel('Machine A mechanism', { exact: true }).selectOption('curve');
  await expect(a.locator('.machine-result')).toContainText('Not calculated');
  await expect(page.getByText('No computable samples in the specified domain', { exact: false })).toBeVisible();
  await a.getByText('Coordinate, provenance & uncertainty', { exact: true }).click();
  await a.getByLabel('Machine A evidence type', { exact: true }).selectOption('measured');
  await a.getByLabel('Machine brand', { exact: true }).fill('Test rig');
  await a.getByLabel('Machine model', { exact: true }).fill('Calibrated lever 01');
  await a.getByLabel('Source / measurement protocol', { exact: true }).fill('Test fixture: input shaft torque, three known angles, ±2 N·m absolute instrument bound.');
  const lifting = a.locator('.machine-curve-editor').filter({ has: page.getByLabel('Machine A lifting samples', { exact: true }) });
  await a.getByLabel('Machine A lifting samples', { exact: true }).fill('20, 20, 2\n60, 60, 2\n100, 30, 2');
  const pendingErrors = await page.evaluate(() => { const detail = { errors: [] as string[] }; window.dispatchEvent(new CustomEvent('biomechanics:flush-workspaces', { detail })); return detail.errors; });
  expect(pendingErrors.some(error => error.includes('Apply or discard Machine A lifting samples'))).toBe(true);
  await lifting.getByRole('button', { name: 'Apply curve data', exact: true }).click();
  await a.getByRole('spinbutton', { name: 'Machine A · Input angle value', exact: true }).fill('40');
  await expect(a.locator('.machine-result')).toContainText('40.00 N·m');
  await expect(a.locator('.machine-result')).toContainText('measured profile');
  await a.getByLabel('Machine A branch', { exact: true }).selectOption('lowering');
  await expect(a.locator('.machine-result')).toContainText('Not calculated');
  await a.getByLabel('Machine A branch', { exact: true }).selectOption('lifting');
  await a.getByRole('spinbutton', { name: 'Machine A · Input angle value', exact: true }).fill('10');
  await expect(a.locator('.machine-result')).toContainText('Not calculated');
  await a.getByRole('spinbutton', { name: 'Machine A · Input angle value', exact: true }).fill('40');

  await a.getByRole('button', { name: 'Save machine A profile', exact: true }).click();
  await page.locator('.machine-library summary').click();
  const download = page.waitForEvent('download');
  await a.getByRole('button', { name: 'Export profile A', exact: true }).click();
  const profileStream = await (await download).createReadStream(); let profileText = ''; for await (const chunk of profileStream!) profileText += chunk;
  const profile = JSON.parse(profileText);
  await a.getByLabel('Machine A name', { exact: true }).fill('Temporary edited name');
  await page.getByLabel('Import machine file', { exact: true }).setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(profileText) });
  await expect(a.getByLabel('Machine A name', { exact: true })).toHaveValue(profile.name);
  await page.getByRole('button', { name: 'Undo machine edit', exact: true }).click();
  await expect(a.getByLabel('Machine A name', { exact: true })).toHaveValue('Temporary edited name');
  await page.getByRole('button', { name: 'Redo machine edit', exact: true }).click();
  await expect(a.getByLabel('Machine A name', { exact: true })).toHaveValue(profile.name);

  const invalidProfile = { ...profile }; delete invalidProfile.domain;
  await page.getByLabel('Import machine file', { exact: true }).setInputFiles({ name: 'missing-domain.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidProfile)) });
  await expect(page.locator('.machine-notice').first()).toContainText('domain');
  await expect(a.getByLabel('Machine A name', { exact: true })).toHaveValue(profile.name);

  const libraryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export machine library', exact: true }).click();
  const libraryStream = await (await libraryDownload).createReadStream(); let libraryText = ''; for await (const chunk of libraryStream!) libraryText += chunk;
  await page.getByLabel('Import machine file', { exact: true }).setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: Buffer.from(libraryText) });
  await expect(page.locator('.machine-saved-row')).toHaveCount(2);

  await a.getByRole('spinbutton', { name: 'Machine A · Input angle value', exact: true }).fill('50');
  const flushed = await page.evaluate(key => { const detail = { errors: [] as string[] }; window.dispatchEvent(new CustomEvent('biomechanics:flush-workspaces', { detail })); return { errors: detail.errors, data: JSON.parse(localStorage.getItem(key)!) }; }, KEY);
  expect(flushed.errors).toEqual([]); expect(flushed.data.angles[0]).toBe(50); expect(flushed.data.profiles[0].curve.lifting).toHaveLength(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('machine fallback keeps unreadable original until a backed-up explicit save', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{unreadable machine original'), KEY);
  await openMachines(page);
  await expect(page.getByRole('button', { name: 'Preserve previous data & enable machine saving' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe('{unreadable machine original');
  await page.getByRole('button', { name: 'Preserve previous data & enable machine saving' }).click();
  const data = await page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(`${key}.backup.`)).map(k => localStorage.getItem(k)), KEY);
  expect(data).toContain('{unreadable machine original');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).version, KEY)).toBe(1);
});
