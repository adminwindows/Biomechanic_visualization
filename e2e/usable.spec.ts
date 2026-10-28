import { test, expect, type Page } from '@playwright/test';
import { BAR_RADIUS, RAD, defaultProfile, presets } from '../src/engine';
import { createInitialState, STORAGE_KEY, type LabState } from '../src/state';

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as LabState, STORAGE_KEY);
async function loadFixture(page: Page) {
  const state = createInitialState();
  const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
  const setup = { ...presets.find(p => p.preset === 'bench')!, tilt: 90, hipX: 1, hipHeight: .46,
    backLength: defaultProfile.torso - reach * Math.cos(196.1 * RAD) - BAR_RADIUS,
    range: [195.5, 197] as [number, number] };
  state.setups = [setup, structuredClone(setup)];
  state.angles = [196, 196];
  await page.addInitScript(({ key, state }) => {
    if (!sessionStorage.getItem('usable-fixture-loaded')) {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem('usable-fixture-loaded', 'yes');
    }
  }, { key: STORAGE_KEY, state });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('usable mode keeps edits and playback inside a selected clear portion and preserves original ranges', async ({ page }) => {
  await loadFixture(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Movement mode', { exact: true }).selectOption('usable');
  const portions = page.getByLabel('Shared clear portion', { exact: true });
  await expect(portions.locator('option')).toHaveCount(2);
  const angle = page.getByRole('spinbutton', { name: 'Upper-arm elevation from torso value', exact: true });
  await angle.fill('197');
  await angle.blur();
  await expect.poll(async () => (await saved(page)).angles[0]).toBeLessThan(196.1);
  await expect(page.locator('.setup-a .status')).not.toContainText('Backrest contact');
  await portions.selectOption('1');
  await expect.poll(async () => (await saved(page)).angles[0]).toBeGreaterThan(196.175);
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect.poll(async () => (await saved(page)).angles[0]).toBeGreaterThan(196.175);
  await expect(page.locator('.setup-a .status')).not.toContainText('Backrest contact');
  await page.reload();
  await expect(page.getByLabel('Movement mode', { exact: true })).toHaveValue('usable');
  await expect(portions).toHaveValue('1');
  expect((await saved(page)).setups.map(setup => setup.range)).toEqual([[195.5, 197], [195.5, 197]]);
  await page.getByLabel('Movement mode', { exact: true }).selectOption('explore');
  await angle.fill('196.14');
  await expect(page.locator('.setup-a .status')).toContainText('Backrest contact');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('usable mode blocks unsupported synchronized geometry and permits independent modeled motion', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Configuration B preset', { exact: true }).selectOption('machine-unknown');
  await page.getByLabel('Synchronization mode', { exact: true }).selectOption('progress');
  await page.getByLabel('Movement mode', { exact: true }).selectOption('usable');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await expect(page.getByText('Cable routing or machine motion is not modeled for this configuration.', { exact: false })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Shared movement progress value', exact: true })).toBeDisabled();
  await page.getByLabel('Synchronization mode', { exact: true }).selectOption('independent');
  await expect(page.getByLabel('A clear portion', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('B clear portion', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeEnabled();
  await page.getByLabel('Movement mode', { exact: true }).selectOption('explore');
  await expect(page.locator('.movement-sliders fieldset').nth(1)).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
