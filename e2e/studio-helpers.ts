import { allExerciseEntries } from '../src/allExercises';
import { expect, type Locator, type Page } from '@playwright/test';

export const field = (page: Page, label: string) => page.getByRole('spinbutton', { name: `${label} value`, exact: true, includeHidden: true });
export async function closeDialog(page: Page) {
  const dialog = page.locator('dialog.studio-dialog[open]');
  if (await dialog.count()) await dialog.getByRole('button', { name: /^Close / }).click();
}
export async function closeInspector(page: Page) {
  const inspector = page.getByRole('complementary', { name: 'Setup inspector', exact: true });
  if (await inspector.isVisible()) await inspector.getByRole('button', { name: 'Close setup inspector', exact: true }).click();
}
export async function openInspector(page: Page, side: 'A' | 'B') {
  await closeDialog(page);
  const inspector = page.locator('.setup-inspector');
  if (!(await inspector.isVisible())) await page.getByRole('button', { name: `Edit setup ${side}`, exact: true }).click();
  await inspector.getByRole('button', { name: `Configuration ${side}`, exact: true }).click();
  return inspector;
}
export async function revealControl(control: Locator) {
  const ancestors = control.locator('xpath=ancestor::details');
  for (let i = 0; i < await ancestors.count(); i++) {
    const details = ancestors.nth(i);
    if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
  }
}
export async function fillField(page: Page, label: string, value: string) {
  const control = field(page, label);
  if (await control.evaluate(node => !!node.closest('.setup-inspector'))) {
    const side = label.startsWith('B ·') ? 'B' : 'A';
    await openInspector(page, side);
    await revealControl(control);
    await control.fill(value); await control.blur();
    await closeInspector(page);
  } else {
    await closeDialog(page); await closeInspector(page); await revealControl(control);
    await control.fill(value); await control.blur();
  }
}
export async function openSettingsGroup(page: Page, side: 'A' | 'B', title: string) {
  await openInspector(page, side);
  const details = page.locator(`.settings-card.setup-${side.toLowerCase()}`).locator('details').filter({ has: page.locator('summary').filter({ hasText: title }) }).first();
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
}
export async function setLock(page: Page, label: string, checked: boolean) {
  const inspector = await openInspector(page, 'A');
  await inspector.getByRole('checkbox', { name: label, exact: true }).setChecked(checked);
  await closeInspector(page);
}
export async function selectSetupOption(page: Page, side: 'A' | 'B', label: string, value: string) {
  const inspector = await openInspector(page, side), control = inspector.getByLabel(label, { exact: true });
  await revealControl(control); await control.selectOption(value); await closeInspector(page);
}
export async function setSetupCheck(page: Page, side: 'A' | 'B', label: string, checked: boolean) {
  const inspector = await openInspector(page, side), control = inspector.locator(`.setup-${side.toLowerCase()}`).getByRole('checkbox', { name: label, exact: true });
  await revealControl(control); await control.setChecked(checked); await closeInspector(page);
}
export async function clickSetupButton(page: Page, side: 'A' | 'B', name: string) {
  const inspector = await openInspector(page, side), button = inspector.getByRole('button', { name, exact: true });
  await revealControl(button); await button.click(); await closeInspector(page);
}
export async function openTools(page: Page) {
  await closeInspector(page);
  const tools = page.getByRole('dialog', { name: 'Tools', exact: true });
  if (!await tools.isVisible()) {
    await closeDialog(page);
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
  }
  await expect(tools).toBeVisible();
  return tools;
}
export async function openDialog(page: Page, title: 'Exercise catalog' | 'Library & backup' | 'Example comparisons') {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  if (!await dialog.isVisible()) {
    const tools = await openTools(page);
    await tools.getByRole('button', { name: title, exact: true }).click();
  }
  await expect(dialog).toBeVisible(); return dialog;
}
export async function readComparisonName(page: Page) {
  const tools = await openTools(page);
  const name = tools.getByRole('textbox', { name: 'Comparison name', exact: true });
  await revealControl(tools.getByLabel('Comparison name', { exact: true }));
  return name;
}
export async function setComparisonName(page: Page, value: string) {
  const name = await readComparisonName(page);
  await name.fill(value); await name.blur(); await closeDialog(page);
}
export async function selectCompound(page: Page, id: string) {
  const select = page.getByLabel('A compound exercise', { exact: true });
  await revealControl(select); await select.selectOption(id);
}
export async function openDrawer(page: Page, id: string) {
  await openDialog(page, id === 'catalog' ? 'Exercise catalog' : id === 'example-comparisons' ? 'Example comparisons' : 'Library & backup');
  const details = page.locator(`#${id}`);
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
  return details;
}
export async function openTraining(page: Page) {
  await openDialog(page, 'Library & backup');
  const details = page.locator('details.workspace-drawer').filter({ has: page.locator('summary').filter({ hasText: 'Your exercise list' }) });
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
  return details;
}
export async function openAnalysis(page: Page) {
  await closeDialog(page); await closeInspector(page);
  const details = page.locator('details.analysis-workbench');
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
  await expect(page.getByRole('region', { name: 'Comparison analysis', exact: true })).toBeVisible();
}
export async function goWorkspace(page: Page, label: string) {
  const tools = await openTools(page);
  await tools.getByRole('button', { name: label, exact: true }).click();
  await expect(tools).toBeHidden();
}

export async function chooseCatalogPreset(page: Page, side: 'A' | 'B', id: string) {
  const entry = allExerciseEntries.find(entry => entry.id === id);
  if (!entry) throw new Error('Missing catalog fixture ' + id);
  const catalog = await openDrawer(page, 'catalog');
  await catalog.getByLabel('Search exercises', { exact: true }).fill(entry.name);
  await catalog.getByLabel('Catalog target', { exact: true }).selectOption(side === 'A' ? '0' : '1');
  await catalog.locator('.catalog-pick').filter({ has: page.getByText(entry.name, { exact: true }) }).click();
}
