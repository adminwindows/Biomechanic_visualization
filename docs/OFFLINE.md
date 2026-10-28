# Installation, offline use and updates

The hosted HTTPS application can be used directly in a browser. Installation is optional. On compatible Android Chrome versions, use **Install app** if offered, or the browser menu's **Install app / Add to Home screen** action. Safari on iPhone/iPad uses **Share → Add to Home Screen**. Desktop installation depends on the browser.

Wait for **Offline ready** before disconnecting. That message appears only after the active service worker verifies that every required shell asset was stored: HTML, JavaScript, CSS, the exercise catalog/model code bundled in JavaScript, manifest and icons. The app continues to use browser-local profiles and comparisons offline. Export a copy because browser storage can still be cleared; offline storage does not synchronize devices.

Installation and caching are separate facts. Accepting an install prompt does not by itself display an “installed” claim. The application waits for the platform's installed event or standalone display mode. A web manifest is not evidence that installation works on every Android device.

## Build and cache design

Run `node scripts/generate-sw.mjs` after the Vite production build. The helper hashes the built content, inserts a build marker in the HTML, and generates `dist/sw.js` with the exact precache asset list. It requires the manifest and 192/512 px icons and fails if these assets are missing. It does not cache the development server.

Installation is all-or-nothing: if any required asset request fails, the new cache is removed and the worker does not finish installation. Readiness is checked by a service-worker message that verifies all entries, not inferred from a successful registration call. The HTML build marker must match the worker, preventing a deployment that changes midway through preparation from mixing shells and assets. If an entry is later evicted, the readiness check fails; **Retry offline setup** restores missing files from the same build when available.

Navigations try the network and fall back to the cached HTML shell offline. A response belonging to a different build is held back: the current complete cached shell remains active until its corresponding worker update is accepted. Assets have content-hashed filenames and are served from the matching cache. Cross-origin requests and non-GET requests are not intercepted.

A new worker waits while an earlier version has clients. The UI announces **Save & update**; it does not force a reload while the user is editing. The application saves its latest comparison through `beforeReload` before requesting activation. If saving fails, the update is not activated and an error asks the user to retain their work. Old caches are cleaned only during activation. The worker asks every open tab which build it uses and retains those builds for their immutable asset requests. If a tab cannot identify its build, cleanup is deferred rather than risking a mixed or incomplete version. Navigation falls back to the prepared shell after 3.5 seconds if a connection stalls.

## Integration

- Add `<link rel="manifest" href="/manifest.webmanifest">` and the touch icon to the HTML head.
- Append `&& node scripts/generate-sw.mjs` to the production build command.
- Render `<OfflineStatus beforeReload={...} />`. The callback must persist the current in-memory comparison immediately and throw if it cannot be saved; do not rely on a debounced autosave finishing before reload.
- Add `test:pwa` with `playwright test --config playwright.offline.config.ts`.

## Verification

All five production Chromium checks passed for this implementation: complete precaching and PNG icon dimensions; offline reload and edits; explicit updates preserving the last in-progress edit while pinning the old shell until acceptance; truthful installation status; and detection/repair of an incomplete cache. Run a production build first, then:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:pwa
```

Omit the executable override when using Playwright's installed browser. The dedicated suite serves the production build on port 4173; development-server tests skip these cases.

A Chromium test with the network disabled verifies the offline flow. It does not establish Android home-screen behavior, operating-system cache retention, or every browser's installation support. Real Android device acceptance remains a separate check.
