import { field as studioField, fillField, openInspector, closeInspector, openSettingsGroup, setLock, selectSetupOption, setSetupCheck, clickSetupButton, openDialog, closeDialog, openDrawer, openTraining, openAnalysis, goWorkspace } from './studio-helpers';
import { test, expect, type Page } from '@playwright/test';
import { STORAGE_KEY, createInitialState, type LabState } from '../src/state';
import { RESEARCH_KEY } from '../src/researchNotebook';
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as LabState, STORAGE_KEY);
async function openExplorer(page: Page) {
  await page.goto('/');
  await goWorkspace(page, 'Find a setup & research');
  if (!(await page.locator('#design-explorer').evaluate(node => (node as HTMLDetailsElement).open))) await page.locator('#design-explorer > summary').click();
  await page.getByLabel('Map resolution', { exact: true }).selectOption('5');
  await page.getByRole('checkbox', { name: 'Reject assistance detected throughout original ROM', exact: true }).uncheck();
}

test('placement map exports its assumptions and applies a candidate with fixed load, body and full ROM', async ({ page }) => {
  await openExplorer(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const before = await saved(page);
  await page.getByRole('button', { name: 'Calculate placement map', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Placement map', exact: true }).getByRole('button')).toHaveCount(25);
  await expect(page.getByRole('button', { name: 'Calculate placement map', exact: true })).toBeEnabled();
  const compare = page.getByRole('button', { name: 'Compare selected placement with baseline', exact: true });
  await expect(compare).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export map and assumptions', exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('biomechanics-placement-exploration.json');
  await compare.click();
  await expect.poll(async () => (await saved(page)).name).toBe('Placement search · baseline and candidate');
  const after = await saved(page);
  expect(after.setups[0].range).toEqual(before.setups[0].range);
  expect(after.setups[1].range).toEqual(before.setups[0].range);
  expect(after.setups[1].tension).toBe(before.setups[0].tension);
  expect(after.profiles[1]).toEqual(before.profiles[0]);
  expect(after.lockForce).toBe(true);
  expect(after.lockEquipment).toBe(false);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('robust map rejects unavailable uncertainty scenarios and exposes prescribed-speed power', async ({ page }) => {
  await openExplorer(page);
  await page.getByLabel('Uncertain measurement', { exact: true }).selectOption('backWidth');
  const lower = page.getByRole('spinbutton', { name: 'Plausible lower offset (cm)', exact: true });
  await lower.fill('30'); await lower.blur();
  const upper = page.getByRole('spinbutton', { name: 'Plausible upper offset (cm)', exact: true });
  await upper.fill('0'); await upper.blur();
  await page.getByRole('checkbox', { name: 'Require constraints in every sampled measurement scenario', exact: true }).check();
  await page.getByRole('button', { name: 'Calculate placement map', exact: true }).click();
  await expect(page.getByText('0 of 25 sampled placements satisfy the selected checks.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare selected placement with baseline', exact: true })).toBeDisabled();
  await expect(page.getByText('At least one measurement scenario violates a constraint', { exact: true })).toBeVisible();
  await page.locator('.design-power > summary').click();
  await expect(page.locator('.design-power')).toContainText('mean external-load power');
  await expect(page.locator('.design-power')).toContainText('excludes inertia');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('research notes retain a comparison snapshot and keep the hypothesis separate from findings', async ({ page }) => {
  await page.goto('/');
  await goWorkspace(page, 'Find a setup & research');
  const notebook = page.locator('.research-notebook');
  await notebook.locator('summary').first().click();
  await page.getByLabel('Research note title', { exact: true }).fill('Pulley placement hypothesis');
  await page.getByLabel('Research question and hypothesis', { exact: true }).fill('Would lowering the pulley change resistance without changing measured arm length?');
  await page.getByLabel('Research finding and limitations', { exact: true }).fill('Next step: measure outlet height. This is a mechanical question, not a growth result.');
  await notebook.getByRole('button', { name: /Save.*snapshot/i }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"entries":[]}').entries.length, RESEARCH_KEY)).toBe(1);
  await page.reload();
  await goWorkspace(page, 'Find a setup & research');
  await notebook.locator('summary').first().click();
  await expect(notebook).toContainText('Pulley placement hypothesis');
  await expect(notebook).toContainText('Next step: measure outlet height.');
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), RESEARCH_KEY);
  expect(data.entries[0].classification).toBe('hypothesis');
  expect(data.entries[0].snapshot.setups).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('translation analysis uses force, centimetres and metre-based work without mixed-unit deltas', async ({ page }) => {
  const state = createInitialState();
  const setup = { ...state.setups[0], model: 'shrug' as const, resistance: 'dumbbell' as const, loadMass: 10, loadedSides: 'bilateral' as const, tilt: 0, facing: 1 as const, hipHeight: .9, range: [0, 12] as [number, number] };
  state.setups = [setup, structuredClone(setup)]; state.angles = [6, 6]; state.region = [0, 12];
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state });
  await page.goto('/');
  await openAnalysis(page);
  const analysis = page.getByRole('region', { name: 'Comparison analysis', exact: true });
  await expect(analysis.getByLabel('Analysis minimum position', { exact: true })).toHaveValue('0');
  const mean = analysis.locator('table').first().locator('tbody tr').filter({ hasText: 'Mean resisting force' });
  await expect(mean.locator('td').first()).toHaveText('196.2 N');
  await expect(analysis.locator('table').first().locator('tbody tr').filter({ hasText: 'External-load work' }).locator('td').first()).toHaveText('-23.5 J');
  await page.getByLabel('Configuration B preset', { exact: true }).selectOption('classic-far');
  const mixed = analysis.locator('table').first().locator('tbody tr').filter({ hasText: 'Mean resisting load' });
  await expect(mixed.locator('td').first()).toHaveText('196.2 N');
  await expect(mixed.locator('td').nth(1)).toContainText('N·m');
  await expect(mixed.locator('td').last()).toHaveText('—');
});

test('unsaved research drafts block workspace flushing until saved or explicitly discarded', async ({ page }) => {
  await page.goto('/');
  await goWorkspace(page, 'Find a setup & research');
  const notebook = page.locator('.research-notebook');
  await notebook.locator('summary').first().click();
  const flushErrors = () => page.evaluate(() => {
    const detail = { errors: [] as string[] };
    window.dispatchEvent(new CustomEvent('biomechanics:flush-workspaces', { detail }));
    return detail.errors;
  });
  expect(await flushErrors()).toEqual([]);
  await page.getByLabel('Research note title', { exact: true }).fill('Keep this unfinished question');
  await page.getByLabel('Research finding and limitations', { exact: true }).fill('Awaiting the equipment measurement.');
  await goWorkspace(page, 'Joint & exercise comparison');
  await openDrawer(page, 'workspace-backup');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Research notebook has an unsaved note');
  expect((await flushErrors()).join(' ')).toContain('save it or discard the draft');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"entries":[]}').entries.length, RESEARCH_KEY)).toBe(0);
  await goWorkspace(page, 'Find a setup & research');
  await expect(page.getByLabel('Research note title', { exact: true })).toHaveValue('Keep this unfinished question');
  await notebook.getByRole('button', { name: 'Save note & comparison snapshot', exact: true }).click();
  expect(await flushErrors()).toEqual([]);
  await page.getByLabel('Research note title', { exact: true }).fill('Another unfinished note');
  expect((await flushErrors()).length).toBe(1);
  await notebook.getByRole('button', { name: 'Discard research draft', exact: true }).click();
  expect(await flushErrors()).toEqual([]);
  await openDrawer(page, 'workspace-backup');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('biomechanics-workspace.json');
});


test('compound research snapshots restore their captured path and body instead of the current main profile', async ({ page }) => {
  await page.goto('/');
  await goWorkspace(page, 'Compound movements');
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('pullover-coupled');
  await page.getByLabel('Compound comparison name', { exact: true }).fill('Recorded coupled path');
  const force = page.getByRole('spinbutton', { name: 'A · Force per active cable value', exact: true });
  await force.fill('143'); await force.blur();
  await goWorkspace(page, 'Find a setup & research');
  const notebook = page.locator('.research-notebook'); await notebook.locator('summary').first().click();
  await page.getByLabel('Research snapshot source', { exact: true }).selectOption('compound');
  await page.getByLabel('Research note title', { exact: true }).fill('Coupled path research');
  await notebook.getByRole('button', { name: 'Save note & comparison snapshot', exact: true }).click();
  const note = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).entries[0], RESEARCH_KEY);
  expect(note.attachment.kind).toBe('compound');
  expect(note.attachment.snapshot.configs[0].preset).toBe('pullover-coupled');
  expect(note.attachment.snapshot.configs[0].tension).toBe(143);
  await goWorkspace(page, 'Compound movements');
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('squat-back');
  await page.getByLabel('Compound comparison name', { exact: true }).fill('Different current work');
  await goWorkspace(page, 'Find a setup & research');
  await notebook.getByRole('button', { name: 'Restore compound comparison', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Compound movements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('A compound exercise', { exact: true })).toHaveValue('pullover-coupled');
  await expect(force).toHaveValue('143');
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('biomechanics.compound-workbench.v1')!));
  expect(restored.profiles).toEqual(note.attachment.snapshot.profiles);
  expect(restored.useMainProfiles).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('biomechanics.compound-workbench.v1.research-restore-backup.')))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('machine research snapshots retain data branches and respect unapplied curve draft protection', async ({ page }) => {
  await page.goto('/');
  await goWorkspace(page, 'Machines & measured profiles');
  await page.getByLabel('Machine A mechanism', { exact: true }).selectOption('curve');
  await page.getByLabel('Machine A name', { exact: true }).fill('User-entered calibration example');
  await page.locator('.machine-a').getByText('Coordinate, provenance & uncertainty', { exact: true }).click();
  await page.getByLabel('Machine A evidence type', { exact: true }).selectOption('theoretical');
  const samples = page.getByLabel('Machine A lifting samples', { exact: true });
  await samples.fill('10, 20, 1\n55, 36, 2\n100, 27, 1');
  await goWorkspace(page, 'Find a setup & research');
  const notebook = page.locator('.research-notebook'); await notebook.locator('summary').first().click();
  await page.getByLabel('Research snapshot source', { exact: true }).selectOption('machine');
  await page.getByLabel('Research note title', { exact: true }).fill('Calibration research');
  const save = notebook.getByRole('button', { name: 'Save note & comparison snapshot', exact: true });
  await save.click();
  await expect(notebook.getByRole('status')).toContainText('Apply or discard Machine A lifting samples');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"entries":[]}').entries.length, RESEARCH_KEY)).toBe(0);
  await goWorkspace(page, 'Machines & measured profiles');
  await samples.locator('..').locator('..').getByRole('button', { name: 'Apply curve data', exact: true }).click();
  await goWorkspace(page, 'Find a setup & research');
  await save.click();
  await expect(notebook.getByRole('status')).toContainText('Research note saved with a machine comparison snapshot');
  const note = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).entries[0], RESEARCH_KEY);
  expect(note.attachment.kind).toBe('machine');
  expect(note.attachment.snapshot.profiles[0].curve.lifting[1]).toEqual({ angle: 55, value: 36, uncertainty: 2 });
  await goWorkspace(page, 'Machines & measured profiles');
  await page.getByLabel('Machine A mechanism', { exact: true }).selectOption('lever');
  await goWorkspace(page, 'Find a setup & research');
  await notebook.getByRole('button', { name: 'Restore machine comparison', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Machines & measured profiles', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Machine A mechanism', { exact: true })).toHaveValue('curve');
  await expect(samples).toHaveValue(/55, 36, 2/);
  await expect(page.getByLabel('Machine A name', { exact: true })).toHaveValue('User-entered calibration example');
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('biomechanics.machine-workspace.v1.research-restore-backup.')))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
