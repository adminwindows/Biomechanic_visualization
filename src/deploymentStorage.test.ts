import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureAppRecovery } from './AppErrorBoundary';
import { createDeploymentStorage } from './deploymentStorage';

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: key => { entries.delete(key); },
    clear: () => entries.clear(),
    key: index => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('./deploymentStorage'); vi.resetModules(); });

describe('deployment-local browser storage', () => {
  it('isolates same-origin PR paths and enumerates only their logical keys for recovery', () => {
    const native = memoryStorage();
    const first = createDeploymentStorage('/Biomechanic_visualization/pr-1/', () => native);
    const second = createDeploymentStorage('/Biomechanic_visualization/pr-10/', () => native);
    const key = 'biomechanics.exercise-favorites';
    const recoveryKey = `${key}.recovery.123`;
    native.setItem('unrelated-app-data', 'do not export');
    first.setItem(key, '["classic"]');
    first.setItem(recoveryKey, '{unreadable original');
    second.setItem(key, '["bench"]');

    expect(first.getItem(key)).toBe('["classic"]');
    expect(second.getItem(key)).toBe('["bench"]');
    expect(first.length).toBe(2);
    expect(second.length).toBe(1);
    expect([first.key(0), first.key(1), first.key(2)]).toEqual([key, recoveryKey, null]);
    expect(JSON.parse(captureAppRecovery(first)).entries).toEqual([
      { key, raw: '["classic"]' }, { key: recoveryKey, raw: '{unreadable original' },
    ]);
    expect(JSON.parse(captureAppRecovery(second)).entries).toEqual([{ key, raw: '["bench"]' }]);
    first.removeItem(key);
    expect(first.getItem(key)).toBeNull();
    expect(second.getItem(key)).toBe('["bench"]');
  });

  it('keeps existing root data and logical key names unchanged', () => {
    const native = memoryStorage();
    const key = 'exercise-biomechanics-lab.comparison.v1';
    native.setItem(key, 'existing root comparison');
    const root = createDeploymentStorage('/', () => native);
    const preview = createDeploymentStorage('/Biomechanic_visualization/pr-1/', () => native);
    expect(root.getItem(key)).toBe('existing root comparison');
    expect(preview.getItem(key)).toBeNull();
    preview.setItem(key, 'preview comparison');
    root.setItem(key, 'updated root comparison');
    expect(native.getItem(key)).toBe('updated root comparison');
    expect(preview.getItem(key)).toBe('preview comparison');
    expect(JSON.parse(captureAppRecovery(root)).entries).toEqual([{ key, raw: 'updated root comparison' }]);
    expect(root.length).toBe(native.length);
    expect(root.key(0)).toBe(native.key(0));
  });

  it('uses the same namespace with or without the base path trailing slash', () => {
    const native = memoryStorage();
    createDeploymentStorage('/repo/pr-2', () => native).setItem('biomechanics.key', 'saved');
    expect(createDeploymentStorage('/repo/pr-2/', () => native).getItem('biomechanics.key')).toBe('saved');
  });

  it('resolves browser storage lazily and preserves blocked/quota errors', () => {
    const storage = createDeploymentStorage('/repo/pr-1/');
    const first = memoryStorage();
    vi.stubGlobal('localStorage', first);
    storage.setItem('biomechanics.key', 'first browser store');
    vi.stubGlobal('localStorage', memoryStorage());
    expect(storage.getItem('biomechanics.key')).toBeNull();
    const blocked = createDeploymentStorage('/repo/pr-1/', () => { throw new Error('Storage blocked'); });
    expect(() => blocked.getItem('key')).toThrow('Storage blocked');
    expect(() => blocked.setItem('key', 'value')).toThrow('Storage blocked');
    expect(() => blocked.removeItem('key')).toThrow('Storage blocked');
    expect(() => blocked.key(0)).toThrow('Storage blocked');
    expect(() => blocked.length).toThrow('Storage blocked');
    const quotaError = new Error('Quota exceeded');
    vi.stubGlobal('localStorage', { setItem: () => { throw quotaError; } });
    expect(() => storage.setItem('key', 'value')).toThrow(quotaError);
  });

  it('exports portable workspace keys and restores into only the selected preview', async () => {
    const native = memoryStorage();
    vi.stubGlobal('localStorage', native);
    const loadPreview = async (base: string) => {
      const previewStorage = createDeploymentStorage(base);
      vi.resetModules();
      // Vite embeds BASE_URL at build time. Give each independently loaded app
      // the adapter that its own build would create while sharing one browser store.
      vi.doMock('./deploymentStorage', () => ({ deploymentStorage: previewStorage }));
      return {
        state: await import('./state'),
        workspace: await import('./workspaceBackup'),
        selections: await import('./selectionStorage'),
        storage: previewStorage,
      };
    };
    const first = await loadPreview('/Biomechanic_visualization/pr-1/');
    const firstState = first.state.createInitialState();
    firstState.name = 'PR 1 comparison';
    expect(first.state.saveState(firstState)).toBe(true);
    first.selections.saveSelection('biomechanics.exercise-favorites', ['classic']);
    const exported = first.workspace.exportWorkspace(firstState);
    const backup = first.workspace.parseWorkspaceBackup(exported);
    expect(backup.entries.map(entry => entry.key)).toEqual(first.workspace.WORKSPACE_STORAGE_KEYS);
    expect(exported).not.toContain('__biomechanics_deployment__');

    const second = await loadPreview('/Biomechanic_visualization/pr-2/');
    const secondState = second.state.createInitialState();
    secondState.name = 'PR 2 comparison';
    expect(second.state.saveState(secondState)).toBe(true);
    second.selections.saveSelection('biomechanics.exercise-favorites', ['bench']);
    expect(first.state.loadState().state.name).toBe('PR 1 comparison');
    expect(second.state.loadState().state.name).toBe('PR 2 comparison');
    const firstBefore = captureAppRecovery(first.storage);
    const restored = second.workspace.restoreWorkspaceBackup(exported);
    expect(second.state.loadState().state.name).toBe('PR 1 comparison');
    expect(second.selections.readSelection('biomechanics.exercise-favorites', []).value).toEqual(['classic']);
    expect(JSON.parse(captureAppRecovery(first.storage)).entries).toEqual(JSON.parse(firstBefore).entries);
    expect(first.storage.getItem(restored.backupKey)).toBeNull();
    const savedOriginal = JSON.parse(second.storage.getItem(restored.backupKey)!);
    const originalComparison = savedOriginal.entries.find((entry: { key: string }) => entry.key === second.state.STORAGE_KEY);
    expect(JSON.parse(originalComparison.raw).name).toBe('PR 2 comparison');
    expect(native.getItem(first.state.STORAGE_KEY)).toBeNull();
  });
});
