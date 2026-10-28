export type OfflinePhase =
  | "checking"
  | "preparing"
  | "ready"
  | "development"
  | "unsupported"
  | "error";
export type OfflineState = {
  phase: OfflinePhase;
  online: boolean;
  updateAvailable: boolean;
  applyingUpdate: boolean;
  installAvailable: boolean;
  installed: boolean;
  error: string | null;
  version: string | null;
  storage: StorageHealth;
};
export type StorageHealth = {
  checked: boolean;
  checking: boolean;
  writable: boolean | null;
  persistent: boolean | null;
  canRequestPersistence: boolean;
  requestingPersistence: boolean;
  usage: number | null;
  quota: number | null;
  error: string | null;
  notice: string | null;
};
type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
const environment = (
  import.meta as ImportMeta & { env: { PROD: boolean; BASE_URL: string } }
).env;
const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
let state: OfflineState = {
  phase: "checking",
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  updateAvailable: false,
  applyingUpdate: false,
  installAvailable: false,
  installed: standalone(),
  error: null,
  version: null,
  storage: { checked: false, checking: false, writable: null, persistent: null, canRequestPersistence: false, requestingPersistence: false, usage: null, quota: null, error: null, notice: null },
};
const listeners = new Set<() => void>();
let started = false;
let registration: ServiceWorkerRegistration | null = null;
let prompt: InstallPrompt | null = null;
let reloadRequested = false;
let registering: Promise<void> | null = null;
let checkingStorage: Promise<void> | null = null;

