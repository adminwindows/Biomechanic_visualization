import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, STORAGE_KEY } from './state';
import { LIBRARY_KEY, saveComparison } from './library';
import { EXERCISE_DRAFTS_KEY, saveExerciseDraft } from './exerciseDrafts';
import { RESEARCH_KEY, createResearchEntry } from './researchNotebook';
import { createMachineWorkspace, MACHINE_LIBRARY_KEY, MACHINE_WORKSPACE_KEY } from './machineLibrary';
import { COMPOUND_KEY, COMPOUND_LIBRARY_KEY, initialCompound } from './compoundState';
import { parseTraining } from './training';
import { CALIBRATION_KEY, createCalibrationNotebook } from './calibrationGuide';
import {
  WORKSPACE_BACKUP_PREFIX, WORKSPACE_FLUSH_EVENT, WORKSPACE_STORAGE_KEYS, WorkspaceRestoreError,
  createWorkspaceBackup, exportRawWorkspaceRecovery, exportWorkspace, flushWorkspaceEdits,
  parseWorkspaceBackup, restoreWorkspaceBackup, validateWorkspaceBackup, workspaceSummary,
} from './workspaceBackup';

let memory: Map<string, string>;
function storage() {
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
}
beforeEach(() => { memory = new Map(); vi.stubGlobal('localStorage', storage()); });
afterEach(() => vi.unstubAllGlobals());
function seed() {
  const state = createInitialState();
  memory.set(STORAGE_KEY, JSON.stringify(state));
  memory.set(CALIBRATION_KEY, JSON.stringify(createCalibrationNotebook()));
  saveComparison(state, 'Named comparison');
  saveExerciseDraft(0, state.setups[0], state.profiles[0], state.angles[0]);
  createResearchEntry(state, { title: 'Recorded hypothesis', classification: 'hypothesis', hypothesis: 'Compare only outlet height', observation: 'No physiology inferred', citations: [] });
  const machine = createMachineWorkspace();
  memory.set(MACHINE_WORKSPACE_KEY, JSON.stringify(machine));
  memory.set(MACHINE_LIBRARY_KEY, JSON.stringify({ format: 'biomechanics-machine-library', version: 1, profiles: [{ id: machine.profiles[0].id, savedAt: new Date().toISOString(), profile: machine.profiles[0] }] }));
  const compound = initialCompound([state.profiles[0].values, state.profiles[1].values]);
  memory.set(COMPOUND_KEY, JSON.stringify(compound));
  memory.set(COMPOUND_LIBRARY_KEY, JSON.stringify([{ id: 'compound-one', name: 'Saved compound study', updatedAt: new Date().toISOString(), snapshot: compound }]));
  memory.set('biomechanics.exercise-favorites', JSON.stringify(['classic', 'curl-low']));
  memory.set('biomechanics.training-list', 'Low cable curl\nCable lateral raise');
  memory.set('biomechanics.training-matches', JSON.stringify(parseTraining('Low cable curl\nCable lateral raise')));
  return state;
}

