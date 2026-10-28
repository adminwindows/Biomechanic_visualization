import { field as studioField, fillField, openInspector, closeInspector, openSettingsGroup, setLock, selectSetupOption, setSetupCheck, clickSetupButton, openDialog, closeDialog, openDrawer, openTraining, openAnalysis, goWorkspace } from './studio-helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { presets, getDefinition } from '../src/engine';
import { STORAGE_KEY, type LabState } from '../src/state';
import { LIBRARY_KEY } from '../src/library';
import { allExerciseEntries } from '../src/allExercises';

const field = studioField;
const setupCard = (page: Page, side:'A'|'B') => page.getByRole('article',{name:`Configuration ${side}`,exact:true});
const settings = (page: Page, side:'A'|'B') => page.locator(`.settings-card.setup-${side.toLowerCase()}`);
const savedState = (page: Page) => page.evaluate(key => {try {return JSON.parse(localStorage.getItem(key) ?? 'null') as LabState | null;}catch{return null;}}, STORAGE_KEY);
async function openDetails(page:Page,side:'A'|'B',title:string){await openSettingsGroup(page,side,title);}
async function drawer(page:Page,id:string){return openDrawer(page,id);}
async function choose(page:Page,side:'A'|'B',id:string){await closeDialog(page);await closeInspector(page);await page.getByLabel(`Configuration ${side} preset`,{exact:true}).selectOption(id);}

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{level:1})).toBeVisible();});

