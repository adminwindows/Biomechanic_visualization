# Offline access, storage and installation

The application runs its mechanics and manages workspace data in the browser. The compact **Offline & storage** status opens details, installation guidance and storage diagnostics. It does not present an installation banner on every visit. **Save & update** remains visible when an app update is waiting.

## What works without a connection

After **Offline ready**, the prepared application includes the exercise catalog, all mechanics workbenches, saved profiles and research entries, the three example comparisons, and local file import/export. Calculation and editing do not call a remote model or AI service. Workspace data remains in browser storage unless the user exports a file.

A connection is needed for the first load and cache preparation, new application builds, cache repair, external reference websites and any hosting sign-in/access change. The service worker requests app files only from the application's own origin. Opening a prepared app can work offline; a new browser context or an unprepared hosting sign-in page cannot be assumed available offline. Application offline readiness does not establish that an external authentication service or reference site has been cached.

Runtime network audit: `ExampleComparisons.tsx` fetches the same-origin `/examples/*.json` files, which production preparation includes. The generated service worker requests same-origin assets and navigations, checks for updates, and repairs missing cached files. Reference citations are ordinary links opened by the user. No application telemetry, body-data upload, cloud synchronization or external AI-provider request is implemented. Hosting behavior is separate from these application requests.

## A future native Android package

The current app is a browser/PWA, not an APK. A native wrapper or native implementation could bundle the code, catalog, fonts and examples and store its work locally. None of the current calculations needs a remote server. Such packaging would need its own file-storage, update and real-device testing. Internet would still be needed for optional external references, downloading updates, cloud synchronization if added, or a remote AI service if explicitly introduced. A future on-device AI model could also run locally, but model size, memory, latency and quality would have to be evaluated; none is currently included.

## Keep your work

Opening **Offline & storage** checks whether a small local-storage write succeeds, whether the browser reports persistent retention, and its approximate origin-wide usage/quota. These diagnostics do not request permission. The temporary probe is removed; existing saved work is not changed. A successful small write does not guarantee that a larger workspace will fit, and the quota estimate includes cached files rather than being a dedicated local-storage allowance.

**Request storage protection** is an explicit user action using `navigator.storage.persist()` where supported. A browser may grant or decline it without displaying a prompt. The app reports the actual decision. Protection can reduce automatic eviction under storage pressure; it does not prevent clearing browser data, changing devices, or losing a private session. It is not cloud backup.

Keep a portable copy using **Whole workspace backup**. If saving is unavailable or full, export before leaving and inspect the browser's site-storage controls. Storage diagnostics do not delete caches, comparisons or other application data automatically.

## Installation is optional

Use the hosted HTTPS app directly in a browser, or install it if convenient. Android Chrome offers **Install app** or **Add to Home screen** in its menu when supported. Safari on iPhone/iPad uses **Share → Add to Home Screen**. Desktop browsers may offer their own install action.

Wait for **Offline ready** before disconnecting. Readiness is reported only after the active service worker verifies its required cached files. Installation and caching are separate: accepting an install prompt does not prove installation, and installing does not guarantee a completed cache. The app waits for the platform's installed event or standalone display mode before reporting installation.

## Build and cache design

Run `node scripts/generate-sw.mjs` after the Vite production build. The helper hashes the built content, inserts a build marker in the HTML, and generates `dist/sw.js` with the exact precache asset list. It requires the manifest and 192/512 px icons and fails if these assets are missing. It does not cache the development server.

Installation is all-or-nothing: if any required asset request fails, the new cache is removed and the worker does not finish installation. Readiness is checked by a service-worker message that verifies all entries, not inferred from a successful registration call. The HTML build marker must match the worker, preventing a deployment that changes midway through preparation from mixing shells and assets. If an entry is later evicted, the readiness check fails; **Retry offline setup** restores missing files from the same build when available.

Navigations try the network and fall back to the cached HTML shell offline. A response belonging to a different build is held back: the current complete cached shell remains active until its corresponding worker update is accepted. Assets have content-hashed filenames and are served from the matching cache. Cross-origin requests and non-GET requests are not intercepted.

A new worker waits while an earlier version has clients. The UI announces **Save & update**; it does not force a reload while the user is editing. The application flushes mounted workbench edits and saves its latest comparison through `beforeReload` before requesting activation. Pending research/planner drafts or machine curve, formula or calibration drafts must be saved, applied or discarded explicitly; their guards can stop the update. If saving fails, the update is not activated and an error asks the user to retain their work. Old caches are cleaned only during activation. The worker asks every open tab which build it uses and retains those builds for their immutable asset requests. If a tab cannot identify its build, cleanup is deferred rather than risking a mixed or incomplete version. Navigation falls back to the prepared shell after 3.5 seconds if a connection stalls.

## Integration

- Add `<link rel="manifest" href="/manifest.webmanifest">` and the touch icon to the HTML head.
- Append `&& node scripts/generate-sw.mjs` to the production build command.
- Render `<OfflineStatus beforeReload={...} />`. The callback must persist the current in-memory comparison immediately and throw if it cannot be saved; do not rely on a debounced autosave finishing before reload.
- Add `test:pwa` with `playwright test --config playwright.offline.config.ts`.

## Verification

The production Chromium suite covers complete precaching and PNG icon dimensions; disconnected reload, editing and prepared examples; explicit updates preserving the last in-progress edit; truthful installation status; incomplete-cache detection and repair; compact storage diagnostics; and user-triggered persistence requests, denial and quota errors. See [VERIFICATION.md](VERIFICATION.md) for the checks actually run against the delivered build. Run a production build first, then:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:pwa
```

Omit the executable override when using Playwright's installed browser. The dedicated suite serves the production build on port 4173; development-server tests skip these cases.

A Chromium test with the network disabled verifies the offline flow. It does not establish Android home-screen behavior, operating-system cache retention, or every browser's installation support. Real Android device acceptance remains a separate check.
