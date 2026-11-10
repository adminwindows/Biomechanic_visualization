import { test, expect, type Page } from '@playwright/test';
import { createInitialState, STORAGE_KEY, type LabState } from '../src/state';
import { studyBasis, type StudyProposal } from '../src/studyAssistant';

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as LabState, STORAGE_KEY);
function fixture() {
  const state = createInitialState();
  state.setups[0].range = [80, 150]; state.angles = [100, 100]; state.region = [90, 140];
  state.notes = 'PRIVATE study notes'; state.setups[1].name = 'PRIVATE previous B';
  return state;
}
async function open(page: Page, state = fixture()) {
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: STORAGE_KEY, state });
  await page.goto('/');
  await page.getByRole('button', { name: 'Study planner', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Study assistant', exact: true })).toBeVisible();
}
function proposal(state: LabState): StudyProposal {
  return { format: 'biomechanics-study-proposal', version: 1, target: 'B', basis: studyBasis(state), question: 'Does a higher outlet change the external contribution?', rationale: 'External explanation for local review, not a measured finding.', changes: [{ parameter: 'pulleyHeight', value: state.setups[0].pulleyHeight + .15 }] };
}

test('offline planner interprets a question, calculates a review and changes only controlled B', async ({ page, context }, testInfo) => {
  await open(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const before = await saved(page);
  await context.setOffline(true);
  await page.getByLabel('Study question', { exact: true }).fill('Lower the pulley by 20 cm and inspect resistance.');
  await page.getByRole('button', { name: 'Interpret question locally', exact: true }).click();
  await expect(page.getByLabel('Study variable', { exact: true })).toHaveValue('pulleyHeight');
  await expect(page.getByLabel('Study change amount', { exact: true })).toHaveValue('0.2');
  await page.getByRole('button', { name: 'Calculate study preview', exact: true }).click();
  const review = page.getByRole('region', { name: 'Study proposal review', exact: true });
  await expect(review).toBeVisible();
  await expect(review).toContainText('Both region summaries are complete');
  await expect(review).toContainText('Calculated region: 90–140°');
  expect((await saved(page)).setups).toEqual(before.setups);
  await expect(page.getByRole('button', { name: 'Apply reviewed proposal to B', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'desktop') await page.locator('.study-assistant').screenshot({ path: '/tmp/study-assistant-desktop.png' });
  await page.getByRole('button', { name: 'Apply reviewed proposal to B', exact: true }).click();
  await expect.poll(async () => (await saved(page)).setups[1].pulleyHeight).toBeCloseTo(before.setups[0].pulleyHeight - .2);
  const after = await saved(page);
  expect(after.setups[0]).toEqual(before.setups[0]); expect(after.profiles[0]).toEqual(before.profiles[0]);
  expect(after.profiles[1]).toEqual(before.profiles[0]); expect(after.setups[1].range).toEqual(before.setups[0].range);
  expect(after.setups[1].tension).toBe(before.setups[0].tension); expect(after.notes).toBe(before.notes);
  expect(errors).toEqual([]);
});

test('manual exchange shares only selected context and reviews imported geometry before apply', async ({ page }) => {
  await open(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Prepare exchange preview', exact: true }).click();
  const preview = page.getByLabel('AI exchange preview', { exact: true });
  expect(await preview.inputValue()).not.toContain('"bodyA"');
  expect(await preview.inputValue()).not.toContain('"setupA"');
  expect(await preview.inputValue()).not.toContain('PRIVATE');
  await page.getByRole('checkbox', { name: 'A body dimensions, provenance and locks', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Download selected context', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Prepare exchange preview', exact: true }).click();
  expect(await preview.inputValue()).toContain('"bodyA"');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download selected context', exact: true }).click();
  const file = await download; expect(file.suggestedFilename()).toBe('biomechanics-ai-exchange.txt');
  const stream = await file.createReadStream(); let text = ''; for await (const chunk of stream!) text += chunk;
  expect(text).toContain('RESPONSE JSON SCHEMA'); expect(text).not.toContain('PRIVATE');
  await page.getByText('Review a proposal returned by an assistant', { exact: true }).click();
  await page.getByLabel('Import study proposal file', { exact: true }).setInputFiles({ name: 'proposal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal(before))) });
  const review = page.getByRole('region', { name: 'Study proposal review', exact: true });
  await expect(review).toContainText('Unverified external explanation');
  await expect(review).toContainText('External proposal · locally recalculated');
  expect((await saved(page)).setups).toEqual(before.setups);
  await expect(page.getByRole('button', { name: 'Apply reviewed proposal to B', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Apply reviewed proposal to B', exact: true }).click();
  await expect.poll(async () => (await saved(page)).setups[1].pulleyHeight).toBeCloseTo(before.setups[0].pulleyHeight + .15);
  expect((await saved(page)).setups[0]).toEqual(before.setups[0]);
});

test('invalid AI fields and stale planner input cannot apply an old review', async ({ page }) => {
  await open(page);
  const before = await saved(page);
  await page.getByText('Review a proposal returned by an assistant', { exact: true }).click();
  await page.getByLabel('Study proposal JSON', { exact: true }).fill(JSON.stringify({ ...proposal(before), execute: 'fetch("https://example.invalid")' }));
  await page.getByRole('button', { name: 'Validate & recalculate proposal', exact: true }).click();
  await expect(page.locator('.study-assistant').getByRole('status')).toContainText('unsupported fields');
  await expect(page.getByRole('region', { name: 'Study proposal review', exact: true })).toHaveCount(0);
  expect((await saved(page)).setups).toEqual(before.setups);
  await page.getByRole('button', { name: 'Calculate study preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply reviewed proposal to B', exact: true })).toBeEnabled();
  await page.getByLabel('Study change amount', { exact: true }).fill('0.3');
  await expect(page.getByRole('button', { name: 'Apply reviewed proposal to B', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Study proposal review', exact: true })).toContainText('inputs changed');
});

test('planner draft protects workspace reload until exported or explicitly discarded', async ({ page }) => {
  await open(page);
  const flush = () => page.evaluate(() => {
    const detail = { errors: [] as string[] }; window.dispatchEvent(new CustomEvent('biomechanics:flush-workspaces', { detail })); return detail.errors;
  });
  expect(await flush()).toEqual([]);
  await page.getByLabel('Study question', { exact: true }).fill('Unfinished calibration question');
  expect((await flush()).join(' ')).toContain('Study planner has an unsaved draft');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export planner draft', exact: true }).click();
  const file = await download; const stream = await file.createReadStream(); let text = ''; for await (const chunk of stream!) text += chunk;
  expect(JSON.parse(text)).toMatchObject({ format: 'biomechanics-study-draft', question: 'Unfinished calibration question' });
  expect(text).not.toContain('PRIVATE');
  expect(await flush()).toEqual([]);
  await page.getByLabel('Study question', { exact: true }).fill('Later unsaved change');
  await page.getByRole('button', { name: 'Discard planner changes', exact: true }).click();
  await expect(page.getByLabel('Study question', { exact: true })).toHaveValue('Unfinished calibration question');
  expect(await flush()).toEqual([]);
});
