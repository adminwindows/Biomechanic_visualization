import { field as studioField, fillField, openInspector, closeInspector, openSettingsGroup, setLock, selectSetupOption, setSetupCheck, clickSetupButton, openDialog, closeDialog, openDrawer, openTraining, openAnalysis, goWorkspace } from './studio-helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { STORAGE_KEY, type LabState } from '../src/state';
import { presets } from '../src/engine';
import { EXERCISE_DRAFTS_KEY } from '../src/exerciseDrafts';
import { MACHINE_WORKSPACE_KEY, MACHINE_LIBRARY_KEY, type MachineWorkspace } from '../src/machineLibrary';
import { COMPOUND_KEY, COMPOUND_LIBRARY_KEY, type CompoundSnapshot } from '../src/compoundState';
import { RESEARCH_KEY } from '../src/researchNotebook';
import { parseWorkspaceBackup, WORKSPACE_STORAGE_KEYS, WORKSPACE_BACKUP_PREFIX } from '../src/workspaceBackup';

const input = studioField;
const stored = <T>(page: Page, key: string): Promise<T | null> => page.evaluate(storageKey => {
  const raw = localStorage.getItem(storageKey);
  return raw === null ? null : JSON.parse(raw);
}, key);
const mainState = (page: Page) => stored<LabState>(page, STORAGE_KEY);
async function openDetails(page: Page, selector: string) {
  if (selector === '#catalog' || selector === '#workspace-backup') { await openDrawer(page, selector.slice(1)); return; }
  if (selector.startsWith('#body-profile-')) await openInspector(page, selector.endsWith('b') ? 'B' : 'A');
  const details = page.locator(selector);
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
}
async function workspace(page: Page, name: string) {
  const button = page.getByRole('navigation', { name: 'Analysis workspaces' }).getByRole('button', { name, exact: true });
  await goWorkspace(page, name);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}
async function download(page: Page, button: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const file = await pending;
  return { filename: file.suggestedFilename(), text: await readFile((await file.path())!, 'utf8') };
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Analysis workspaces' })).toBeVisible();
});

test('exercise drafts retain setup, measured body and angle across switches and reload; reset restores the example', async ({ page }) => {
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('classic');
  await page.getByLabel('Synchronization mode', { exact: true }).selectOption('independent');
  await fillField(page, 'A · Pulley height', '245');
  await fillField(page, 'A · Upper-arm elevation from torso', '145');
  await openDetails(page, '#body-profile-a');
  await fillField(page, 'A · Upper arm', '38');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('curl-low');
  await fillField(page, 'A · Pulley height', '35');
  await fillField(page, 'A · Upper arm', '40');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('classic');
  await expect(input(page, 'A · Pulley height')).toHaveValue('245');
  await expect(input(page, 'A · Upper arm')).toHaveValue('38');
  await expect(input(page, 'A · Upper-arm elevation from torso')).toHaveValue('145');
  await expect.poll(async () => (await mainState(page))?.profiles[0].provenance.upperArm).toBe('measured');
  const drafts = await stored<{ drafts: { side: number; preset: string }[] }>(page, EXERCISE_DRAFTS_KEY);
  expect(drafts?.drafts.some(draft => draft.side === 0 && draft.preset === 'classic')).toBe(true);
  expect(drafts?.drafts.some(draft => draft.side === 0 && draft.preset === 'curl-low')).toBe(true);

  await page.reload();
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('curl-low');
  await expect(input(page, 'A · Pulley height')).toHaveValue('35');
  await openDetails(page, '#body-profile-a');
  await expect(input(page, 'A · Upper arm')).toHaveValue('40');
  await closeInspector(page);
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('classic');
  await expect(input(page, 'A · Pulley height')).toHaveValue('245');
  await expect(input(page, 'A · Upper arm')).toHaveValue('38');
  await clickSetupButton(page, 'A', 'Reset setup preset');
  const original = presets.find(preset => preset.preset === 'classic')!;
  await expect(input(page, 'A · Pulley height')).toHaveValue(String(original.pulleyHeight * 100));
  await expect(input(page, 'A · Upper arm')).toHaveValue('38');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('curl-low');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('classic');
  await expect(input(page, 'A · Pulley height')).toHaveValue(String(original.pulleyHeight * 100));
  await noOverflow(page);
});

