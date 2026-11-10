import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openDrawer } from "./studio-helpers";

// This suite needs a production build. Normal development-server workflows skip it.
test.skip(
  ({ baseURL }) => !baseURL?.includes(":4173"),
  "Run npm run test:pwa against a production build.",
);

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("offline-status")).toHaveText("Offline ready", {
    timeout: 25000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}
async function offlineDetails(page: Page) {
  const details = page.locator('.offline-details');
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
}

test("prepares the complete shell and supplies valid install icons", async ({
  page,
  request,
}) => {
  await ready(page);
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  for (const size of [192, 512]) {
    const response = await request.get(`/icons/icon-${size}.png`);
    const png = await response.body();
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  const cached = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter((key) =>
      key.startsWith("biomechanics-shell-"),
    );
    const assets = await Promise.all(
      keys.map(async (key) =>
        (await (await caches.open(key)).keys()).map(
          (request) => new URL(request.url).pathname,
        ),
      ),
    );
    return assets.flat();
  });
  expect(cached).toContain("/index.html");
  expect(cached).toContain("/manifest.webmanifest");
  expect(cached).toContain("/icons/icon-192.png");
  expect(cached).toContain("/examples/pullover-pulley-height.json");
  expect(cached).toContain("/examples/cable-vs-dumbbell-raise.json");
  expect(cached).toContain("/examples/equal-height-proportions.json");
  expect(
    cached.some((path) => path.endsWith(".js") && path.startsWith("/assets/")),
  ).toBe(true);
  expect(
    cached.some((path) => path.endsWith(".css") && path.startsWith("/assets/")),
  ).toBe(true);
});

test("reloads and edits the saved application with the network disconnected", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const name = page.getByRole("textbox", {
    name: "Comparison name",
    exact: true,
  });
  await name.fill("My offline comparison");
  await name.blur();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const entry = Object.keys(localStorage).find((key) =>
          key.startsWith("exercise-biomechanics-lab.comparison"),
        );
        return entry ? JSON.parse(localStorage.getItem(entry)!).name : null;
      }),
    )
    .toBe("My offline comparison");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("offline-status")).toHaveText(
    "Working offline",
  );
  await expect(name).toHaveValue("My offline comparison");
  await name.fill("Edited without a connection");
  await name.blur();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const entry = Object.keys(localStorage).find((key) =>
          key.startsWith("exercise-biomechanics-lab.comparison"),
        );
        return entry ? JSON.parse(localStorage.getItem(entry)!).name : null;
      }),
    )
    .toBe("Edited without a connection");
  await page.reload();
  await expect(name).toHaveValue("Edited without a connection");
  const examples = await openDrawer(page, 'example-comparisons');
  await examples.getByRole('button', {name: /^Lateral raise: cable versus dumbbell/}).click();
  await expect(page.getByLabel('Configuration A preset', {exact: true})).toHaveValue('raise-cable');
  await expect(page.getByLabel('Configuration B preset', {exact: true})).toHaveValue('raise-dumbbell');
  await page.getByRole('button', {name: 'Undo', exact: true}).click();
  await expect(name).toHaveValue("Edited without a connection");
  // Each workspace chunk must open for the first time from the prepared cache.
  const workspaces = [
    ['Compound movements', 'Movement studies'],
    ['Machines & measured profiles', 'Machine profiles'],
    ['Find a setup & research', 'Explore the possibilities'],
    ['Study planner', 'Start with a question'],
    ['Measure & calibrate', 'Measure before you infer'],
    ['Joint & exercise comparison', 'Compare the mechanics.'],
  ];
  for (const [label, title] of workspaces) {
    await page.getByRole('navigation', { name: 'Analysis workspaces' }).getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
    await expect(page.getByText('Opening workspace…', { exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("waits for an explicit update and saves the latest in-progress comparison before reloading", async ({
  page,
}) => {
  const path = resolve("dist/sw.js");
  const original = await readFile(path, "utf8");
  const indexPath = resolve("dist/index.html");
  const originalIndex = await readFile(indexPath, "utf8");
  const initialVersion = original.match(/const VERSION = "([a-f0-9]+)";/)![1];
  const updatedVersion = `${initialVersion}-test`;
  await page.addInitScript(() => {
    const key = 'exercise-biomechanics-lab.comparison.v1';
    if (localStorage.getItem(key) === null) localStorage.setItem(key, '{unreadable original');
  });
  await ready(page);
  const before = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      active: registration?.active?.state,
      controller: navigator.serviceWorker.controller?.scriptURL,
    };
  });
  expect(before.active).toBe("activated");
  try {
    // Different worker bytes produce an actual waiting service-worker update.
    await writeFile(
      indexPath,
      originalIndex.replace(initialVersion, updatedVersion),
    );
    await writeFile(
      path,
      original.replace(
        /const VERSION = "([a-f0-9]+)";/,
        (_, version) => `const VERSION = "${version}-test";`,
      ),
    );
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    const update = page.getByRole("button", {
      name: "Save & update",
      exact: true,
    });
    await expect(update).toBeVisible({ timeout: 25000 });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.waiting?.state,
        ),
      )
      .toBe("installed");
    // A navigation must keep the old complete shell until the update is accepted.
    await page.reload();
    await expect(
      page.locator('meta[name="biomechanics-build"]'),
    ).toHaveAttribute("content", initialVersion);
    await expect(update).toBeVisible();
    // An update must respect the unreadable-original pause until explicit recovery.
    await update.click();
    await expect(page.locator('.offline-error')).toContainText('Comparison saving is paused');
    expect(await page.evaluate(() => localStorage.getItem('exercise-biomechanics-lab.comparison.v1'))).toBe('{unreadable original');
    await expect(page.locator('meta[name="biomechanics-build"]')).toHaveAttribute('content', initialVersion);
    await page.getByRole('button', { name: 'Back up previous data & enable saving', exact: true }).click();
    expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('exercise-biomechanics-lab.recovery.') && localStorage.getItem(key) === '{unreadable original'))).toBe(true);
    const name = page.getByRole("textbox", {
      name: "Comparison name",
      exact: true,
    });
    await name.fill("Latest edit kept across an update");
    await Promise.all([page.waitForEvent("load"), update.click()]);
    await expect(name).toHaveValue("Latest edit kept across an update");
    await expect(
      page.locator('meta[name="biomechanics-build"]'),
    ).toHaveAttribute("content", updatedVersion);
    await expect(page.getByTestId("offline-status")).toHaveText(
      "Offline ready",
    );
  } finally {
    await writeFile(path, original);
    await writeFile(indexPath, originalIndex);
  }
});

