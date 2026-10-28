import { test, expect, type Page } from '@playwright/test';
import { STORAGE_KEY, type LabState } from '../src/state';

const input = (page: Page, label: string) => page.getByRole('spinbutton', { name: `${label} value`, exact: true });
const settings = (page: Page) => page.locator('.settings-card.setup-a');
const savedSetup = (page: Page) => page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? '{}') as LabState).setups?.[0], STORAGE_KEY);
async function openEquipment(page: Page) {
  await settings(page).getByText('Equipment geometry & clearance', { exact: true }).click();
}

test('lying postures, explicit outlets, signed equipment limits and support shapes survive reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('curl-low');
  for (const posture of ['supine', 'prone', 'side-lying']) {
    await page.getByLabel('A posture', { exact: true }).selectOption(posture);
    await expect.poll(async () => (await savedSetup(page))?.posture).toBe(posture);
    await page.reload();
    await expect(page.getByLabel('A posture', { exact: true })).toHaveValue(posture);
  }
  await openEquipment(page);
  await settings(page).getByLabel('Set each outlet independently', { exact: true }).check();
  await input(page, 'A · Outlet 1 Z').fill('850');
  await settings(page).getByLabel('Declare apparatus adjustment limits', { exact: true }).check();
  await input(page, 'A · Minimum pelvis X').fill('-900');
  await input(page, 'A · Maximum pelvis X').fill('900');
  await settings(page).getByLabel('Explore outside declared adjustment limits', { exact: true }).check();
  await settings(page).getByRole('button', { name: 'Add seat / frame box', exact: true }).click();
  await input(page, 'A · Pelvis to pulley plane').fill('800');
  await expect.poll(async () => (await savedSetup(page))?.hipX).toBe(8);
  const before = await savedSetup(page);
  expect(before.outletPositions?.[0][2]).toBe(8.5);
  expect(before.obstacles?.[0].allowBodyContact).toBe(true);
  expect(before.equipmentLimits).toEqual({ pulleyMin: .05, pulleyMax: 3, distanceMin: -9, distanceMax: 9 });
  await page.reload();
  expect(await savedSetup(page)).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('shrug uses centimetres and force, and a blocking body obstacle suppresses mechanics', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('shrug-dumbbell');
  const panel = page.getByRole('article', { name: 'Configuration A', exact: true });
  await expect(panel.locator('.moment')).toHaveText('+196.2 N');
  await expect(input(page, 'A · Shoulder-girdle elevation')).toBeVisible();
  await expect(input(page, 'A · Shoulder-girdle elevation').locator('..')).toContainText('cm');
  await input(page, 'A · Shoulder-girdle elevation').fill('5');
  await openEquipment(page);
  await settings(page).getByLabel('Check represented body capsules', { exact: true }).check();
  await settings(page).getByRole('button', { name: 'Add seat / frame box', exact: true }).click();
  await settings(page).getByText('Seat / frame box', { exact: true }).click();
  await input(page, 'A · Obstacle 1 center Z').fill('100');
  await input(page, 'A · Obstacle 1 size X').fill('200');
  await input(page, 'A · Obstacle 1 size Y').fill('200');
  await input(page, 'A · Obstacle 1 size Z').fill('300');
  await settings(page).getByLabel('Allow intended body support on this shape', { exact: true }).uncheck();
  await expect(panel.locator('.status-contact')).toContainText('Geometry contact');
  await expect(panel.locator('.moment')).toHaveText('— N');
  await expect.poll(async () => (await savedSetup(page))?.obstacles?.[0].allowBodyContact).toBe(false);
  await page.reload();
  await expect(panel.locator('.status-contact')).toContainText('Geometry contact');
  await expect(panel.locator('.moment')).toHaveText('— N');
  expect((await savedSetup(page)).bodyCollision).toBe(true);
});