test('view, zoom and background pan survive reload and portable comparison import', async ({ page }) => {
  await page.getByRole('button', { name: 'Top view', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const scene = page.locator('.scene-svg').first();
  await scene.scrollIntoViewIfNeeded();
  const box = (await scene.boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await mainState(page))?.viewFraming?.pan.some(value => Math.abs(value) > .001)).toBe(true);
  const framing = (await mainState(page))!.viewFraming!;
  expect(framing.view).toBe('top');
  expect(framing.zoom).toBeCloseTo(1.4);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Top view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.toolbar-zoom')).toContainText('140%');
  expect((await mainState(page))!.viewFraming).toEqual(framing);
  const exported = await download(page, 'Export');
  expect((JSON.parse(exported.text) as LabState).viewFraming).toEqual(framing);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.getByRole('button', { name: 'Side view', exact: true }).click();
  await page.getByLabel('Import comparison file', { exact: true }).setInputFiles({ name: exported.filename, mimeType: 'application/json', buffer: Buffer.from(exported.text) });
  await expect(page.getByRole('button', { name: 'Top view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.toolbar-zoom')).toContainText('140%');
  await expect.poll(async () => (await mainState(page))?.viewFraming).toEqual(framing);
  await noOverflow(page);
});

test('global catalog routes a barbell row into the selected compound side', async ({ page }) => {
  await openDetails(page, '#catalog');
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell row');
  await page.getByLabel('Catalog target', { exact: true }).selectOption('1');
  await page.locator('#catalog .catalog-pick').filter({ hasText: 'Bent-over barbell row' }).click();
  await expect(page.getByRole('navigation', { name: 'Analysis workspaces' }).getByRole('button', { name: 'Compound movements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('B compound exercise', { exact: true })).toHaveValue('row-barbell');
  await expect(page.getByLabel('A compound exercise', { exact: true })).toHaveValue('row-seated');
  await expect.poll(async () => (await stored<CompoundSnapshot>(page, COMPOUND_KEY))?.configs[1].preset).toBe('row-barbell');
  await noOverflow(page);
});

test('whole workspace export flushes current edits and restores every edited workbench after clearing active data', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Comparison name', { exact: true }).fill('Portable shoulder comparison');
  await fillField(page, 'A · Pulley height', '215');
  await workspace(page, 'Compound movements');
  await page.getByLabel('Compound comparison name', { exact: true }).fill('Portable row comparison');
  await page.getByLabel('Compound comparison notes', { exact: true }).fill('External moments only; fixed-trunk row assumption.');
  await openDetails(page, '.compound-library');
  await page.locator('.compound-library').getByRole('button', { name: 'Save named copy', exact: true }).click();
  await noOverflow(page);

  await workspace(page, 'Find a setup & research');
  await openDetails(page, '#research-notebook');
  await page.getByLabel('Research note title', { exact: true }).fill('Portable pulley hypothesis');
  await page.getByLabel('Research question and hypothesis', { exact: true }).fill('Does changing pulley height shift the external moment peak?');
  await page.getByLabel('Research finding and limitations', { exact: true }).fill('A model question, with no muscle-growth claim.');
  await page.getByRole('button', { name: 'Save note & comparison snapshot', exact: true }).click();
  await expect(page.locator('.research-entry').getByRole('heading', { name: 'Portable pulley hypothesis', exact: true })).toBeVisible();
  await noOverflow(page);

  await workspace(page, 'Machines & measured profiles');
  const oldMachine = await stored<MachineWorkspace>(page, MACHINE_WORKSPACE_KEY);
  await page.getByLabel('Machine A name', { exact: true }).fill('Portable theoretical lever');
  await fillField(page, 'Machine A · Plate mass', '35');
  await page.getByRole('button', { name: 'Save machine A profile', exact: true }).click();
  await expect.poll(async () => (await stored<MachineWorkspace>(page, MACHINE_WORKSPACE_KEY))?.profiles[0].lever.mass).toBe(35);
  await noOverflow(page);
  await openDetails(page, '#workspace-backup');
  // Simulate stale persisted data without changing the live editor. Export must
  // synchronously flush the machine listener and capture the main React state.
  await page.evaluate(({ key, previous }) => {
    if (previous) localStorage.setItem(key, JSON.stringify(previous));
    else localStorage.removeItem(key);
  }, { key: MACHINE_WORKSPACE_KEY, previous: oldMachine });
  const file = await download(page, 'Export workspace');
  expect(file.filename).toBe('biomechanics-workspace.json');
  const backup = parseWorkspaceBackup(file.text);
  const value = <T,>(key: string) => backup.entries.find(entry => entry.key === key)!.value as T;
  expect(value<LabState>(STORAGE_KEY).name).toBe('Portable shoulder comparison');
  expect(value<LabState>(STORAGE_KEY).setups[0].pulleyHeight).toBe(2.15);
  expect(value<MachineWorkspace>(MACHINE_WORKSPACE_KEY).profiles[0].lever.mass).toBe(35);
  expect(value<MachineWorkspace>(MACHINE_WORKSPACE_KEY).profiles[0].name).toBe('Portable theoretical lever');
  expect(value<CompoundSnapshot>(COMPOUND_KEY).name).toBe('Portable row comparison');
  expect(value<{ entries: { title: string }[] }>(RESEARCH_KEY).entries[0].title).toBe('Portable pulley hypothesis');
  expect(value<{ profiles: unknown[] }>(MACHINE_LIBRARY_KEY).profiles).toHaveLength(1);
  expect(value<unknown[]>(COMPOUND_LIBRARY_KEY)).toHaveLength(1);
  expect(backup.entries.map(entry => entry.key)).toEqual(WORKSPACE_STORAGE_KEYS);
  await page.evaluate(({ keys, prefix }) => {
    for (const key of keys) localStorage.removeItem(key);
    localStorage.setItem('unrelated-workspace-test', 'retained');
    localStorage.setItem(`${prefix}existing`, 'previous recovery retained');
    location.reload();
  }, { keys: WORKSPACE_STORAGE_KEYS, prefix: WORKSPACE_BACKUP_PREFIX });
  await expect(page.getByLabel('Comparison name', { exact: true })).not.toHaveValue('Portable shoulder comparison');
  await openDetails(page, '#workspace-backup');
  await page.getByLabel('Import whole workspace file', { exact: true }).setInputFiles({ name: file.filename, mimeType: 'application/json', buffer: Buffer.from(file.text) });
  await expect(page.locator('.workspace-import-preview')).toContainText('Ready to restore these sections');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Restore & reload', exact: true }).click()]);
  await expect(page.getByLabel('Comparison name', { exact: true })).toHaveValue('Portable shoulder comparison');
  await expect(input(page, 'A · Pulley height')).toHaveValue('215');
  await workspace(page, 'Compound movements');
  await expect(page.getByLabel('Compound comparison name', { exact: true })).toHaveValue('Portable row comparison');
  await expect(page.getByLabel('Compound comparison notes', { exact: true })).toHaveValue('External moments only; fixed-trunk row assumption.');
  await openDetails(page, '.compound-library');
  await expect(page.locator('.compound-library-row')).toContainText('Portable row comparison');
  await workspace(page, 'Machines & measured profiles');
  await expect(page.getByLabel('Machine A name', { exact: true })).toHaveValue('Portable theoretical lever');
  await expect(input(page, 'Machine A · Plate mass')).toHaveValue('35');
  await openDetails(page, '.machine-library');
  await expect(page.locator('.machine-saved-row')).toContainText('Portable theoretical lever');
  await workspace(page, 'Find a setup & research');
  await openDetails(page, '#research-notebook');
  await expect(page.locator('.research-entry').getByRole('heading', { name: 'Portable pulley hypothesis', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('unrelated-workspace-test'))).toBe('retained');
  expect(await page.evaluate(prefix => localStorage.getItem(`${prefix}existing`), WORKSPACE_BACKUP_PREFIX)).toBe('previous recovery retained');
  expect(await page.evaluate(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).length, WORKSPACE_BACKUP_PREFIX)).toBeGreaterThan(1);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('invalid whole-workspace files report their error before changing current work', async ({ page }) => {
  await page.getByLabel('Comparison name', { exact: true }).fill('Do not overwrite this comparison');
  await expect.poll(async () => (await mainState(page))?.name).toBe('Do not overwrite this comparison');
  const before = await mainState(page);
  await openDetails(page, '#workspace-backup');
  const invalid = { format: 'biomechanics-workspace', version: 1, exportedAt: new Date().toISOString(), entries: [{ key: 'another-app.secret', value: 'unknown keys must not be written' }] };
  await page.getByLabel('Import whole workspace file', { exact: true }).setInputFiles({ name: 'invalid-workspace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.locator('#workspace-backup').getByRole('alert')).toContainText('unrecognized storage section');
  await expect(page.getByRole('button', { name: 'Restore & reload', exact: true })).toHaveCount(0);
  expect(await mainState(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('another-app.secret'))).toBeNull();
  await noOverflow(page);
});

test('unreadable favorites and exercise mappings stay recoverable while storage failures are visible', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('biomechanics.exercise-favorites', '{original favorites');
    localStorage.setItem('biomechanics.training-matches', '{original mappings');
    localStorage.setItem('biomechanics.training-list', 'Barbell row');
  });
  await page.reload();
  await openDetails(page, '#catalog');
  await expect(page.locator('#catalog').getByRole('alert')).toContainText('original is retained');
  await openDrawer(page, 'catalog');
  await page.locator('#catalog .catalog-item > button[aria-pressed]').first().click();
  const training = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Your exercise list' }) });
  await openTraining(page);
  await expect(training.getByRole('alert')).toContainText('original is retained');
  await training.getByRole('button', { name: 'Match exercises', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('biomechanics.exercise-favorites'))).toBe('{original favorites');
  expect(await page.evaluate(() => localStorage.getItem('biomechanics.training-matches'))).toBe('{original mappings');
  await openDetails(page, '#workspace-backup');
  const raw = JSON.parse((await download(page, 'Download raw recovery')).text);
  expect(raw.entries.find((entry: { key: string }) => entry.key === 'biomechanics.exercise-favorites').raw).toBe('{original favorites');
  expect(raw.entries.find((entry: { key: string }) => entry.key === 'biomechanics.training-matches').raw).toBe('{original mappings');

  await openDrawer(page, 'catalog');
  await page.getByRole('button', { name: 'Preserve original & enable favorites saving', exact: true }).click();
  await openTraining(page);
  await page.getByRole('button', { name: 'Preserve original & enable exercise mappings saving', exact: true }).click();
  await expect(page.locator('#catalog').getByRole('alert', { includeHidden: true })).toHaveCount(0);
  await expect(training.getByRole('alert')).toHaveCount(0);
  const saved = await stored<string[]>(page, 'biomechanics.exercise-favorites');
  expect(saved).toHaveLength(1);
  expect((await stored<{ selectedPreset: string }[]>(page, 'biomechanics.training-matches'))?.[0].selectedPreset).toBe('compound:row-barbell');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('.recovery.')).map(key => localStorage.getItem(key)))).toEqual(expect.arrayContaining(['{original favorites', '{original mappings']));

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'biomechanics.exercise-favorites') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await openDrawer(page, 'catalog');
  await page.locator('#catalog .catalog-item > button[aria-pressed]').first().click();
  await expect(page.locator('#catalog').getByRole('alert')).toContainText('Current edits have not been saved');
  expect(await stored(page, 'biomechanics.exercise-favorites')).toEqual(saved);
  await noOverflow(page);
});
