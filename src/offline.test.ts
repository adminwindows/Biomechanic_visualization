import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let memory: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  memory = new Map([['personal-comparison', 'keep']]);
  vi.stubGlobal('localStorage', {
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('offline storage diagnostics', () => {
  it('checks saving and estimated site usage without requesting storage permission', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { onLine: true, storage: { persist, persisted: async () => false, estimate: async () => ({ usage: 2500, quota: 100000 }) } });
    const offline = await import('./offline');
    await offline.refreshStorageHealth();
    expect(offline.getOfflineState().storage).toMatchObject({ checked: true, checking: false, writable: true, persistent: false, canRequestPersistence: true, usage: 2500, quota: 100000, error: null });
    expect(persist).not.toHaveBeenCalled();
    expect([...memory]).toEqual([['personal-comparison', 'keep']]);
  });
  it('requests persistence only through the explicit action and reports the browser decision', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { onLine: true, storage: { persist, persisted: async () => false, estimate: async () => ({}) } });
    const offline = await import('./offline');
    await offline.requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(offline.getOfflineState().storage).toMatchObject({ persistent: true, requestingPersistence: false });
    expect(offline.getOfflineState().storage.notice).toContain('Persistent storage granted');
    await offline.requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it('does not describe a declined request as protected storage', async () => {
    vi.stubGlobal('navigator', { onLine: true, storage: { persist: async () => false, persisted: async () => false } });
    const offline = await import('./offline');
    await offline.requestPersistentStorage();
    expect(offline.getOfflineState().storage.persistent).toBe(false);
    expect(offline.getOfflineState().storage.notice).toContain('not granted');
  });
  it('keeps data intact when saving is blocked and diagnostics are unavailable', async () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('Quota exceeded'); }, removeItem: vi.fn() });
    vi.stubGlobal('navigator', { onLine: true, storage: { persisted: async () => { throw new Error('Policy denied'); }, estimate: async () => { throw new Error('Not available'); } } });
    const offline = await import('./offline');
    await offline.refreshStorageHealth();
    expect(offline.getOfflineState().storage).toMatchObject({ checked: true, writable: false, persistent: null, usage: null, quota: null, canRequestPersistence: false });
    expect(offline.getOfflineState().storage.error).toContain('Local saving is unavailable or full');
    expect([...memory]).toEqual([['personal-comparison', 'keep']]);
  });
  it('supports browsers without a storage-manager API without claiming protection', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const offline = await import('./offline');
    await offline.refreshStorageHealth();
    expect(offline.getOfflineState().storage).toMatchObject({ writable: true, persistent: null, canRequestPersistence: false, error: null });
    await offline.requestPersistentStorage();
    expect(offline.getOfflineState().storage.notice).toContain('does not offer');
  });
});
