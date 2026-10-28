import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openDrawer } from './studio-helpers';
import {
  COMPOUND_KEY,
  COMPOUND_LIBRARY_KEY,
  parseCompoundLibrary,
  type CompoundSnapshot,
  type CompoundLibraryEntry,
} from '../src/compoundState';

const workbench = (page: Page) => page.locator('#compound-lab');
const input = (page: Page, label: string) => workbench(page).getByRole('spinbutton', { name: `${label} value`, exact: true });
async function state(page: Page): Promise<CompoundSnapshot | null> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), COMPOUND_KEY);
}
async function library(page: Page): Promise<CompoundLibraryEntry[]> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]'), COMPOUND_LIBRARY_KEY);
}
async function openDetails(details: Locator) {
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
}
async function openWorkbench(page: Page) {
  const button = page.getByRole('navigation', { name: 'Analysis workspaces' }).getByRole('button', { name: 'Compound movements', exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(workbench(page)).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

// The shared config runs these workflows on desktop and 360px touch-screen projects.
test('catalog loads a coupled path and keeps edits, copy, swap and undo attached to the correct side', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await openDrawer(page, 'catalog');
  await page.getByLabel('Search exercises', { exact: true }).fill('changing elbow');
  await page.getByLabel('Catalog target', { exact: true }).selectOption('1');
  await page.locator('#catalog .catalog-pick').filter({ hasText: 'Cable pullover · changing elbow angle' }).click();
  await expect(page.getByRole('navigation', { name: 'Analysis workspaces' }).getByRole('button', { name: 'Compound movements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('A compound exercise', { exact: true })).toHaveValue('row-seated');
  await expect(page.getByLabel('B compound exercise', { exact: true })).toHaveValue('pullover-coupled');
  const lab = workbench(page), a = lab.locator('.compound-a'), b = lab.locator('.compound-b');
  const signature = (panel: Locator) => panel.locator('.compound-scene line').evaluateAll(lines => JSON.stringify(lines.map(line => ['x1', 'y1', 'x2', 'y2'].map(key => line.getAttribute(key)))));
  expect(await signature(a)).not.toBe(await signature(b));
  const beforeA = (await state(page))!.configs[0];
  const beforeBGeometry = await signature(b);
  await openDetails(b.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Pose, supports and movement path' }) }));
  await expect(input(page, 'B · Shoulder elevation at 0%')).toHaveValue('175');
  await input(page, 'B · Elbow flexion at 100%').fill('60');
  await input(page, 'B · Elbow flexion at 100%').press('Tab');
  await expect.poll(async () => (await state(page))?.configs[1].elbowEnd).toBe(60);
  expect((await state(page))!.configs[0]).toEqual(beforeA);
  expect(await signature(b)).not.toBe(beforeBGeometry);

  await lab.getByRole('button', { name: 'Copy A → B', exact: true }).click();
  await expect(page.getByLabel('B compound exercise', { exact: true })).toHaveValue('row-seated');
  await expect.poll(async () => (await state(page))!.configs[1]).toEqual(beforeA);
  await input(page, 'B · Force per active cable').fill('170');
  await input(page, 'B · Force per active cable').press('Tab');
  await lab.getByRole('button', { name: 'Swap A / B', exact: true }).click();
  await expect(input(page, 'A · Force per active cable')).toHaveValue('170');
  await expect(input(page, 'B · Force per active cable')).toHaveValue('100');
  await lab.getByRole('button', { name: 'Undo compound edit', exact: true }).click();
  await expect(input(page, 'A · Force per active cable')).toHaveValue('100');
  await expect(input(page, 'B · Force per active cable')).toHaveValue('170');
  await lab.getByRole('button', { name: 'Redo compound edit', exact: true }).click();
  await expect(input(page, 'A · Force per active cable')).toHaveValue('170');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('named-library export and reimport preserve existing IDs and reproduce complete body/setup snapshots', async ({ page }) => {
  await page.goto('/');
  await openWorkbench(page);
  const lab = workbench(page);
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('pullover-coupled');
  await page.getByLabel('Compound comparison name', { exact: true }).fill('Saved coupled study');
  await page.getByLabel('Compound comparison notes', { exact: true }).fill('Declared masses and changing elbow path; no muscle-force inference.');
  await openDetails(lab.locator('.compound-library'));
  await lab.getByRole('button', { name: 'Save named copy', exact: true }).click();
  await expect.poll(async () => (await library(page)).length).toBe(1);
  const downloadPromise = page.waitForEvent('download');
  await lab.getByRole('button', { name: 'Export library', exact: true }).click();
  const exported = await downloadPromise;
  const text = await readFile((await exported.path())!, 'utf8');
  const original = parseCompoundLibrary(text);
  expect(original).toHaveLength(1);
  expect(original[0].snapshot.configs[0].preset).toBe('pullover-coupled');
  expect(original[0].snapshot.profiles[0].upperArm).toBeGreaterThan(0);

  await lab.locator('input[type=file]').nth(1).setInputFiles({ name: exported.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect.poll(async () => (await library(page)).length).toBe(2);
  const imported = await library(page);
  expect(imported[0]).toEqual(original[0]);
  expect(imported[1].id).not.toBe(original[0].id);
  expect(imported[1].snapshot).toEqual(original[0].snapshot);
  await expect(lab.locator('.compound-library-row')).toHaveCount(2);

  await page.getByLabel('A compound exercise', { exact: true }).selectOption('squat-back');
  await page.getByLabel('Compound comparison notes', { exact: true }).fill('Changed since saving');
  const savedRow = lab.locator('.compound-library-row').filter({ has: page.getByText('Saved coupled study', { exact: true }) });
  await savedRow.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.getByLabel('A compound exercise', { exact: true })).toHaveValue('pullover-coupled');
  const restored = (await state(page))!;
  expect(restored.configs).toEqual(original[0].snapshot.configs);
  expect(restored.profiles).toEqual(original[0].snapshot.profiles);
  expect(restored.positions).toEqual(original[0].snapshot.positions);
  expect(restored.notes).toBe(original[0].snapshot.notes);
  expect(restored.useMainProfiles).toBe(false);
  await page.reload();
  await openWorkbench(page);
  await openDetails(workbench(page).locator('.compound-library'));
  await expect(workbench(page).locator('.compound-library-row')).toHaveCount(2);
  await noOverflow(page);
});

test('unknown machine mechanisms have no fabricated profile or joint moments and reduced motion keeps playback off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openWorkbench(page);
  const lab = workbench(page), a = lab.locator('.compound-a');
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('press-machine');
  await expect(a.locator('.compound-value')).toHaveText('Unavailable');
  await expect(a.locator('.compound-results')).toContainText('GEOMETRIC ILLUSTRATION');
  await expect(page.getByLabel('A compound resistance', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('A compound resistance', { exact: true })).toHaveValue('unknown');
  await expect(a.locator('.compound-curve path')).toHaveAttribute('d', /^\s*$/);
  await openDetails(a.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Results, assumptions and joint moments' }) }));
  await expect(a.locator('.compound-joint-table')).toHaveCount(0);
  await expect(a).toContainText('Individual joint moments: unavailable.');
  await expect(lab.getByRole('button', { name: 'Animate movement', exact: true })).toBeDisabled();
  await expect(lab).toContainText('Reduced motion enabled: use the position sliders.');
  await input(page, 'A · Movement progress').fill('70');
  await input(page, 'A · Movement progress').press('Tab');
  await expect.poll(async () => (await state(page))?.positions).toEqual([.7, .7]);
  await expect(a.locator('.compound-value')).toHaveText('Unavailable');
  await expect(a.locator('.compound-curve path')).toHaveAttribute('d', /^\s*$/);
  await noOverflow(page);
});

test('exercise drafts survive switching and reload, and matching movement curves share a quantitative scale', async ({ page }) => {
  await page.goto('/'); await openWorkbench(page);
  const lab = workbench(page), a = lab.locator('.compound-a'), b = lab.locator('.compound-b');
  await input(page, 'A · Force per active cable').fill('175');
  await input(page, 'A · Movement progress').fill('70');
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('bench-barbell');
  await input(page, 'A · External load · total').fill('63');
  await page.reload(); await openWorkbench(page);
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('row-seated');
  await expect(input(page, 'A · Force per active cable')).toHaveValue('175');
  await expect(input(page, 'A · Movement progress')).toHaveValue('70');
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('bench-barbell');
  await expect(input(page, 'A · External load · total')).toHaveValue('63');
  await page.getByLabel('A compound exercise', { exact: true }).selectOption('row-seated');
  await a.getByRole('checkbox', { name: 'Include declared body-segment weights', exact: true }).uncheck();
  await input(page, 'A · Force per active cable').fill('100');
  await lab.getByRole('button', { name: 'Copy A → B', exact: true }).click();
  await input(page, 'B · Force per active cable').fill('200');
  const chartA=a.locator('.compound-curve'), chartB=b.locator('.compound-curve');
  await expect(chartA).toHaveAttribute('data-shared-scale', 'true');
  expect(await chartA.getAttribute('data-y-extent')).toBe(await chartB.getAttribute('data-y-extent'));
  const startY=async (chart: Locator) => Number((await chart.locator('path').getAttribute('d'))!.match(/M[^,]+,(-?[\d.]+)/)![1]);
  expect(90-await startY(chartB)).toBeCloseTo(2*(90-await startY(chartA)), 5);
  await noOverflow(page);
});

test('workspace export refuses stale compound state after a save failure and retries the latest live edits', async ({ page }) => {
  await page.goto('/'); await openWorkbench(page);
  await input(page, 'A · Force per active cable').fill('120');
  await input(page, 'A · Force per active cable').press('Tab');
  await expect.poll(async () => (await state(page))?.configs[0].tension).toBe(120);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as typeof window & { restoreCompoundStorage?: () => void }).restoreCompoundStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Simulated storage quota failure', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, COMPOUND_KEY);
  await input(page, 'A · Force per active cable').fill('175');
  await input(page, 'A · Force per active cable').press('Tab');
  expect((await state(page))!.configs[0].tension).toBe(120);
  const backup=await openDrawer(page, 'workspace-backup');
  const downloads: string[]=[]; page.on('download', download => downloads.push(download.suggestedFilename()));
  await backup.getByRole('button', { name:'Export workspace', exact:true }).click();
  await expect(backup.getByRole('alert')).toContainText('Compound workspace:');
  await expect(backup.getByRole('alert')).toContainText('Simulated storage quota failure');
  expect(downloads).toEqual([]);
  await page.evaluate(() => (window as typeof window & { restoreCompoundStorage?: () => void }).restoreCompoundStorage?.());
  const pending=page.waitForEvent('download');
  await backup.getByRole('button', { name:'Export workspace', exact:true }).click();
  const exported=JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as {entries:{key:string;value:CompoundSnapshot}[]};
  expect(exported.entries.find(entry=>entry.key===COMPOUND_KEY)!.value.configs[0].tension).toBe(175);
  expect((await state(page))!.configs[0].tension).toBe(175);
});
