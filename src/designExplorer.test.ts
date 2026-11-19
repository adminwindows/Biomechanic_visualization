import { describe, expect, it } from 'vitest';
import { BAR_RADIUS, RAD, defaultProfile, presets } from './engine';
import { createInitialState, forceValue, validateState } from './state';
import { candidateComparison, evaluateCandidate, explorerGrid, paretoCandidates, prescribedPower, uncertaintyOffsets, type ExplorerCandidate, type ExplorerConfig } from './designExplorer';

const base = createInitialState();
const config: ExplorerConfig = { distance: [.4, 1], height: [1.5, 2.5], steps: 5, region: [100, 170], objective: 'mean', requireClear: true, avoidAssistance: false, minimumMean: 0, uncertainty: { dimension: 'upperArm', lower: .02, upper: .02 }, requireRobust: false };
const point = { id: 0, hipX: base.setups[0].hipX, pulleyHeight: base.setups[0].pulleyHeight };
const candidate = () => evaluateCandidate(base.setups[0], base.profiles[0].values, config, point);

describe('constrained placement exploration', () => {
  it('covers the specified map bounds and rejects malformed search intervals', () => {
    const grid = explorerGrid(config);
    expect(grid).toHaveLength(25);
    expect(grid[0]).toEqual({ id: 0, hipX: .4, pulleyHeight: 2.5 });
    expect(grid[24]).toEqual({ id: 24, hipX: 1, pulleyHeight: 1.5 });
    expect(() => explorerGrid({ ...config, distance: [1, .4] })).toThrow('ordered');
    expect(() => explorerGrid({ ...config, steps: 50 })).toThrow('3–13');
  });
  it('varies placement while preserving body, load convention and original ROM', () => {
    const source = { ...base.setups[0], loadMode: 'mass' as const, loadMass: 10, transmissionFactor: .5 };
    const profile = structuredClone(base.profiles[0].values);
    const result = evaluateCandidate(source, profile, config, { ...point, hipX: point.hipX + .1 });
    expect(result.feasible).toBe(true);
    expect(result.setup.range).toEqual(source.range);
    expect(forceValue(result.setup)).toBe(forceValue(source));
    expect({ ...result.setup, hipX: source.hipX, pulleyHeight: source.pulleyHeight }).toEqual(source);
    expect(profile).toEqual(base.profiles[0].values);
  });
  it('shifts explicit asymmetric outlets together while preserving their relative geometry', () => {
    const source = { ...base.setups[0], outletPositions: [[0, -.4, 2], [.1, .4, 2.4]] as [number, number, number][] };
    const result = evaluateCandidate(source, base.profiles[0].values, config, { ...point, pulleyHeight: 2.5 });
    expect(result.setup.outletPositions!.map(point => point.slice(0, 2))).toEqual([[0, -.4], [.1, .4]]);
    expect(result.setup.outletPositions![0][2]).toBeCloseTo(2.3, 10);
    expect(result.setup.outletPositions![1][2]).toBeCloseTo(2.7, 10);
    expect(result.setup.range).toEqual(source.range);
    expect(result.setup.tension).toBe(source.tension);
    expect(source.outletPositions).toEqual([[0, -.4, 2], [.1, .4, 2.4]]);
  });
  it('checks the entire original ROM for narrow contact even when the objective region is clear', () => {
    const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
    const setup = { ...presets.find(p => p.preset === 'bench')!, tilt: 90, hipX: 1, hipHeight: .46,
      backLength: defaultProfile.torso - reach * Math.cos(196.1 * RAD) - BAR_RADIUS,
      range: [195.5, 197] as [number, number] };
    const result = evaluateCandidate(setup, defaultProfile, { ...config, region: [195.5, 196], uncertainty: { dimension: 'upperArm', lower: 0, upper: 0 } }, { id: 0, hipX: 1, pulleyHeight: setup.pulleyHeight });
    expect(result.metrics.complete).toBe(true);
    expect(result.feasible).toBe(false);
    expect(result.reasons.join(' ')).toContain('Original movement range contains');
    expect(result.setup.range).toEqual([195.5, 197]);
  });
  it('treats an unavailable uncertainty scenario as a failed robust constraint, not zero loading', () => {
    const uncertain = { ...config, uncertainty: { dimension: 'backWidth' as const, lower: .3, upper: 0 } };
    const nominal = evaluateCandidate(base.setups[0], base.profiles[0].values, uncertain, point);
    const robust = evaluateCandidate(base.setups[0], base.profiles[0].values, { ...uncertain, requireRobust: true }, point);
    expect(nominal.feasible).toBe(true);
    expect(nominal.envelope).toBeNull();
    expect(robust.feasible).toBe(false);
    expect(robust.validScenarios).toBeLessThan(robust.scenarioCount);
    expect(uncertaintyOffsets(.01, .03)).toContain(0);
    expect(uncertaintyOffsets(0, 0)).toEqual([0]);
  });
  it('rejects unknown force and ranks tradeoffs without collapsing them to one winner', () => {
    expect(evaluateCandidate({ ...base.setups[0], forceKnown: false }, base.profiles[0].values, config, point).feasible).toBe(false);
    const sample = candidate();
    const options = [
      { ...sample, id: 1, score: 30, movement: .5, sensitivity: 2 },
      { ...sample, id: 2, score: 20, movement: .1, sensitivity: 1 },
      { ...sample, id: 3, score: 10, movement: .6, sensitivity: 3 },
    ] as ExplorerCandidate[];
    expect(paretoCandidates(options).map(item => item.id)).toEqual([1, 2]);
  });
  it('applies a candidate against an identical-body, identical-load baseline without narrowing ROM', () => {
    const result = candidate();
    const comparison = candidateComparison(base, 0, result, config);
    expect(() => validateState(comparison)).not.toThrow();
    expect(comparison.criterion).toContain('Measurement scenarios');
    expect(comparison.lockBody).toBe(true);
    expect(comparison.lockForce).toBe(true);
    expect(comparison.lockEquipment).toBe(false);
    expect(comparison.profiles[1]).toEqual(comparison.profiles[0]);
    expect(comparison.setups[1].range).toEqual(base.setups[0].range);
    expect(forceValue(comparison.setups[1])).toBe(forceValue(comparison.setups[0]));
    expect(base.setups[1].preset).toBe('bench');
  });
  it('uses a prescribed speed and the correct signed work-conjugate coordinate for power', () => {
    const metrics = { complete: true, mean: 10, minimum: 10, maximum: 10, externalWork: -5 * Math.PI, resistingFraction: 1 };
    expect(prescribedPower(metrics, [0, 90], 30)).toMatchObject({ duration: 3 });
    expect(prescribedPower(metrics, [0, 90], 30)!.mean).toBeCloseTo(-5 * Math.PI / 3);
    const force = { ...metrics, mean: 100, minimum: 100, maximum: 100, externalWork: -5 };
    expect(prescribedPower(force, [0, 5], 2, .01)).toMatchObject({ duration: 2.5, mean: -2, minimum: -2, maximum: -2 });
    expect(prescribedPower({ ...metrics, complete: false }, [0, 90], 30)).toBeNull();
  });
});
