import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_VERSION, presets } from './engine';
import { createInitialState, editMeasurement } from './state';
import {
  EXERCISE_DRAFTS_KEY, deleteExerciseDraft, exportExerciseDrafts, importExerciseDrafts,
  loadExerciseDraft, loadExerciseDraftLibrary, saveExerciseDraft, saveExerciseDraftLibrary,
  validateExerciseDraftLibrary,
} from './exerciseDrafts';

let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('per-exercise working drafts', () => {
  it('preserves independent panels and presets with complete measured profiles and angle', () => {
    const state = createInitialState();
    const profile = editMeasurement(state.profiles[0], 'upperArm', .39);
    profile.locked.upperArm = true;
    const a = { ...state.setups[0], pulleyHeight: 2.8 };
    const b = { ...a, pulleyHeight: 1.2 };
    saveExerciseDraft(0, a, profile, 150);
    saveExerciseDraft(1, b, state.profiles[1], 160);
    const curl = structuredClone(presets.find(item => item.preset === 'curl-low')!);
    saveExerciseDraft(0, curl, profile, 90);
    expect(loadExerciseDraftLibrary().drafts).toHaveLength(3);
    expect(loadExerciseDraft(0, a.preset)).toMatchObject({ setup: a, profile, angle: 150, modelVersion: MODEL_VERSION });
    expect(loadExerciseDraft(1, a.preset)?.setup.pulleyHeight).toBe(1.2);
    expect(loadExerciseDraft(0, curl.preset)?.angle).toBe(90);
    expect(loadExerciseDraft(1, curl.preset)).toBeNull();
  });

  it('returns detached snapshots and only updates the exact panel/preset key', () => {
    const { setups, profiles } = createInitialState();
    const saved = saveExerciseDraft(0, setups[0], profiles[0], 160);
    setups[0].pulleyHeight = 3;
    profiles[0].values.upperArm = .5;
    saved.setup.pulleyHeight = 4;
    const loaded = loadExerciseDraft(0, saved.preset)!;
    expect(loaded.setup.pulleyHeight).not.toBe(3);
    expect(loaded.setup.pulleyHeight).not.toBe(4);
    expect(loaded.profile.values.upperArm).not.toBe(.5);
    loaded.profile.values.upperArm = .45;
    expect(loadExerciseDraft(0, saved.preset)?.profile.values.upperArm).not.toBe(.45);
    saveExerciseDraft(0, { ...loaded.setup, pulleyHeight: 2.6 }, loaded.profile, 150);
    expect(loadExerciseDraftLibrary().drafts).toHaveLength(1);
    deleteExerciseDraft(1, saved.preset);
    expect(loadExerciseDraftLibrary().drafts).toHaveLength(1);
    deleteExerciseDraft(0, saved.preset);
    expect(loadExerciseDraftLibrary().drafts).toEqual([]);
  });

  it('exports and restores complete drafts on an empty installation and keeps existing merge collisions', () => {
    const state = createInitialState();
    saveExerciseDraft(0, state.setups[0], state.profiles[0], 160);
    saveExerciseDraft(1, state.setups[1], state.profiles[1], 150);
    const exported = exportExerciseDrafts();
    memory.clear();
    expect(importExerciseDrafts(exported)).toEqual({ imported: 2, kept: 0 });
    expect(exportExerciseDrafts()).toBe(exported);
    saveExerciseDraft(0, { ...state.setups[0], pulleyHeight: 3 }, state.profiles[0], 160);
    expect(importExerciseDrafts(exported)).toEqual({ imported: 0, kept: 2 });
    expect(loadExerciseDraft(0, state.setups[0].preset)?.setup.pulleyHeight).toBe(3);
    const previous = memory.get(EXERCISE_DRAFTS_KEY);
    expect(importExerciseDrafts(exported, 'replace')).toEqual({ imported: 2, kept: 0 });
    expect([...memory.entries()].find(([key]) => key.startsWith(`${EXERCISE_DRAFTS_KEY}.model-backup`))?.[1]).toBe(previous);
  });

  it('uses shared model migration and preserves the exact original before rewriting old drafts', () => {
    const state = createInitialState();
    saveExerciseDraft(0, state.setups[0], state.profiles[0], 160);
    const old = JSON.parse(exportExerciseDrafts());
    old.drafts[0].modelVersion = 'pullover-1';
    const original = JSON.stringify(old);
    memory.set(EXERCISE_DRAFTS_KEY, original);
    expect(loadExerciseDraft(0, state.setups[0].preset)).toMatchObject({ modelVersion: MODEL_VERSION, sourceModelVersion: 'pullover-1' });
    expect(memory.get(EXERCISE_DRAFTS_KEY)).toBe(original);
    saveExerciseDraft(1, state.setups[1], state.profiles[1], 150);
    expect([...memory.entries()].find(([key]) => key.startsWith(`${EXERCISE_DRAFTS_KEY}.model-backup`))?.[1]).toBe(original);
    expect(loadExerciseDraft(0, state.setups[0].preset)?.sourceModelVersion).toBe('pullover-1');
  });

  it('refuses malformed originals and exposes storage errors without overwriting existing work', () => {
    const state = createInitialState();
    const original = '{unreadable draft data';
    memory.set(EXERCISE_DRAFTS_KEY, original);
    expect(() => loadExerciseDraftLibrary()).toThrow('original data has been kept');
    expect(() => saveExerciseDraft(0, state.setups[0], state.profiles[0], 160)).toThrow('original data has been kept');
    expect(() => saveExerciseDraftLibrary({ format: 'biomechanics-exercise-drafts', version: 1, drafts: [] })).toThrow('original data has been kept');
    expect(memory.get(EXERCISE_DRAFTS_KEY)).toBe(original);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => saveExerciseDraft(0, state.setups[0], state.profiles[0], 160)).toThrow('Quota exceeded');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Denied'); } });
    expect(() => loadExerciseDraftLibrary()).toThrow('storage is unavailable');
  });

  it('rejects invalid angles, mismatched or duplicate identities and unknown model versions', () => {
    const state = createInitialState();
    saveExerciseDraft(0, state.setups[0], state.profiles[0], 160);
    const valid = JSON.parse(exportExerciseDrafts());
    const previous = memory.get(EXERCISE_DRAFTS_KEY);
    expect(() => saveExerciseDraft(0, state.setups[0], state.profiles[0], Number.NaN)).toThrow('finite number');
    expect(() => saveExerciseDraft(0, state.setups[0], state.profiles[0], 5)).toThrow('outside its movement range');
    const mismatch = structuredClone(valid); mismatch.drafts[0].preset = 'another-preset';
    expect(() => validateExerciseDraftLibrary(mismatch)).toThrow('must match');
    const duplicate = structuredClone(valid); duplicate.drafts.push(duplicate.drafts[0]);
    expect(() => validateExerciseDraftLibrary(duplicate)).toThrow('duplicate');
    const unknown = structuredClone(valid); unknown.drafts[0].modelVersion = 'future-unrecognized';
    expect(() => validateExerciseDraftLibrary(unknown)).toThrow('another mechanics model');
    const badProfile = structuredClone(valid); badProfile.drafts[0].profile.values.upperArm = -1;
    expect(() => importExerciseDrafts(JSON.stringify(badProfile))).toThrow('finite number');
    expect(() => importExerciseDrafts(' '.repeat(1_000_001))).toThrow('1 MB');
    expect(memory.get(EXERCISE_DRAFTS_KEY)).toBe(previous);
  });

  it('keeps old data when the required migration backup cannot be written', () => {
    const state = createInitialState();
    saveExerciseDraft(0, state.setups[0], state.profiles[0], 160);
    const old = JSON.parse(exportExerciseDrafts()); old.drafts[0].modelVersion = 'pullover-1';
    const original = JSON.stringify(old); memory.set(EXERCISE_DRAFTS_KEY, original);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key !== EXERCISE_DRAFTS_KEY) throw new Error('Backup quota exceeded');
        memory.set(key, value);
      },
    });
    expect(() => saveExerciseDraft(1, state.setups[1], state.profiles[1], 150)).toThrow('Backup quota exceeded');
    expect(memory.get(EXERCISE_DRAFTS_KEY)).toBe(original);
  });
});
