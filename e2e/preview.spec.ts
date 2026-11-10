import { test, expect, type Page } from "@playwright/test";
import { openDrawer, closeDialog, goWorkspace } from "./studio-helpers";

const siblingPath = "/__biomechanics-preview-isolation__/";

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("offline-status")).toHaveText("Offline ready", { timeout: 25000 });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(new URL("sw.js", url).href);
}

test("serves a complete production preview, including first-use workspaces without a connection", async ({ page, context, baseURL, request }) => {
  const base = new URL(baseURL!);
  const errors: string[] = [];
  const missing: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400) missing.push(response.url()); });
  await ready(page, base.href);
  expect(await page.locator(".studio-brand img").evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const resources = await page.evaluate(async () => {
    await document.fonts.ready;
    return performance.getEntriesByType("resource").map(entry => new URL(entry.name).pathname);
  });
  for (const suffix of [".js", ".css", ".woff2"]) {
    expect(resources.some(path => path.startsWith(`${base.pathname}assets/`) && path.endsWith(suffix))).toBe(true);
  }
  for (const relation of ["manifest", "icon", "apple-touch-icon"]) {
    const href = await page.locator(`link[rel="${relation}"]`).getAttribute("href");
    expect(href?.startsWith(base.pathname)).toBe(true);
    expect((await request.get(href!)).ok()).toBe(true);
  }
  const manifest = await (await request.get(new URL("manifest.webmanifest", base).href)).json();
  for (const field of ["id", "start_url", "scope"]) expect(new URL(manifest[field], base).href).toBe(base.href);

  const examples = await openDrawer(page, "example-comparisons");
  const download = examples.getByRole("link", { name: "Download Lateral raise: cable versus dumbbell" });
  await expect(download).toHaveAttribute("href", `${base.pathname}examples/cable-vs-dumbbell-raise.json`);
  expect((await request.get(await download.getAttribute("href") as string)).ok()).toBe(true);
  await closeDialog(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("offline-status")).toHaveText("Working offline");
  const offlineExamples = await openDrawer(page, "example-comparisons");
  await offlineExamples.getByRole("button", { name: /^Lateral raise: cable versus dumbbell/ }).click();
  await expect(page.getByLabel("Configuration A preset", { exact: true })).toHaveValue("raise-cable");
  await expect(page.getByLabel("Configuration B preset", { exact: true })).toHaveValue("raise-dumbbell");
  for (const [label, title] of [
    ["Compound movements", "Movement studies"],
    ["Machines & measured profiles", "Machine profiles"],
    ["Find a setup & research", "Explore the possibilities"],
    ["Study planner", "Start with a question"],
    ["Measure & calibrate", "Measure before you infer"],
    ["Joint & exercise comparison", "Compare the mechanics."],
  ]) {
    await goWorkspace(page, label);
    await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
  }
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test("keeps previews and the root app independent on the same origin", async ({ page, context, baseURL }) => {
  const primaryURL = new URL(baseURL!);
  const siblingURL = new URL(siblingPath, primaryURL);
  const rootURL = new URL("/", primaryURL);
  const comparison = (tab: Page) => tab.getByRole("textbox", { name: "Comparison name", exact: true });
  await ready(page, primaryURL.href);
  await comparison(page).fill("Primary PR comparison");
  await comparison(page).blur();
  // Wait for debounced persistence before opening a competing deployment.
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).some(value => value.includes('"name":"Primary PR comparison"')))).toBe(true);
  const sibling = await context.newPage();
  await ready(sibling, siblingURL.href);
  await expect(comparison(sibling)).not.toHaveValue("Primary PR comparison");
  await comparison(sibling).fill("Sibling PR comparison");
  await comparison(sibling).blur();
  await expect.poll(() => sibling.evaluate(() => Object.values(localStorage).some(value => value.includes('"name":"Sibling PR comparison"')))).toBe(true);
  const before = await page.evaluate(() => caches.keys());
  expect(before).toHaveLength(2);
  // Closed preview tabs still need their caches for a later offline visit.
  await sibling.close();

  // Activating a root worker must not remove nested caches or intercept their shell.
  const root = await context.newPage();
  await ready(root, rootURL.href);
  await expect(comparison(root)).not.toHaveValue("Primary PR comparison");
  await expect(comparison(root)).not.toHaveValue("Sibling PR comparison");
  const after = await root.evaluate(() => caches.keys());
  expect(after).toEqual(expect.arrayContaining(before));
  expect(after).toHaveLength(3);
  const mounted = await root.evaluate(async () => Promise.all((await caches.keys()).map(async name => {
    const requests = await (await caches.open(name)).keys();
    return requests.map(request => new URL(request.url).pathname);
  })));
  for (const paths of mounted) {
    const scope = paths.includes(`${primaryURL.pathname}index.html`) ? primaryURL.pathname
      : paths.includes(`${siblingPath}index.html`) ? siblingPath : "/";
    expect(paths.every(path => path.startsWith(scope))).toBe(true);
  }
  // The destination has no worker yet, so the root worker gets a real chance to
  // interfere with the initial navigation. A valid preview must still boot itself.
  await root.evaluate(async url => (await navigator.serviceWorker.getRegistration(url))?.unregister(), siblingURL.href);
  await ready(root, siblingURL.href);
  await expect(comparison(root)).toHaveValue("Sibling PR comparison");
  expect(await root.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(after));

  await context.setOffline(true);
  await page.reload();
  await root.reload();
  await expect(comparison(page)).toHaveValue("Primary PR comparison");
  await expect(comparison(root)).toHaveValue("Sibling PR comparison");
  for (const tab of [page, root]) await expect(tab.getByTestId("offline-status")).toHaveText("Working offline");
});
