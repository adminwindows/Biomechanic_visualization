import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './state';
import { defaultProfile, presets } from './engine';
import { initialCompound } from './compoundState';
import { chooseCompoundPair, compoundExercises, compoundPairFits, createJointPairChooser, jointExercises, jointPairFits } from './exercisePairs';

beforeEach(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  });
});

describe('two-exercise comparison', () => {
  it('updates the pair together when A changes and retains B edits when it still fits', () => {
    const pick = createJointPairChooser();
    let state = pick(createInitialState(), 0, 'raise-cable').state;
    expect(state.setups[0].preset).toBe('raise-cable');
    expect(jointPairFits(...state.setups)).toBe(true);
    state = pick(state, 1, 'raise-dumbbell').state;
    state.setups[1].loadMass = 8;
    state = pick(state, 0, 'raise-dumbbell').state;
    expect(state.setups[1].loadMass).toBe(8);
    expect(state.setups[0]).not.toBe(state.setups[1]);
  });

  it('declines comparisons across movement planes, coordinate units or disjoint ranges', () => {
    const a = presets.find(item => item.preset === 'raise-cable')!;
    expect(jointPairFits(a, { ...a, movementPlane: 80 })).toBe(false);
    expect(jointPairFits(a, { ...a, model: 'shrug' })).toBe(false);
    expect(jointPairFits({ ...a, range: [10, 40] }, { ...a, range: [50, 70] })).toBe(false);
    expect(jointExercises.some(entry => entry.setup.preset === 'machine-unknown')).toBe(false);
  });

  it('allows two matching edited variants when their original preset planes no longer fit', () => {
    const pick = createJointPairChooser();
    let state = pick(createInitialState(), 0, 'raise-cable').state;
    state.setups[0].movementPlane = 17;
    state = pick(state, 1, 'raise-cable').state;
    expect(state.setups[1].movementPlane).toBe(17);
    expect(jointPairFits(...state.setups)).toBe(true);
  });

  it('retains local edits while switching without access to saved storage', () => {
    vi.stubGlobal('localStorage', { getItem() { throw Error('Storage blocked'); } });
    const pick = createJointPairChooser();
    const initial = createInitialState();
    initial.setups[0].pulleyHeight = 2.23;
    const switched = pick(initial, 0, 'raise-cable');
    expect(switched.notice).toMatch(/kept in this tab/);
    const restored = pick(switched.state, 0, 'classic');
    expect(restored.state.setups[0].pulleyHeight).toBe(2.23);
    expect(restored.notice).toBe('');
  });

  it('pairs compound actions with the same load convention and can duplicate a custom variant', () => {
    const state = initialCompound([defaultProfile, defaultProfile]);
    chooseCompoundPair(state, 0, 'bench-barbell');
    expect(compoundPairFits(...state.configs)).toBe(true);
    chooseCompoundPair(state, 1, 'bench-dumbbell');
    expect(state.configs[1].preset).toBe('bench-dumbbell');
    chooseCompoundPair(state, 1, 'row-seated');
    expect(state.configs[1].preset).toBe('bench-dumbbell');
    expect(compoundPairFits(state.configs[0], compoundExercises.find(item => item.id === 'shoulder-press')!)).toBe(false);
    state.configs[0].unilateral = true;
    chooseCompoundPair(state, 1, 'bench-barbell');
    expect(state.configs[1].unilateral).toBe(true);
    expect(compoundExercises.some(item => item.id === 'row-machine')).toBe(false);
  });
});