test('catalog aliases and setup filters distinguish modeled exercises from machine illustrations', async({page}) => {
  const catalog = await drawer(page, 'catalog');
  const items = catalog.locator('.catalog-item');
  await expect(items).toHaveCount(allExerciseEntries.length);
  await catalog.getByLabel('Search exercises').fill('lat prayer');
  await expect(items.filter({hasText: 'Horizontal torso'}).first()).toBeVisible();
  await catalog.getByRole('button', {name: 'Clear filters'}).click();
  await catalog.getByLabel('Catalog equipment', {exact: true}).selectOption('Dumbbell');
  await expect(items.filter({hasText: 'Dumbbell lateral raise'}).first()).toBeVisible();
  await catalog.getByLabel('Catalog muscle group').selectOption('Deltoids');
  await catalog.getByLabel('Catalog main joint').selectOption('Shoulder');
  await catalog.getByLabel('Catalog posture').selectOption('Standing');
  await catalog.getByLabel('Catalog sides').selectOption('Unilateral');
  await expect(items.filter({hasText: 'Dumbbell lateral raise'}).first()).toBeVisible();
  await catalog.getByLabel('Catalog available model').selectOption('Geometry only');
  await expect(items).toHaveCount(0);
  await expect(catalog.getByText('No exercises match these filters.')).toBeVisible();
  await catalog.getByRole('button', {name: 'Clear filters'}).click();
  await catalog.getByLabel('Catalog available model').selectOption('Geometry only');
  const unknown = items.filter({hasText: 'Pullover machine · mechanism unknown'});
  await expect(unknown).toHaveCount(1);
  await unknown.locator('.catalog-pick').click();
  await expect(setupCard(page, 'A').locator('.status')).toContainText('Resistance not calculated');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('loads portable example comparisons directly and preserves the prior comparison for undo', async({page}) => {
  await expect.poll(() => savedState(page)).not.toBeNull();
  const initial = await savedState(page);
  const examples = await drawer(page, 'example-comparisons');
  await drawer(page,'example-comparisons');await examples.getByRole('button', {name: /^Pullover: change pulley height/}).click();
  await expect.poll(async () => (await savedState(page))?.criterion).not.toBe(initial?.criterion);
  const pullover = (await savedState(page))!;
  expect(pullover.setups[0].pulleyHeight).not.toBe(pullover.setups[1].pulleyHeight);
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  await expect.poll(async () => (await savedState(page))?.name).toBe(initial?.name);
  await drawer(page,'example-comparisons');await examples.getByRole('button', {name: /^Lateral raise: cable versus dumbbell/}).click();
  await expect.poll(async () => (await savedState(page))?.setups[1].resistance).toBe('dumbbell');
  expect((await savedState(page))!.setups[0].model).toBe('raise');
  await drawer(page,'example-comparisons');await examples.getByRole('button', {name: /^Same height, different arm proportions/}).click();
  await expect.poll(async () => (await savedState(page))?.lockBody).toBe(false);
  const proportions = (await savedState(page))!;
  expect(proportions.profiles[0].values.height).toBe(proportions.profiles[1].values.height);
  expect(proportions.profiles[0].values.upperArm).not.toBe(proportions.profiles[1].values.upperArm);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reference scenarios use distinct geometry and the unknown machine has no numeric profile',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const cases=['classic','outside','inside','bench','curl-low','curl-bayesian','extension-pushdown','extension-overhead','raise-cable','raise-dumbbell','fly-cable','hip-extension'];
  const geometrySignatures=new Set<string>();
  for(const id of cases){
    const preset=presets.find(item=>item.preset===id)!;
    await choose(page,'A',id);
    await page.locator('.movement-sliders input[type=number]').first().fill(String((preset.range[0]+preset.range[1])/2));
    await expect(setupCard(page,'A').locator('.scene-svg')).toHaveAttribute('aria-label',new RegExp(getDefinition(preset).angleLabel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    await expect(setupCard(page,'A').locator('.status')).not.toContainText('Resistance not calculated');
    await expect(setupCard(page,'A').locator('.moment')).not.toHaveText(/—/);
    geometrySignatures.add(await setupCard(page,'A').locator('.scene-svg line').evaluateAll(lines=>JSON.stringify(lines.map(line=>['x1','y1','x2','y2'].map(key=>line.getAttribute(key))))));
    await expect.poll(async()=> (await savedState(page))?.setups[0].preset).toBe(id);
  }
  expect(geometrySignatures.size).toBe(12);
  await choose(page,'A','machine-unknown');
  await expect(setupCard(page,'A').locator('.status')).toContainText('Resistance not calculated');
  await expect(setupCard(page,'A').locator('.moment')).toContainText('—');
  expect((await page.locator('[data-curve=A]').getAttribute('d'))?.trim()).toBe('');
  expect(errors).toEqual([]);
});

test('searches and favorites catalog entries and retains exercise-list resolutions',async({page})=>{
  const catalog=await drawer(page,'catalog');
  await page.getByLabel('Search exercises').fill('Bayesian');
  await expect(catalog.locator('.catalog-item')).toHaveCount(1);
  await page.getByRole('button',{name:'Favorite Bayesian curl · arm behind torso',exact:true}).click();
  await page.reload();await drawer(page,'catalog');
  await catalog.getByRole('checkbox',{name:'Favorites',exact:true}).check();
  await expect(catalog.locator('.catalog-item')).toHaveCount(1);
  await catalog.locator('.catalog-pick').click();
  await expect(page.getByLabel('Configuration A preset')).toHaveValue('curl-bayesian');
  const training=page.locator('details.workspace-drawer').filter({has:page.locator('summary').filter({hasText:'Your exercise list'})});
  await openTraining(page);
  await page.getByLabel('Training exercise list').fill('Low cable curl\npull\nunknown custom exercise');
  await page.getByRole('button',{name:'Match exercises',exact:true}).click();
  await expect(training.locator('.training-row')).toHaveCount(3);
  await page.getByLabel('Match pull',{exact:true}).selectOption('classic');
  await page.reload();await openTraining(page);
  await expect(page.getByLabel('Match pull',{exact:true})).toHaveValue('classic');
  await expect(training.locator('.training-row').filter({hasText:'unknown custom exercise'})).toContainText('unrecognized');
});

test('saves and reloads named comparisons, measured bodies and equipment through a library export',async({page})=>{
  await openDetails(page,'A','Body profile');await fillField(page, 'A · Upper arm', '37');
  await fillField(page, 'A · Pulley height', '205');
  const library=await drawer(page,'saved-library');
  await page.getByLabel('Library item name').fill('Personal overhead study');
  await page.getByRole('button',{name:'Save comparison',exact:true}).click();
  await page.getByRole('button',{name:'Save body profile',exact:true}).click();
  await page.getByRole('button',{name:'Save equipment/setup',exact:true}).click();
  await expect(library.locator('.saved-row')).toHaveCount(3);
  const snapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),LIBRARY_KEY);
  expect(snapshot.bodies[0].profile.provenance.upperArm).toBe('measured');
  await fillField(page, 'A · Pulley height', '180');
  await drawer(page,'saved-library');await library.getByRole('button',{name:'Open',exact:true}).click();
  await expect(field(page,'A · Pulley height')).toHaveValue('205');
  await drawer(page,'saved-library');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export entire library',exact:true}).click();
  const exported=JSON.parse(await readFile((await(await downloadPromise).path())!,'utf8'));
  expect(exported.bodies[0].profile.values.upperArm).toBe(.37);
  await page.evaluate(()=>localStorage.clear());await page.reload();await drawer(page,'saved-library');
  await page.getByLabel('Import library file').setInputFiles({name:'library.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await expect(library.locator('.saved-row')).toHaveCount(3);
  const bodyRow=library.locator('.saved-row').filter({has:page.getByRole('button',{name:'Delete body Personal overhead study'})});
  await bodyRow.getByRole('button',{name:'Use in A',exact:true}).click();
  await expect.poll(async()=> (await savedState(page))?.profiles[0].values.upperArm).toBe(.37);
  const equipmentRow=library.locator('.saved-row').filter({has:page.getByRole('button',{name:'Delete equipment Personal overhead study'})});
  await equipmentRow.getByRole('button',{name:'Use in A',exact:true}).click();
  await expect(field(page,'A · Pulley height')).toHaveValue('205');
});

test('distinguishes actual-force locking from matching selected mass and rejects unknown-force locks',async({page})=>{
  await selectSetupOption(page,'A','A load entry','mass');
  await fillField(page, 'A · Selected mass', '20');await fillField(page, 'A · Force transmission factor', '0.5');
  await selectSetupOption(page,'B','B load entry','mass');
  await fillField(page, 'B · Force transmission factor', '1');
  await setLock(page, 'Same force per attachment', true);
  await expect(field(page,'B · Selected mass')).toHaveValue('10');
  await fillField(page, 'A · Force transmission factor', '0.25');
  await expect(field(page,'B · Selected mass')).toHaveValue('5');
  await clickSetupButton(page,'A','Match selected mass A → B');
  await expect(field(page,'B · Selected mass')).toHaveValue('20');
  await expect(page.getByRole('checkbox',{name:'Same force per attachment',exact:true, includeHidden: true})).not.toBeChecked();
  await setSetupCheck(page,'A','Actual cable force is known',false);
  await expect(setupCard(page,'A').locator('.status')).toContainText('Resistance not calculated');
  await openInspector(page,'A');await page.getByRole('checkbox',{name:'Same force per attachment',exact:true}).click();await closeInspector(page);
  await expect(page.getByRole('checkbox',{name:'Same force per attachment',exact:true, includeHidden: true})).not.toBeChecked();
  await openAnalysis(page);await expect(page.getByRole('button',{name:'Set up a controlled pulley comparison',exact:true})).toBeDisabled();
  await setSetupCheck(page,'A','Actual cable force is known',true);
  await setSetupCheck(page,'A','Cable explicitly slack',true);
  await expect(setupCard(page,'A').locator('.status')).toContainText('Cable slack');
  await expect(setupCard(page,'A').locator('.moment')).toContainText('0.0');
});

test('equipment locks synchronize geometry while body edits preserve equipment placement',async({page})=>{
  await setLock(page, 'Same equipment', true);
  await fillField(page, 'A · Pulley height', '210');
  await expect(field(page,'B · Pulley height')).toHaveValue('210');
  await openDetails(page,'A','Body profile');await fillField(page, 'A · Torso', '65');
  await expect(field(page,'A · Pulley height')).toHaveValue('210');
  await expect(field(page,'A · Pelvis to pulley plane')).toHaveValue('135');
  await expect(field(page,'B · Pelvis to pulley plane')).toHaveValue('114.5');
  await setLock(page, 'Same equipment', false);
  await fillField(page, 'A · Pulley height', '220');await expect(field(page,'B · Pulley height')).toHaveValue('210');
});

test('enforces rigid grip geometry and support without silently stretching segments',async({page})=>{
  await fillField(page, 'A · Fixed elbow bend', '30');
  await fillField(page, 'A · Grip separation', '50');
  await expect(setupCard(page,'A').locator('.status')).not.toContainText('Outside physical bounds');
  await fillField(page, 'A · Grip separation', '100');
  await expect(setupCard(page,'A').locator('.status')).toContainText('Outside physical bounds');
  await clickSetupButton(page,'A','Derive grip width from shoulders');
  await expect(setupCard(page,'A').locator('.status')).not.toContainText('Outside physical bounds');
  await fillField(page, 'A · Pelvis height', '140');
  await expect(setupCard(page,'A').locator('.status')).toContainText('Outside physical bounds');
  await selectSetupOption(page,'A','A posture','kneeling');
  await expect(field(page,'A · Pelvis height')).toHaveValue('49');
  await expect(setupCard(page,'A').locator('.status')).not.toContainText('Outside physical bounds');
  await selectSetupOption(page,'A','A posture','seated');
  await expect(field(page,'A · Backrest above floor')).toHaveValue('60');
});

test('drags side-view equipment and keeps keyboard alternatives and shared zoom usable',async({page})=>{
  const outlet=page.getByRole('button',{name:'A: Move cable outlet',exact:true}).first();
  await outlet.scrollIntoViewIfNeeded();await outlet.focus();await page.keyboard.press('ArrowUp');
  await expect(field(page,'A · Pulley height')).toHaveValue('226');
  const initial=Number(await field(page,'A · Pulley height').inputValue());
  const box=(await outlet.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-16,{steps:4});await page.mouse.up();
  await expect.poll(async()=>Number(await field(page,'A · Pulley height').inputValue())).toBeGreaterThan(initial);
  const before=await field(page,'B · Pulley height').inputValue();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(page.locator('.toolbar-zoom')).toContainText('120%');
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await expect(page.locator('.toolbar-zoom')).toContainText('100%');
  await expect(field(page,'B · Pulley height')).toHaveValue(before);
});

test('gates incompatible curves and compares only matching complete selected regions',async({page})=>{
  await expect(page.locator('.curve-svg')).toHaveCount(1);
  await choose(page,'B','curl-low');
  await expect(page.locator('[data-comparison=incompatible]')).toBeVisible();
  await expect(page.locator('.curve-svg')).toHaveCount(2);
  await expect(page.getByLabel('Synchronization mode').locator('option[value=angle]')).toHaveJSProperty('disabled',true);
  await openAnalysis(page);await expect(page.getByText('These movements use different joint coordinates or force conventions.',{exact:false})).toBeVisible();
  await choose(page,'A','curl-bayesian');
  await expect(page.locator('.curve-svg')).toHaveCount(1);
  await page.getByLabel('Analysis minimum angle',{exact:true}).fill('40');await page.getByLabel('Analysis minimum angle',{exact:true}).press('Tab');
  await page.getByLabel('Analysis maximum angle',{exact:true}).fill('100');await page.getByLabel('Analysis maximum angle',{exact:true}).press('Tab');
  await page.getByLabel('Comparison criterion').fill('Compare elbow loading over40–100 degrees.');
  await page.getByLabel('Comparison notes').fill('Geometry is calculated; muscle growth remains untested.');
  await expect.poll(async()=> (await savedState(page))?.region).toEqual([40,100]);
  await expect(page.locator('[data-region-shade=true]')).toHaveCount(1);
  await page.reload();await openAnalysis(page);await expect(page.getByLabel('Analysis minimum angle',{exact:true})).toHaveValue('40');
  await expect(page.getByLabel('Comparison notes')).toHaveValue('Geometry is calculated; muscle growth remains untested.');
  await openDetails(page,'B','Equipment & movement range');await fillField(page, 'B · Minimum position', '60');
  await expect(page.getByText('A comparable region needs the same coordinate interval',{exact:false})).toBeVisible();
  const analysis=page.getByRole('region',{name:'Comparison analysis',exact:true});
  await expect(analysis.locator('table').first().locator('tbody tr').filter({hasText:'Mean resisting moment'}).locator('td').last()).toHaveText('—');
});

test('honors reduced motion and preserves manual positioning',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  await expect(page.getByRole('checkbox',{name:'Reduced motion · manual movement',exact:true})).toBeChecked();
  await expect(page.getByRole('button',{name:'Play animation',exact:true})).toBeDisabled();
  await fillField(page, 'Upper-arm elevation from torso', '170');
  await expect(field(page,'Upper-arm elevation from torso')).toHaveValue('170');
  await page.getByRole('checkbox',{name:'Reduced motion · manual movement',exact:true}).uncheck();
  await page.getByRole('button',{name:'Play animation',exact:true}).click();
  await expect(field(page,'Upper-arm elevation from torso')).not.toHaveValue('170');
  await page.getByRole('button',{name:'Pause animation',exact:true}).click();
});

test('a focused numeric field accepts an external posture update after its draft was committed',async({page})=>{
  await openInspector(page,'A');const pelvis=field(page,'A · Pelvis height');
  await pelvis.fill('140');
  await expect(pelvis).toBeFocused();
  // selectOption intentionally changes another control without moving DOM focus.
  await page.getByLabel('A posture',{exact:true}).selectOption('kneeling');
  await expect(pelvis).toHaveValue('49');
  await pelvis.press('Tab');
  await expect.poll(async()=> (await savedState(page))?.setups[0].hipHeight).toBe(.49);
  await expect(setupCard(page,'A').locator('.status')).not.toContainText('Outside physical bounds');
});

test('retains explicit hip segment masses and combines their gravity with cable loading', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Configuration A preset').selectOption('hip-extension');
  await openInspector(page,'A');const settings=page.locator('.settings-card.setup-a');
  await setSetupCheck(page,'A','Include explicitly estimated segment weight',true);
  await fillField(page,'A · Thigh mass','5');
  await fillField(page,'A · Lower-leg mass','3');
  await closeInspector(page);
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('exercise-biomechanics-lab.comparison.v1')||'null')?.setups[0].thighMass)).toBe(5);
  await page.reload();
  await expect(field(page,'A · Thigh mass')).toHaveValue('5');
  await expect(field(page,'A · Lower-leg mass')).toHaveValue('3');
  await expect(page.locator('.setup-card.setup-a .moment')).not.toContainText('—');
});

test('retains explicit bar length through saving and body edits', async ({page}) => {
  await page.goto('/');
  await openInspector(page,'A');const settings=page.locator('.settings-card.setup-a');
  await fillField(page,'A · Bar length','120');
  await openSettingsGroup(page,'A','Body profile');
  await fillField(page,'A · Shoulder width','45');
  await closeInspector(page);
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('exercise-biomechanics-lab.comparison.v1')||'null')?.setups[0].barLength)).toBe(1.2);
  await page.reload();
  await expect(field(page,'A · Bar length')).toHaveValue('120');
});