describe('portable whole-workspace backup', () => {
  it('round-trips all workbenches and uses live comparison edits instead of a stale autosave', () => {
    const state = seed();
    state.name = 'Current unsaved title';
    state.criterion = 'The latest edit must survive';
    const exported = exportWorkspace(state);
    const parsed = parseWorkspaceBackup(exported);
    expect(parsed.entries.map(entry => entry.key)).toEqual(WORKSPACE_STORAGE_KEYS);
    expect(workspaceSummary(parsed).every(section => section.present)).toBe(true);
    expect((parsed.entries.find(entry => entry.key === STORAGE_KEY)!.value as typeof state).name).toBe(state.name);
    memory.clear();
    memory.set('unrelated-app-data', 'keep this');
    memory.set(`${WORKSPACE_BACKUP_PREFIX}older`, 'older recovery');
    const restored = restoreWorkspaceBackup(exported);
    expect(restored.stores).toBe(WORKSPACE_STORAGE_KEYS.length);
    expect(restored.records).toBeGreaterThan(10);
    expect(memory.get('unrelated-app-data')).toBe('keep this');
    expect(memory.get(`${WORKSPACE_BACKUP_PREFIX}older`)).toBe('older recovery');
    const after = createWorkspaceBackup(state);
    expect(after.entries).toEqual(parsed.entries);
  });

  it('preserves corrupt and unknown-version originals in raw recovery without pretending to validate them', () => {
    const state = seed();
    const malformed = '{unreadable local library';
    const future = '{"version": 999, "unknown": "original data"}';
    memory.set(LIBRARY_KEY, malformed);
    memory.set(COMPOUND_KEY, future);
    const before = new Map(memory);
    expect(() => exportWorkspace(state)).toThrow('Download raw recovery');
    const recovery = JSON.parse(exportRawWorkspaceRecovery(state));
    expect(recovery.entries.find((entry: { key: string }) => entry.key === LIBRARY_KEY).raw).toBe(malformed);
    expect(recovery.entries.find((entry: { key: string }) => entry.key === COMPOUND_KEY).raw).toBe(future);
    expect(recovery.currentComparison).toEqual(state);
    expect(memory).toEqual(before);
    expect(() => parseWorkspaceBackup(JSON.stringify(recovery))).toThrow('raw recovery file');
  });

  it('backs up exact unreadable originals before explicit restoration and preserves the live comparison separately', () => {
    const state = seed();
    const exported = exportWorkspace(state);
    memory.set(LIBRARY_KEY, '{broken original');
    memory.set(STORAGE_KEY, '{original comparison from another version');
    state.name = 'Work still visible in the app';
    const result = restoreWorkspaceBackup(exported, state);
    const recovery = JSON.parse(memory.get(result.backupKey)!);
    expect(recovery.entries.find((entry: { key: string }) => entry.key === LIBRARY_KEY).raw).toBe('{broken original');
    expect(recovery.entries.find((entry: { key: string }) => entry.key === STORAGE_KEY).raw).toBe('{original comparison from another version');
    expect(recovery.currentComparison.name).toBe('Work still visible in the app');
    expect(JSON.parse(memory.get(STORAGE_KEY)!).name).not.toBe(state.name);
    expect(JSON.parse(memory.get(LIBRARY_KEY)!).format).toBe('biomechanics-library');
  });

  it('rejects an invalid late section, duplicate/unknown keys and oversized files before writing anything', () => {
    const state = seed();
    const valid = createWorkspaceBackup(state);
    const before = new Map(memory);
    const bad = structuredClone(valid);
    (bad.entries.find(entry => entry.key === MACHINE_WORKSPACE_KEY)!.value as { angles: number[] }).angles[0] = Infinity;
    expect(() => restoreWorkspaceBackup(JSON.stringify(bad))).toThrow('Machine comparison');
    const unknown = structuredClone(valid); unknown.entries[0].key = 'some-other-app-secret';
    expect(() => validateWorkspaceBackup(unknown)).toThrow('unrecognized storage');
    const duplicate = structuredClone(valid); duplicate.entries[1] = duplicate.entries[0];
    expect(() => validateWorkspaceBackup(duplicate)).toThrow('duplicate');
    expect(() => parseWorkspaceBackup(' '.repeat(5_000_001))).toThrow('5 MB');
    expect(memory).toEqual(before);
  });

  it('imports only included sections and treats an explicit empty section as removal', () => {
    const state = seed();
    const before = memory.get(RESEARCH_KEY);
    const one = { format: 'biomechanics-workspace', version: 1, exportedAt: new Date().toISOString(), entries: [{ key: EXERCISE_DRAFTS_KEY, value: null }] };
    const result = restoreWorkspaceBackup(JSON.stringify(one), state);
    expect(result.stores).toBe(1);
    expect(memory.has(EXERCISE_DRAFTS_KEY)).toBe(false);
    expect(memory.get(RESEARCH_KEY)).toBe(before);
    expect(memory.has(COMPOUND_LIBRARY_KEY)).toBe(true);
  });

  it('reports known mechanics migrations instead of silently presenting recalculated imports as original results', () => {
    const state = seed(), backup = createWorkspaceBackup(state);
    (backup.entries.find(entry => entry.key === STORAGE_KEY)!.value as typeof state).modelVersion = 'pullover-1';
    const raw = JSON.stringify(backup);
    const parsed = parseWorkspaceBackup(raw);
    expect(parsed.modelUpdates).toEqual([`pullover-1 → ${state.modelVersion}`]);
    expect(restoreWorkspaceBackup(raw).modelUpdates).toEqual(parsed.modelUpdates);
    expect(JSON.parse(memory.get(STORAGE_KEY)!).modelVersion).toBe(state.modelVersion);
  });

  it('changes no active store when the recovery backup itself cannot fit', () => {
    const state = seed(), exported = exportWorkspace(state), before = new Map(memory);
    const original = storage();
    vi.stubGlobal('localStorage', { ...original, setItem: (key: string, value: string) => {
      if (key.startsWith(WORKSPACE_BACKUP_PREFIX)) throw new Error('Quota exceeded');
      original.setItem(key, value);
    } });
    let error: unknown;
    try { restoreWorkspaceBackup(exported); } catch (reason) { error = reason; }
    expect(error).toBeInstanceOf(WorkspaceRestoreError);
    expect((error as WorkspaceRestoreError).rollbackComplete).toBe(true);
    expect(JSON.parse((error as WorkspaceRestoreError).recovery).entries).toHaveLength(WORKSPACE_STORAGE_KEYS.length);
    expect(memory).toEqual(before);
  });

  it('rolls back prior writes on quota failure and retains a recovery copy', () => {
    const state = seed();
    const backup = createWorkspaceBackup(state);
    (backup.entries.find(entry => entry.key === STORAGE_KEY)!.value as typeof state).name = 'Imported replacement';
    backup.entries.find(entry => entry.key === LIBRARY_KEY)!.value = null;
    backup.entries.find(entry => entry.key === EXERCISE_DRAFTS_KEY)!.value = null;
    const before = new Map(memory), original = storage();
    let failed = false;
    vi.stubGlobal('localStorage', { ...original, removeItem: (key: string) => {
      if (key === EXERCISE_DRAFTS_KEY && !failed) { failed = true; throw new Error('Quota simulation'); }
      original.removeItem(key);
    } });
    let error: unknown;
    try { restoreWorkspaceBackup(JSON.stringify(backup)); } catch (reason) { error = reason; }
    expect(error).toBeInstanceOf(WorkspaceRestoreError);
    expect((error as WorkspaceRestoreError).rollbackComplete).toBe(true);
    for (const [key, value] of before) expect(memory.get(key)).toBe(value);
    expect(memory.has((error as WorkspaceRestoreError).backupKey!)).toBe(true);
  });

  it('returns the original recovery data if rollback is also denied', () => {
    const state = seed(), backup = createWorkspaceBackup(state), original = storage();
    (backup.entries.find(entry => entry.key === STORAGE_KEY)!.value as typeof state).name = 'Imported replacement';
    backup.entries.find(entry => entry.key === LIBRARY_KEY)!.value = null;
    const previous = memory.get(STORAGE_KEY);
    let failure = false;
    vi.stubGlobal('localStorage', { ...original,
      removeItem: (key: string) => { if (key === LIBRARY_KEY) { failure = true; throw new Error('Storage denied'); } original.removeItem(key); },
      setItem: (key: string, value: string) => { if (failure) throw new Error('Still denied'); original.setItem(key, value); },
    });
    let error: unknown;
    try { restoreWorkspaceBackup(JSON.stringify(backup)); } catch (reason) { error = reason; }
    expect(error).toBeInstanceOf(WorkspaceRestoreError);
    expect((error as WorkspaceRestoreError).rollbackComplete).toBe(false);
    const recovery = JSON.parse((error as WorkspaceRestoreError).recovery);
    expect(recovery.entries.find((entry: { key: string }) => entry.key === STORAGE_KEY).raw).toBe(previous);
    expect(memory.has((error as WorkspaceRestoreError).backupKey!)).toBe(true);
  });

  it('flushes mounted workbenches synchronously and surfaces pending-save failures', () => {
    const target = new EventTarget(); vi.stubGlobal('window', target);
    target.addEventListener(WORKSPACE_FLUSH_EVENT, () => memory.set('flush-observed', 'yes'));
    flushWorkspaceEdits(); expect(memory.get('flush-observed')).toBe('yes');
    target.addEventListener(WORKSPACE_FLUSH_EVENT, event => (event as CustomEvent<{ errors: string[] }>).detail.errors.push('Machine quota exceeded'));
    expect(() => flushWorkspaceEdits()).toThrow('Machine quota exceeded');
  });
});
