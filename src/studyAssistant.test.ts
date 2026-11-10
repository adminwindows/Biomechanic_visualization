import { describe, expect, it } from 'vitest';
import { getDefinition } from './engine';
import { regionSummary } from './analysis';
import { createInitialState, forceValue, validateState, type LabState } from './state';
import {
  applyStudyProposal, availableStudyParameters, buildStudyPlan, interpretStudyQuestion,
  parseStudyProposal, reviewStudyProposal, studyBasis, studyExchange, validateStudyProposal,
  type StudyProposal,
} from './studyAssistant';

function fixture(): LabState {
  const state = createInitialState();
  state.setups[0].range = [80, 150]; state.setups[0].hipHeight = .9;
  state.setups[1] = structuredClone(state.setups[0]); state.angles = [100, 100];
  state.region = [90, 140]; state.lockForce = true; state.lockEquipment = true;
  return validateState(state);
}
function proposal(state = fixture(), value = state.setups[0].pulleyHeight + .1): StudyProposal {
  return { format: 'biomechanics-study-proposal', version: 1, target: 'B', basis: studyBasis(state), question: 'Does outlet height change resistance at fixed force?', rationale: 'An external hypothesis to recalculate.', changes: [{ parameter: 'pulleyHeight', value }] };
}

describe('deterministic study planner', () => {
  it('interprets a local geometry question and requires structure for unsupported training claims', () => {
    const state = fixture();
    const parsed = interpretStudyQuestion('Lower the pulley by 20 cm and inspect resistance.', state);
    expect(parsed.request).toMatchObject({ parameter: 'pulleyHeight', direction: -1, step: .2, goal: 'test-change' });
    expect(interpretStudyQuestion('Which exercise grows my triceps most?', state).request).toBeNull();
    expect(interpretStudyQuestion('A more even curve by moving the outlet by 5 cm', state).request?.goal).toBe('evenness');
  });

  it('changes only the declared B geometry while preserving A, body provenance, loading and full ROM', () => {
    const state = fixture();
    state.profiles[0].provenance.upperArm = 'measured'; state.profiles[0].locked.upperArm = true;
    state.profiles[1] = structuredClone(state.profiles[0]);
    state.notes = 'Keep private notes'; state.observation = 'Keep observations';
    const original = structuredClone(state), next = applyStudyProposal(state, proposal(state));
    expect(state).toEqual(original);
    expect(next.setups[0]).toEqual(original.setups[0]);
    expect(next.profiles[0]).toEqual(original.profiles[0]);
    expect(next.profiles[1]).toEqual(original.profiles[0]);
    expect(next.setups[1]).toEqual({ ...original.setups[0], pulleyHeight: original.setups[0].pulleyHeight + .1 });
    expect(forceValue(next.setups[1])).toBe(forceValue(original.setups[0]));
    expect(next.setups[1].range).toEqual(original.setups[0].range);
    expect(next.notes).toBe(original.notes); expect(next.observation).toBe(original.observation);
    expect(next.lockEquipment).toBe(false); expect(next.lockForce).toBe(true);
    expect(validateState(next)).toEqual(next);
  });

  it('uses actual engine summaries and compares neighbouring changes without changing load or range', async () => {
    const state = fixture();
    const plan = await buildStudyPlan(state, { question: 'Higher mean?', parameter: 'pulleyHeight', step: .1, direction: 1, goal: 'increase-mean' });
    expect(plan.candidates).toHaveLength(2);
    expect(plan.selected).not.toBeNull();
    for (const candidate of plan.candidates) {
      const expected = regionSummary(candidate.next.setups[1], state.profiles[0].values, state.region!);
      expect(candidate.summaries[1].mean).toBeCloseTo(expected.mean!, 10);
      expect(candidate.next.setups[1].tension).toBe(state.setups[0].tension);
      expect(candidate.next.setups[1].range).toEqual(state.setups[0].range);
    }
    expect(plan.selected!.summaries[1].mean).toBe(Math.max(...plan.candidates.map(candidate => candidate.summaries[1].mean!)));
  });

  it('preserves unknown transmission and withholds deltas instead of manufacturing force', () => {
    const state = fixture(); state.lockForce = false;
    state.setups[0].loadMode = 'mass'; state.setups[0].loadMass = 20; delete state.setups[0].transmissionFactor;
    state.lockEquipment = false;
    const review = reviewStudyProposal(state, proposal(state));
    expect(review.next.setups[1].transmissionFactor).toBeUndefined();
    expect(forceValue(review.next.setups[1])).toBeNull();
    expect(review.deltaMean).toBeNull();
    expect(review.measurements[0]).toContain('actual attachment force');
    expect(review.summaries.every(summary => summary.mean === null)).toBe(true);
  });

  it('translates actual outlets together and respects declared adjustment limits', () => {
    const state = fixture(); state.lockEquipment = false;
    state.setups[0].outletPositions = [[0, -.3, 1.8], [0, .3, 2.2]];
    const imported = proposal(state, 2.1);
    const moved = applyStudyProposal(state, imported).setups[1].outletPositions!;
    expect(moved[0][2]).toBeCloseTo(1.9, 12); expect(moved[1][2]).toBeCloseTo(2.3, 12);
    expect(moved[0].slice(0, 2)).toEqual([0, -.3]);
    state.setups[0].equipmentLimits = { pulleyMin: 1, pulleyMax: 2, distanceMin: 0, distanceMax: 2 };
    expect(() => validateStudyProposal(proposal(state, 2.1), state)).toThrow('declared equipment limits');
  });

  it('detects incompatible existing coordinates and confounding without comparing their numerical values', () => {
    const state = fixture(); state.sync = 'independent'; state.lockForce = false; state.lockEquipment = false;
    state.setups[1].model = 'curl'; state.setups[1].range = [20, 130]; state.setups[1].tension = 70;
    const review = reviewStudyProposal(state, proposal(state));
    expect(review.warnings.some(warning => warning.includes('incompatible'))).toBe(true);
    expect(review.warnings.some(warning => warning.includes('cannot be attributed'))).toBe(true);
    expect(review.compatible).toBe(true);
    expect(review.next.setups[1].model).toBe(state.setups[0].model);
  });

  it('keeps translation calculations in N with metre-based work', () => {
    const state = fixture(); state.lockEquipment = false;
    state.setups[0] = { ...state.setups[0], model: 'shrug', range: [0, 12], tilt: 0, resistance: 'dumbbell', loadMass: 10, loadedSides: 'bilateral' };
    state.setups[1] = structuredClone(state.setups[0]); state.angles = [6, 6]; state.region = [0, 12];
    const p: StudyProposal = { ...proposal(state), changes: [{ parameter: 'tilt', value: 5 }] };
    const review = reviewStudyProposal(state, p);
    expect(getDefinition(review.next.setups[0]).unit).toBe('N');
    expect(review.summaries[0].mean).toBeCloseTo(196.2, 8);
    expect(review.summaries[0].externalWork).toBeCloseTo(-23.544, 8);
  });
});

