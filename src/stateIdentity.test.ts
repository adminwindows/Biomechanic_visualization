import { describe, expect, it } from 'vitest';
import { createInitialState, validateState } from './state';
import { reuseModelReferences } from './stateIdentity';

describe('preserving unchanged model references after validation', () => {
  it('keeps model identities through title, notes, movement and framing edits', () => {
    const previous = createInitialState();
    const next = validateState({ ...structuredClone(previous), name: 'Edited title', notes: 'A recorded question', angles: [150, 150], viewFraming: { view: 'top', zoom: 1.4, pan: [.2, .1] } });
    const result = reuseModelReferences(previous, next);
    expect(result).toEqual(next);
    expect(result.setups).toBe(previous.setups);
    expect(result.profiles).toBe(previous.profiles);
    expect(result.angles).toBe(next.angles);
    expect(result.name).toBe('Edited title');
    expect(previous.name).not.toBe(result.name);
  });
  it('invalidates only the changed setup while retaining the other side and body tuple', () => {
    const previous = createInitialState(), edited = structuredClone(previous);
    edited.setups[0].pulleyHeight += .1;
    const next = validateState(edited), result = reuseModelReferences(previous, next);
    expect(result.setups[0]).toBe(next.setups[0]);
    expect(result.setups[1]).toBe(previous.setups[1]);
    expect(result.setups).not.toBe(previous.setups);
    expect(result.profiles).toBe(previous.profiles);
    expect(result).toEqual(next);
  });
  it('retains geometry dimensions when only measurement provenance or locks change', () => {
    const previous = createInitialState(), edited = structuredClone(previous);
    edited.lockBody = false;
    edited.profiles[0].provenance.upperArm = 'measured';
    edited.profiles[0].locked.upperArm = true;
    const next = validateState(edited), result = reuseModelReferences(previous, next);
    expect(result.profiles[0]).not.toBe(previous.profiles[0]);
    expect(result.profiles[0].values).toBe(previous.profiles[0].values);
    expect(result.profiles[0].provenance).toBe(next.profiles[0].provenance);
    expect(result.profiles[0].locked).toBe(next.profiles[0].locked);
    expect(result.profiles[1]).toBe(previous.profiles[1]);
    expect(previous.profiles[0].locked.upperArm).toBe(false);
  });
  it('does not reuse changed dimensions or nested obstacle and outlet geometry', () => {
    const previous = createInitialState();
    previous.lockBody = false;
    previous.setups[0].outletPositions = [[0, -.2, 2], [0, .2, 2.1]];
    previous.setups[0].obstacles = [{ id: 'rail', name: 'Rail', type: 'capsule', a: [0, 0, 0], b: [0, 0, 2], radius: .03 }];
    const edited = structuredClone(previous);
    edited.profiles[0].values.upperArm += .01;
    edited.setups[0].outletPositions!.reverse();
    if (edited.setups[0].obstacles![0].type === 'capsule') edited.setups[0].obstacles![0].b[0] = .1;
    const next = validateState(edited), result = reuseModelReferences(previous, next);
    expect(result.profiles[0].values).toBe(next.profiles[0].values);
    expect(result.profiles[0].provenance).toBe(previous.profiles[0].provenance);
    expect(result.setups[0]).toBe(next.setups[0]);
    expect(result.setups[1]).toBe(previous.setups[1]);
    expect(previous.setups[0].outletPositions![0][1]).toBe(-.2);
    expect(result).toEqual(next);
  });
  it('does not invalidate equivalent inputs due to property ordering or absent optional fields', () => {
    const previous = createInitialState(), next = validateState(structuredClone(previous));
    next.setups[0] = Object.fromEntries(Object.entries(next.setups[0]).reverse()) as typeof next.setups[0];
    next.setups[0].bodyCollision = undefined;
    const result = reuseModelReferences(previous, next);
    expect(result.setups).toBe(previous.setups);
    expect(result.profiles).toBe(previous.profiles);
  });
});
