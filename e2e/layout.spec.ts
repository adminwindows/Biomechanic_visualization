import { test, expect } from '@playwright/test';

test('phone landscape keeps both scenes, curves and keyboard controls usable without overflow',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  const a=page.getByRole('article',{name:'Configuration A',exact:true});
  const b=page.getByRole('article',{name:'Configuration B',exact:true});
  await expect(a).toBeVisible();await expect(b).toBeVisible();
  const aBox=(await a.boundingBox())!,bBox=(await b.boundingBox())!;
  expect(Math.abs(aBox.y-bBox.y)).toBeLessThan(1);
  expect(Math.abs(aBox.width-bBox.width)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
  await page.getByRole('button',{name:'Top view',exact:true}).tap();
  await expect(page.locator('.scene-top')).toHaveCount(2);
  await page.getByRole('button',{name:'Side view',exact:true}).tap();
  const chart=page.locator('.curve-svg');await chart.scrollIntoViewIfNeeded();await chart.focus();await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('spinbutton',{name:'Upper-arm elevation from torso value',exact:true})).toHaveValue('159');
  await page.getByRole('button',{name:'Zoom in',exact:true}).tap();
  await expect(page.locator('.toolbar-zoom')).toContainText('120%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
  expect(errors).toEqual([]);
});

test('phone landscape supports catalog selection and accessible region tables',async({page})=>{
  await page.goto('/');await page.locator('#catalog>summary').tap();
  await page.getByLabel('Search exercises',{exact:true}).fill('lateral raise');
  await expect(page.locator('#catalog .catalog-pick').filter({hasText:'Unilateral cable lateral raise'})).toBeVisible();
  await page.locator('#catalog .catalog-pick').filter({hasText:'Unilateral cable lateral raise'}).tap();
  await expect(page.getByLabel('Configuration A preset',{exact:true})).toHaveValue('raise-cable');
  await expect(page.locator('[data-comparison=incompatible]')).toBeVisible();
  await expect(page.locator('.curve-svg')).toHaveCount(2);
  const results=page.getByRole('region',{name:'Comparison analysis',exact:true}).getByRole('region',{name:'Scrollable results table'}).first();
  await results.scrollIntoViewIfNeeded();await results.focus();await expect(results).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
});