test("does not claim installation just because a prompt was accepted", async ({
  page,
}) => {
  await ready(page);
  await offlineDetails(page);
  await page.evaluate(() => {
    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(prompt, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(prompt);
  });
  await page.getByRole("button", { name: "Install app", exact: true }).click();
  await expect(
    page.getByText("Installed on this device", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(
    page.getByText("Installed on this device", { exact: true }),
  ).toBeVisible();
});

test("detects an incomplete cache and repairs it before claiming offline readiness", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const key = (await caches.keys()).find((key) =>
      key.startsWith("biomechanics-shell-"),
    )!;
    await (
      await caches.open(key)
    ).delete(new URL("/icons/icon-192.png", location.href).href);
  });
  await page.reload();
  await expect(page.getByTestId("offline-status")).toHaveText(
    "Offline setup incomplete",
  );
  await offlineDetails(page);
  await page
    .getByRole("button", { name: "Retry offline setup", exact: true })
    .click();
  await expect(page.getByTestId("offline-status")).toHaveText("Offline ready");
  expect(
    await page.evaluate(async () =>
      Boolean(
        await caches.match(new URL("/icons/icon-192.png", location.href).href),
      ),
    ),
  ).toBe(true);
});

test('keeps offline guidance compact and requests storage protection only after a user action', async ({ page }) => {
  await page.addInitScript(() => {
    let requested = 0;
    Object.defineProperty(window, '__storageRequests', { get: () => requested });
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      persisted: async () => requested > 0,
      persist: async () => { requested++; return true; },
      estimate: async () => ({ usage: 2500000, quota: 100000000 }),
    } });
  });
  await ready(page);
  expect(await page.locator('.offline-details').evaluate(node => (node as HTMLDetailsElement).open)).toBe(false);
  expect((await page.locator('.offline-access').boundingBox())!.height).toBeLessThan(70);
  expect(await page.evaluate(() => (window as Window & { __storageRequests?: number }).__storageRequests)).toBe(0);
  await offlineDetails(page);
  await expect(page.getByRole('heading', { name: 'Works offline after preparation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs a connection' })).toBeVisible();
  await expect(page.locator('.offline-details')).toContainText('Hosting sign-in');
  await expect(page.locator('.offline-diagnostics')).toContainText('Available for a small test write');
  await expect(page.locator('.offline-diagnostics')).toContainText('2.5 MB used');
  expect(await page.evaluate(() => (window as Window & { __storageRequests?: number }).__storageRequests)).toBe(0);
  await page.getByRole('button', { name: 'Request storage protection', exact: true }).click();
  await expect(page.locator('.offline-diagnostics')).toContainText('Persistent storage granted');
  expect(await page.evaluate(() => (window as Window & { __storageRequests?: number }).__storageRequests)).toBe(1);
  await expect(page.getByRole('button', { name: 'Request storage protection', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reports storage denial and quota trouble without changing saved work', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      persisted: async () => false, persist: async () => false,
      estimate: async () => ({ usage: 100000000, quota: 100000000 }),
    } });
  });
  await ready(page);
  await offlineDetails(page);
  await page.getByRole('button', { name: 'Request storage protection', exact: true }).click();
  await expect(page.locator('.offline-storage')).toContainText('Persistent storage was not granted');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    localStorage.setItem('offline-diagnostic-personal-data', 'keep');
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('biomechanics.storage-check.')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Check storage', exact: true }).click();
  await expect(page.locator('.offline-storage').getByRole('alert')).toContainText('Local saving is unavailable or full');
  expect(await page.evaluate(() => localStorage.getItem('offline-diagnostic-personal-data'))).toBe('keep');
});