describe('manual AI exchange boundary', () => {
  it('rejects arbitrary fields, prototype keys, code, nonfinite values and confounded proposals', () => {
    const state = fixture(), p = proposal(state);
    for (const data of [
      { ...p, code: 'fetch("https://example.invalid")' },
      { ...p, target: 'A' },
      { ...p, changes: [{ parameter: 'tension', value: 500 }] },
      { ...p, changes: [{ parameter: 'loadedSides', value: 'bilateral' }] },
      { ...p, changes: [{ parameter: '__proto__', value: 1 }] },
      { ...p, changes: [{ parameter: 'pulleyHeight', value: null }] },
      { ...p, changes: [{ parameter: 'pulleyHeight', value: 100 }] },
      { ...p, changes: [{ parameter: 'pulleyHeight', value: 2 }, { parameter: 'hipX', value: 1 }] },
    ]) expect(() => parseStudyProposal(JSON.stringify(data), state)).toThrow();
    const nonfinite = JSON.stringify(p).replace(/"value":[^}]+/, '"value":1e999');
    expect(() => parseStudyProposal(nonfinite, state)).toThrow('finite number');
    const poison = JSON.stringify(p).replace('{"format"', '{"__proto__":{},"format"');
    expect(() => parseStudyProposal(poison, state)).toThrow('unsupported fields');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    const fence = String.fromCharCode(96).repeat(3);
    expect(() => parseStudyProposal(fence + 'json\n' + JSON.stringify(p) + '\n' + fence, state)).toThrow('without Markdown');
  });

  it('rejects stale baselines including measurement provenance and locks', () => {
    const state = fixture(), p = proposal(state);
    state.profiles[0].provenance.upperArm = 'measured';
    expect(() => applyStudyProposal(state, p)).toThrow('baseline has changed');
    const fresh = proposal(state); state.profiles[0].locked.upperArm = true;
    expect(() => applyStudyProposal(state, fresh)).toThrow('baseline has changed');
  });

  it('exports only selected context and an explicit response schema, with no B or private notes', () => {
    const state = fixture(); state.name = 'PRIVATE comparison'; state.notes = 'PRIVATE note';
    state.setups[0].name = 'PRIVATE A'; state.setups[1].name = 'PRIVATE B';
    const minimal = studyExchange(state, 'PRIVATE question', { question: false, setup: false, body: false, results: false });
    expect(minimal).not.toContain('PRIVATE'); expect(minimal).not.toContain('"bodyA"'); expect(minimal).not.toContain('"setupA"');
    expect(minimal).toContain('RESPONSE JSON SCHEMA'); expect(minimal).toContain(studyBasis(state));
    const selected = studyExchange(state, 'Chosen question', { question: true, setup: false, body: true, results: false });
    expect(selected).toContain('"bodyA"'); expect(selected).toContain('Chosen question'); expect(selected).not.toContain('PRIVATE');
    const full = studyExchange(state, 'Question', { question: true, setup: true, body: true, results: true });
    expect(full).toContain('"resultsA"'); expect(full).toContain('PRIVATE A'); expect(full).not.toContain('PRIVATE B'); expect(full).not.toContain('PRIVATE note');
  });

  it('does not allow geometry proposals to invent an unknown machine mechanism', () => {
    const state = fixture(); state.setups[0].model = 'machine'; state.lockForce = false;
    expect(availableStudyParameters(state.setups[0])).toEqual([]);
    expect(() => validateStudyProposal(proposal(state), state)).toThrow('not supported');
  });
});
