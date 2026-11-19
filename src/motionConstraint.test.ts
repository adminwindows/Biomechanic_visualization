import { describe, expect, it } from 'vitest';
import { BAR_RADIUS, RAD, defaultProfile, evaluate, presets, type Setup } from './engine';
import { createInitialState, movementProgress } from './state';
import { constrainMotion, intersectIntervals, motionConstraints, setMotionAngle } from './motionConstraint';

function fixture() {
  const state = createInitialState();
  const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
  const bench = presets.find(preset => preset.preset === 'bench')!;
  const setup: Setup = { ...bench, tilt: 90, hipX: 1, hipHeight: .46,
    backLength: defaultProfile.torso - reach * Math.cos(196.1 * RAD) - BAR_RADIUS,
    range: [195.5, 197] };
  state.setups = [setup, structuredClone(setup)];
  state.angles = [196, 196];
  state.motionMode = 'usable';
  state.clearIntervalAnchors = [196, 196];
  return state;
}

describe('usable motion synchronization', () => {
  it('clips direct edits to the chosen connected portion without changing the original ROM', () => {
    const state = fixture();
    state.sync = 'independent';
    const options = motionConstraints(state).options[0];
    expect(options).toHaveLength(2);
    const next = setMotionAngle(state, 0, 197);
    expect(next.angles[0]).toBeLessThan(196.1);
    expect(evaluate(next.setups[0], next.profiles[0].values, next.angles[0]).status).not.toBe('contact');
    expect(next.setups[0].range).toEqual([195.5, 197]);
    expect(setMotionAngle({ ...next, motionMode: 'explore' }, 0, 196.14).angles[0]).toBe(196.14);
  });

  it('requires an explicit interval choice to move across a narrow obstacle', () => {
    const state = fixture();
    const first = constrainMotion(state);
    expect(first.angles).toEqual([196, 196]);
    const second = constrainMotion({ ...state, clearIntervalAnchors: [196.5, 196.5] });
    expect(second.angles[0]).toBeGreaterThan(196.175);
    expect(second.angles[0]).toBe(second.angles[1]);
    expect(evaluate(second.setups[0], second.profiles[0].values, second.angles[0]).status).not.toBe('contact');
  });

  it('intersects shared angle domains instead of bridging disjoint intervals', () => {
    expect(intersectIntervals([[0, 10], [20, 30]], [[5, 25]])).toEqual([[5, 10], [20, 25]]);
    const state = fixture();
    state.setups[1] = { ...presets.find(p => p.preset === 'classic')!, range: [196.15, 200] };
    state.angles = [196.2, 196.2];
    state.clearIntervalAnchors = [196.2, 196.2];
    const motion = motionConstraints(state);
    expect(motion.options[0]).toHaveLength(1);
    expect(motion.selected[0]![0]).toBeGreaterThan(196.175);
    const next = setMotionAngle(state, 1, 196.15);
    expect(next.angles[0]).toBe(next.angles[1]);
    expect(next.angles[0]).toBeGreaterThan(196.175);
  });

  it('maps shared clear progress using each original ROM and declared action direction', () => {
    const state = fixture();
    state.sync = 'progress';
    state.setups[1] = structuredClone(presets.find(p => p.preset === 'extension-pushdown')!);
    const constrained = constrainMotion(state);
    const next = setMotionAngle(constrained, 1, state.setups[1].range[0]);
    expect(movementProgress(next.setups[0], next.angles[0])).toBeCloseTo(movementProgress(next.setups[1], next.angles[1]), 10);
    expect(next.angles[0]).toBeLessThan(196.1);
    expect(next.setups[0].range).toEqual([195.5, 197]);
    expect(motionConstraints(next).options[0]).toHaveLength(2);
  });

  it('disables synchronized motion when either motion geometry is unmodelled', () => {
    const state = fixture();
    state.sync = 'progress';
    state.setups[1] = structuredClone(presets.find(p => p.preset === 'machine-unknown')!);
    expect(motionConstraints(state).selected).toEqual([null, null]);
    expect(setMotionAngle(state, 0, 197)).toBe(state);
    state.sync = 'independent';
    expect(motionConstraints(state).selected[0]).not.toBeNull();
    expect(motionConstraints(state).selected[1]).toBeNull();
  });
});
