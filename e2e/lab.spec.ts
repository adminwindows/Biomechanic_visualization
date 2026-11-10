import { field as studioField, fillField, openInspector, closeInspector, openSettingsGroup, setLock, selectSetupOption, setSetupCheck, clickSetupButton, openDialog, closeDialog, openDrawer, openTraining, openAnalysis, goWorkspace } from './studio-helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createInitialState, STORAGE_KEY, type LabState } from '../src/state';

const stateInBrowser = (page: Page) => page.evaluate(key => {
  const stored = localStorage.getItem(key);
  try { return stored ? JSON.parse(stored) as LabState : null; } catch { return null; }
}, STORAGE_KEY);
const input = studioField;
const panel = (page: Page, side: 'A' | 'B') => page.getByRole('article', { name: `Configuration ${side}`, exact: true });
async function imported(page: Page, state: unknown) {
  await page.getByLabel('Import comparison file', {exact:true}).setInputFiles({ name: 'comparison.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state)) });
}
async function openGroup(page: Page, side: 'A' | 'B', title: string) { await openSettingsGroup(page, side, title); }

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Compare the mechanics.');
});

test('renders comparable scenes, responsive controls and a readable curve without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(panel(page, 'A')).toBeVisible();
  await expect(panel(page, 'B')).toBeVisible();
  await expect(panel(page, 'A').locator('.moment')).toHaveText(/^\+[0-9.]+ N·m$/);
  await expect(panel(page, 'B').locator('.moment')).toHaveText(/^\+[0-9.]+ N·m$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Top view', exact: true }).click();
  await expect(page.locator('.scene-top')).toHaveCount(2);
  await page.getByRole('button', { name: 'Side view', exact: true }).click();
  await expect(page.locator('.scene-side')).toHaveCount(2);
  const chart = page.locator('.curve-svg');
  await chart.scrollIntoViewIfNeeded();
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(input(page, 'Upper-arm elevation from torso')).toHaveValue('159');
  expect(await chart.locator('text').first().evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(9);
  expect(errors).toEqual([]);
});

test('keeps setup edits independent and implements angle, progress and independent synchronization', async ({ page }) => {
  await fillField(page, 'A · Pulley height', '190');
  await expect(input(page, 'B · Pulley height')).toHaveValue('135');
  await page.getByLabel('Synchronization mode').selectOption('independent');
  await fillField(page, 'A · Upper-arm elevation from torso', '120');
  await fillField(page, 'B · Upper-arm elevation from torso', '170');
  await expect(input(page, 'A · Upper-arm elevation from torso')).toHaveValue('120');
  await page.getByLabel('Synchronization mode').selectOption('angle');
  await expect.poll(async () => (await stateInBrowser(page))?.angles).toEqual([120, 120]);
  await page.getByLabel('Synchronization mode').selectOption('progress');
  await fillField(page, 'Upper-arm elevation from torso', '115');
  await expect.poll(async () => (await stateInBrowser(page))?.angles).toEqual([115, 135]);
  await expect(page.getByText('Equal progress does not mean equal joint angles.')).toBeVisible();
});

test('height updates unmeasured dimensions while preserving measurements and equipment', async ({ page }) => {
  await openGroup(page, 'A', 'Body profile');
  await fillField(page, 'A · Upper arm', '37');
  await fillField(page, 'A · Standing height', '190');
  await expect(input(page, 'A · Upper arm')).toHaveValue('37');
  await expect(input(page, 'A · Forearm')).toHaveValue('29.314');
  await expect(input(page, 'B · Pulley height')).toHaveValue('135');
  await expect(input(page, 'B · Pelvis height')).toHaveValue('46');
  await expect.poll(async () => (await stateInBrowser(page))?.profiles[0].provenance.upperArm).toBe('measured');
  const state = (await stateInBrowser(page))!;
  expect(state.profiles[0]).toEqual(state.profiles[1]);
  await setLock(page, 'Same body', false);
  await fillField(page, 'A · Upper arm', '39');
  await expect.poll(async () => (await stateInBrowser(page))?.profiles[0].values.upperArm).toBe(.39);
  expect((await stateInBrowser(page))?.profiles[1].values.upperArm).toBe(.37);
});

test('distinguishes assistive cable action from zero applied force and keeps return labels stable', async ({ page }) => {
  await page.getByLabel('Configuration A preset').selectOption('inside-upright');
  await fillField(page, 'Upper-arm elevation from torso', '180');
  await expect(panel(page, 'A').locator('.status')).toHaveText('Assists the pull');
  await expect(panel(page, 'A').locator('.moment')).toHaveText(/^-[0-9.]+ N·m$/);
  await fillField(page, 'A · Force per cable', '0');
  await expect(panel(page, 'A').locator('.status')).toContainText('No cable force');
  await expect(panel(page, 'A').locator('.moment')).toHaveText('0.0 N·m');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect(input(page, 'Upper-arm elevation from torso')).not.toHaveValue('180');
  await expect(panel(page, 'A').locator('.status')).toContainText('No cable force');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
});

test('copies, swaps and undoes full setups with their corresponding results', async ({ page }) => {
  const originalMoment = await panel(page,'A').locator('.moment').innerText();
  await page.getByRole('button', { name: 'Copy A → B', exact: true }).click();
  await expect(panel(page, 'B').locator('.moment')).toHaveText(originalMoment);
  await fillField(page, 'B · Pulley height', '180');
  await page.getByRole('button', { name: 'Swap A ⇄ B', exact: true }).click();
  await expect(input(page, 'A · Pulley height')).toHaveValue('180');
  await expect(input(page, 'B · Pulley height')).toHaveValue('225');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(input(page, 'A · Pulley height')).toHaveValue('225');
  await expect(input(page, 'B · Pulley height')).toHaveValue('180');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(input(page, 'A · Pulley height')).toHaveValue('180');
});

test('saves, reloads and reproduces an exported comparison in empty browser storage', async ({ page }) => {
  await page.getByLabel('Comparison name').fill('Overhead setup trial');
  await fillField(page, 'A · Pulley height', '205');
  await setLock(page, 'Same force per attachment', true);
  await fillField(page, 'A · Force per cable', '130');
  await expect.poll(async () => (await stateInBrowser(page))?.setups[1].tension).toBe(130);
  const expected = await stateInBrowser(page);
  await page.reload();
  await expect(page.getByLabel('Comparison name')).toHaveValue('Overhead setup trial');
  await expect(input(page, 'A · Pulley height')).toHaveValue('205');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const snapshot = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(snapshot).toEqual(expected);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await imported(page, snapshot);
  await expect(page.getByRole('status').filter({hasText:'Comparison imported.'})).toContainText('Comparison imported.');
  await expect.poll(() => stateInBrowser(page)).toEqual(expected);
  await imported(page, { version: 999 });
  await expect(page.getByRole('status').filter({hasText:'Import failed:'})).toContainText('Import failed:');
  expect(await stateInBrowser(page)).toEqual(expected);
});

test('preserves an unreadable saved snapshot until explicit backup and recovery', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{older or damaged snapshot'), STORAGE_KEY);
  await page.reload();
  await expect(page.getByText('The previous saved data could not be restored and has been preserved.', { exact: false })).toBeVisible();
  await fillField(page, 'A · Pulley height', '200');
  // Wait beyond the autosave debounce to prove failed loading does not overwrite the original.
  await page.waitForTimeout(500);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{older or damaged snapshot');
  await page.getByRole('button', { name: 'Back up previous data & enable saving' }).click();
  await expect.poll(async () => (await stateInBrowser(page))?.setups[0].pulleyHeight).toBe(2);
  const backups = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('exercise-biomechanics-lab.recovery.')).map(key => localStorage.getItem(key)));
  expect(backups).toEqual(['{older or damaged snapshot']);
});

