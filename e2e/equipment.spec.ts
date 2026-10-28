import { test, expect, type Page } from '@playwright/test';
import { fillField, field, openSettingsGroup, selectSetupOption, setSetupCheck, clickSetupButton, closeInspector } from './studio-helpers';
import { STORAGE_KEY, type LabState } from '../src/state';

const input = field;
const savedSetup = (page: Page) => page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? '{}') as LabState).setups?.[0], STORAGE_KEY);
async function openEquipment(page: Page) {
  await openSettingsGroup(page, 'A', 'Equipment geometry & clearance');
}

test('lying postures, explicit outlets, signed equipment limits and support shapes survive reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Configuration A preset', { exact: true }).selectOption('curl-low');
  for (const posture of ['supine', 'prone', 'side-lying']) {
    await selectSetupOption(page, 'A', 'A posture', posture);
    await expect.poll(async () => (await savedSetup(page))?.posture).toBe(posture);
    await page.reload();
    await expect(page.locator('[aria-label="A posture"]')).toHaveValue(posture);
  }
  await openEquipment(page);
  await setSetupCheck(page, 'A', 'Set each outlet independently', true);
  await fillField(page, 'A · Outlet 1 Z', '850');
  await setSetupCheck(page, 'A', 'Declare apparatus adjustment limits', true);
  await fillField(page, 'A · Minimum pelvis X', '-900');
  await fillField(page, 'A · Maximum pelvis X', '900');
  await setSetupCheck(page, 'A', 'Explore outside declared adjustment limits', true);
  await clickSetupButton(page, 'A', 'Add seat / frame box');
  await fillField(page, 'A · Pelvis to pulley plane', '800');
  await expect.poll(async () => (await savedSetup(page))?.hipX).toBe(8);
  await closeInspector(page);
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
  await fillField(page, 'A · Shoulder-girdle elevation', '5');
  await openEquipment(page);
  await setSetupCheck(page, 'A', 'Check represented body capsules', true);
  await clickSetupButton(page, 'A', 'Add seat / frame box');

  await fillField(page, 'A · Obstacle 1 center Z', '100');
  await fillField(page, 'A · Obstacle 1 size X', '200');
  await fillField(page, 'A · Obstacle 1 size Y', '200');
  await fillField(page, 'A · Obstacle 1 size Z', '300');
  await setSetupCheck(page, 'A', 'Allow intended body support on this shape', false);
  await expect(panel.locator('.status-contact')).toContainText('Geometry contact');
  await expect(panel.locator('.moment')).toHaveText('— N');
  await expect.poll(async () => (await savedSetup(page))?.obstacles?.[0].allowBodyContact).toBe(false);
  await page.reload();
  await expect(panel.locator('.status-contact')).toContainText('Geometry contact');
  await expect(panel.locator('.moment')).toHaveText('— N');
  expect((await savedSetup(page)).bodyCollision).toBe(true);
});
