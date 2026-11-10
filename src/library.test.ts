import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, editMeasurement } from './state';
import {
  LIBRARY_KEY, deleteBodyProfile, deleteComparison, deleteEquipmentProfile,
  exportLibrary, importLibrary, listBodyProfiles, listEquipmentProfiles, listSavedComparisons,
  loadBodyProfile, loadComparison, loadEquipmentProfile, saveBodyProfile, saveComparison,
  saveEquipmentProfile, setComparisonFavorite,
} from './library';

let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('named snapshot libraries', () => {
  it('saves, renames, favorites, loads and deletes independent comparison snapshots', () => {
    const state = createInitialState();
    const saved = saveComparison(state, 'Cable height study');
    state.setups[0].pulleyHeight = 3;
    expect(loadComparison(saved.id).setups[0].pulleyHeight).not.toBe(3);
    expect(listSavedComparisons()[0].name).toBe('Cable height study');
    expect(setComparisonFavorite(saved.id, true).favorite).toBe(true);
    const renamed = saveComparison(loadComparison(saved.id), 'Revised study', saved.id);
    expect(renamed.id).toBe(saved.id);
    expect(renamed.favorite).toBe(true);
    expect(renamed.createdAt).toBe(saved.createdAt);
    expect(listSavedComparisons()).toHaveLength(1);
    deleteComparison(saved.id);
    expect(listSavedComparisons()).toEqual([]);
    expect(() => loadComparison(saved.id)).toThrow('no longer exists');
  });
  it('preserves body measurements and equipment fields through named snapshots', () => {
    const state = createInitialState();
    const profile = editMeasurement(state.profiles[0], 'thigh', 0.47);
    profile.locked.forearm = true;
    const body = saveBodyProfile(profile, 'Measured proportions');
    expect(loadBodyProfile(body.id)).toEqual(profile);
    const setup = { ...state.setups[0], tension: 98.1, loadMode: 'mass' as const, loadMass: 20, transmissionFactor: 0.5 };
    const equipment = saveEquipmentProfile(setup, 'Home cable column');
    expect(loadEquipmentProfile(equipment.id)).toEqual(setup);
    expect(listBodyProfiles()).toHaveLength(1);
    expect(listEquipmentProfiles()).toHaveLength(1);
    deleteBodyProfile(body.id); deleteEquipmentProfile(equipment.id);
    expect(listBodyProfiles()).toEqual([]);
    expect(listEquipmentProfiles()).toEqual([]);
  });
  it('exports the entire library and imports into an empty installation', () => {
    const state = createInitialState();
    saveComparison(state, 'Study'); saveBodyProfile(state.profiles[0], 'Body'); saveEquipmentProfile(state.setups[0], 'Equipment');
    const exported = exportLibrary();
    memory.clear();
    expect(importLibrary(exported)).toEqual({ comparisons: 1, bodies: 1, equipment: 1 });
    expect(exportLibrary()).toBe(exported);
  });
  it('merges colliding IDs without overwriting saved work and backs up explicit replacement', () => {
    saveComparison(createInitialState(), 'Keep this');
    const exported = exportLibrary();
    importLibrary(exported);
    const entries = listSavedComparisons();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).not.toBe(entries[1].id);
    const previous = memory.get(LIBRARY_KEY);
    importLibrary(exported, 'replace');
    expect(listSavedComparisons()).toHaveLength(1);
    expect([...memory.entries()].find(([key]) => key.startsWith(`${LIBRARY_KEY}.model-backup`))?.[1]).toBe(previous);
  });
  it('rejects corrupt, oversized, duplicate or malformed imports without changing stored data', () => {
    saveComparison(createInitialState());
    const previous = memory.get(LIBRARY_KEY);
    expect(() => importLibrary('{broken')).toThrow('valid JSON');
    expect(() => importLibrary(' '.repeat(1_000_001))).toThrow('1 MB');
    const duplicate = JSON.parse(exportLibrary());
    duplicate.comparisons.push(duplicate.comparisons[0]);
    expect(() => importLibrary(JSON.stringify(duplicate))).toThrow('duplicate identifiers');
    const invalid = JSON.parse(exportLibrary());
    invalid.comparisons[0].state.setups[0].tension = -12;
    expect(() => importLibrary(JSON.stringify(invalid))).toThrow('finite number');
    expect(memory.get(LIBRARY_KEY)).toBe(previous);
  });
  it('keeps the original old-model library before a subsequent write', () => {
    saveComparison(createInitialState());
    const old = JSON.parse(exportLibrary());
    old.comparisons[0].state.modelVersion = 'pullover-1';
    const original = JSON.stringify(old);
    memory.set(LIBRARY_KEY, original);
    const migrated = listSavedComparisons()[0];
    expect(migrated.sourceModelVersion).toBe('pullover-1');
    expect(memory.get(LIBRARY_KEY)).toBe(original);
    saveBodyProfile(createInitialState().profiles[0], 'New body');
    expect([...memory.entries()].find(([key]) => key.startsWith(`${LIBRARY_KEY}.model-backup`))?.[1]).toBe(original);
  });
  it('reports storage failures instead of pretending a save succeeded', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => saveComparison(createInitialState())).toThrow('Quota exceeded');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Denied'); } });
    expect(() => listSavedComparisons()).toThrow('storage is unavailable');
  });
});