export const getOfflineState = () => state;
export function subscribeOffline(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(patch: Partial<OfflineState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
function publishStorage(patch: Partial<StorageHealth>) {
  publish({ storage: { ...state.storage, ...patch } });
}

/** Local diagnostics only. This never requests persistent-storage permission. */
export async function refreshStorageHealth(): Promise<void> {
  if (checkingStorage) return checkingStorage;
  publishStorage({ checking: true, error: null });
  checkingStorage = (async () => {
    const failures: string[] = [];
    let writable = false;
    const probe = `biomechanics.storage-check.${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}.${Math.random().toString(36).slice(2)}`}`;
    try { localStorage.setItem(probe, '1'); localStorage.removeItem(probe); writable = true; }
    catch { failures.push('Local saving is unavailable or full. Export your current workspace before leaving.'); }
    const manager = typeof navigator === 'undefined' ? undefined : navigator.storage;
    let persistent: boolean | null = null, usage: number | null = null, quota: number | null = null;
    const results = await Promise.allSettled([
      Promise.resolve().then(() => manager?.persisted ? manager.persisted() : null),
      Promise.resolve().then(() => manager?.estimate ? manager.estimate() : null),
    ]);
    const retention = results[0], estimate = results[1];
    if (retention.status === 'fulfilled') persistent = retention.value;
    else failures.push('The browser could not report its storage-retention policy.');
    if (estimate.status === 'fulfilled' && estimate.value) {
      usage = typeof estimate.value.usage === 'number' && Number.isFinite(estimate.value.usage) ? estimate.value.usage : null;
      quota = typeof estimate.value.quota === 'number' && Number.isFinite(estimate.value.quota) ? estimate.value.quota : null;
    } else if (estimate.status === 'rejected') failures.push('The browser could not estimate available storage.');
    publishStorage({ checked: true, checking: false, writable, persistent, usage, quota, canRequestPersistence: typeof manager?.persist === 'function', error: failures.join(' ') || null });
  })().finally(() => { checkingStorage = null; });
  return checkingStorage;
}

/** Invoke only from the explicit user action; browsers may decline without a prompt. */
export async function requestPersistentStorage(): Promise<void> {
  if (state.storage.requestingPersistence || state.storage.persistent) return;
  const manager = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!manager?.persist) {
    publishStorage({ canRequestPersistence: false, notice: 'This browser does not offer a persistent-storage request. Export backups to retain your work.' });
    return;
  }
  publishStorage({ requestingPersistence: true, error: null, notice: null });
  try {
    const granted = await manager.persist();
    await refreshStorageHealth();
    publishStorage({ persistent: granted, notice: granted
      ? 'Persistent storage granted. Keep portable backups; browser data can still be cleared.'
      : 'Persistent storage was not granted. Continue saving locally and keep portable backups.' });
  } catch {
    publishStorage({ error: 'The browser could not request persistent storage. Your saved data was not changed.' });
  } finally { publishStorage({ requestingPersistence: false }); }
}

async function verifyCache(worker?: ServiceWorker | null, repair = false) {
  const target =
    worker ?? navigator.serviceWorker.controller ?? registration?.active;
  if (!target) return;
  const channel = new MessageChannel();
  const response = new Promise<{
    complete: boolean;
    version: string;
    error?: string | null;
  }>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("Offline cache verification timed out."));
    }, 8000);
    channel.port1.onmessage = (event) => {
      if (event.data?.type !== "CACHE_STATUS") return;
      window.clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
  });
  target.postMessage({ type: repair ? "REPAIR_CACHE" : "CACHE_STATUS" }, [
    channel.port2,
  ]);
  const result = await response.catch((error) => {
    publish({ phase: "error" });
    throw error;
  });
  if (!result.complete) {
    publish({ phase: "error" });
    throw new Error(
      result.error ??
        "Some application files have not been cached. Connect and retry offline setup.",
    );
  }
  publish({
    phase: "ready",
    version: result.version,
    error: null,
    updateAvailable: Boolean(registration?.waiting),
  });
}
function reportError(error: unknown) {
  publish({
    phase: state.phase === "ready" ? "ready" : "error",
    error:
      error instanceof Error
        ? error.message
        : "Offline setup could not finish.",
  });
}
function observeWorker(worker: ServiceWorker) {
  const changed = () => {
    if (worker.state === "installed") {
      publish({ updateAvailable: Boolean(registration?.waiting), error: null });
      if (registration?.active)
        void verifyCache(registration.active).catch(reportError);
    }
    if (worker.state === "activated")
      void verifyCache(worker).catch(reportError);
    if (worker.state === "redundant" && state.phase !== "ready")
      reportError(
        new Error("Offline setup did not finish. Reconnect and retry."),
      );
  };
  worker.addEventListener("statechange", changed);
  changed();
}
async function registerWorker() {
  if (registering) return registering;
  registering = (async () => {
    if (state.phase !== "ready") publish({ phase: "preparing", error: null });
    const base = new URL(environment.BASE_URL || "./", window.location.href);
    registration = await navigator.serviceWorker.register(
      new URL("sw.js", base),
      { scope: base.pathname, updateViaCache: "none" },
    );
    publish({ updateAvailable: Boolean(registration.waiting) });
    registration.addEventListener("updatefound", () => {
      if (registration?.installing) observeWorker(registration.installing);
    });
    if (registration.installing) observeWorker(registration.installing);
    if (registration.active)
      await verifyCache(registration.active).catch(reportError);
    if (navigator.onLine)
      void registration.update().catch((error) => {
        if (state.phase !== "ready") reportError(error);
      });
  })()
    .catch(reportError)
    .finally(() => {
      registering = null;
    });
  return registering;
}

/** Called once by OfflineStatus; the dev server is intentionally never cached. */
export function startOffline() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    publish({ online: true });
    if (state.phase === "error") void retryOffline();
  });
  window.addEventListener("offline", () => publish({ online: false }));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    publish({ installAvailable: true });
  });
  window.addEventListener("appinstalled", () => {
    prompt = null;
    publish({ installed: true, installAvailable: false });
  });
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", () => publish({ installed: standalone() }));
  if (!environment.PROD) {
    publish({ phase: "development" });
    return;
  }
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    publish({ phase: "unsupported" });
    return;
  }
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "GET_CLIENT_BUILD") return;
    event.ports[0]?.postMessage({
      version:
        document.querySelector<HTMLMetaElement>(
          'meta[name="biomechanics-build"]',
        )?.content ?? null,
    });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadRequested) {
      window.location.reload();
      return;
    }
    void verifyCache().catch(reportError);
  });
  void registerWorker();
}
export async function retryOffline() {
  await registerWorker();
  if (registration?.active)
    await verifyCache(registration.active, true).catch(reportError);
}
export async function installApp() {
  if (!prompt) return;
  const event = prompt;
  prompt = null;
  publish({ installAvailable: false });
  try {
    await event.prompt();
    await event.userChoice;
  } catch (error) {
    reportError(error);
  }
  // A prompt acceptance alone is not proof of installation. appinstalled/standalone is.
}
export async function applyOfflineUpdate(
  beforeReload?: () => void | Promise<void>,
) {
  if (!registration?.waiting || state.applyingUpdate) return;
  try {
    // The caller must synchronously persist the latest in-progress comparison.
    // If it fails, keep this tab and this worker unchanged.
    await beforeReload?.();
    publish({ applyingUpdate: true, error: null });
    reloadRequested = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (error) {
    reloadRequested = false;
    publish({
      applyingUpdate: false,
      error:
        error instanceof Error
          ? error.message
          : "Save or export your comparison before updating.",
    });
  }
}