test('suppresses direct cable moments after spatial backrest contact', async ({ page }) => {
  const state = createInitialState();
  state.setups[1] = { ...state.setups[1], tilt: 90, hipX: 1, pulleyHeight: .5, backWidth: .34 };
  state.angles = [140, 140];
  await imported(page, state);
  await expect(panel(page, 'B').locator('.status')).not.toHaveText('Backrest contact');
  state.setups[1].backWidth = 1.5;
  await imported(page, state);
  await expect(panel(page, 'B').locator('.status')).toContainText('Backrest contact');
  await expect(panel(page, 'B').locator('.moment')).toHaveText(/—/);
  await page.getByRole('button', { name: 'Top view', exact: true }).click();
  await expect(panel(page, 'B').locator('.scene-top')).toBeVisible();
  await expect(page.locator('.insight-card h2')).toBeVisible();
});

test('accepts natural sequential numeric typing including negative positions', async ({ page }) => {
  await openGroup(page, 'A', 'Body profile');
  const upperArm = input(page, 'A · Upper arm');
  await upperArm.fill('');
  await upperArm.pressSequentially('37');
  await expect(upperArm).toHaveValue('37');
  await upperArm.press('Tab');
  await expect.poll(async () => (await stateInBrowser(page))?.profiles[0].values.upperArm).toBe(.37);

  const height = input(page, 'A · Standing height');
  await height.fill('');
  await height.pressSequentially('190');
  await expect(height).toHaveValue('190');
  await height.press('Tab');
  await expect.poll(async () => (await stateInBrowser(page))?.profiles[0].values.height).toBe(1.9);
  await expect(upperArm).toHaveValue('37');

  const pelvis = input(page, 'A · Pelvis to pulley plane');
  await pelvis.fill('');
  await pelvis.pressSequentially('-35');
  await expect(pelvis).toHaveValue('-35');
  await pelvis.press('Tab');
  await expect.poll(async () => (await stateInBrowser(page))?.setups[0].hipX).toBe(-.35);
});
