import { describe, expect, it } from 'vitest';
import { BAR_RADIUS, RAD, defaultProfile, presets, type Setup } from './engine';
import { createInitialState } from './state';
import { canCompareRegions, comparisonDifferences, comparisonReport, parameterSweep, regionSummary, scanEvents, summarizeSamples, type AnalysisSample } from './analysis';

const sample = (angle: number, moment: number | null, cableMoment = moment, gravityMoment: number | null = moment === null ? null : 0): AnalysisSample => ({ angle, moment, cableMoment, gravityMoment, status: moment === null ? 'contact' : moment > 0 ? 'resists' : moment < 0 ? 'assists' : 'no-force' });
const classic = presets.find(preset => preset.preset === 'classic')!;
const bench = presets.find(preset => preset.preset === 'bench')!;

describe('region integration', () => {
  it('integrates angle in radians and external work with reference-action sign', () => {
    const summary = summarizeSamples([sample(0, 10), sample(90, 10)], [0, 90]);
    expect(summary).toMatchObject({ minimum: 10, maximum: 10, mean: 10, coverage: 1, complete: true, resistingFraction: 1 });
    expect(summary.externalWork).toBeCloseTo(-5 * Math.PI, 10);
    expect(summary.cableWork).toBeCloseTo(summary.externalWork!, 10);
    expect(summary.gravityWork).toBe(0);
  });
  it('weights nonuniform samples by angle and resolves a zero crossing', () => {
    const summary = summarizeSamples([sample(0, -10), sample(15, -5), sample(60, 10)], [0, 60]);
    expect(summary.mean).toBeCloseTo(0, 10);
    expect(summary.resistingFraction).toBeCloseTo(.5, 10);
    expect(summary.minimum).toBe(-10);
    expect(summary.maximum).toBe(10);
  });
  it('keeps cable and gravity work separate and additive', () => {
    const summary = summarizeSamples([sample(0, 30, 10, 20), sample(60, 30, 10, 20)], [0, 60]);
    expect(summary.externalWork).toBeCloseTo(-10 * Math.PI, 10);
    expect(summary.cableWork! + summary.gravityWork!).toBeCloseTo(summary.externalWork!, 10);
  });
  it('never bridges unavailable intervals or substitutes zero for unknown mechanics', () => {
    const summary = summarizeSamples([sample(0, 20), sample(10, 20), sample(20, null), sample(30, 20), sample(40, 20)], [0, 40]);
    expect(summary.coverage).toBe(.5);
    expect(summary).toMatchObject({ complete: false, mean: null, minimum: null, maximum: null, resistingFraction: null, externalWork: null });
  });
  it('distinguishes zero loading from unavailable loading', () => {
    const zero = summarizeSamples([sample(0, 0), sample(90, 0)], [0, 90]);
    expect(zero.complete).toBe(true);
    expect(zero.mean).toBe(0);
    expect(zero.resistingFraction).toBe(0);
    expect(Math.abs(zero.externalWork!)).toBe(0);
    expect(summarizeSamples([sample(0, null), sample(90, null)], [0, 90]).mean).toBeNull();
  });
  it('intersects the requested region with selected ROM and does not imply matching intervals', () => {
    const a = regionSummary(classic, defaultProfile, [120, 180]);
    const shortened = { ...classic, range: [140, 180] as [number, number] };
    const b = regionSummary(shortened, defaultProfile, [120, 180]);
    expect(a.region).toEqual([120, 180]);
    expect(b.region).toEqual([140, 180]);
    expect(canCompareRegions(classic, shortened, [a, b])).toBe(false);
    expect(regionSummary(classic, defaultProfile, [191, 200]).region).toBeNull();
    expect(() => regionSummary(classic, defaultProfile, [180, 100])).toThrow(RangeError);
  });
});

describe('separate sampled contact and reversal events', () => {
  it('finds the independent analytical reversal without claiming a contact', () => {
    const setup: Setup = { ...classic, facing: 1, tilt: 0, hipX: -1, hipHeight: .8, pulleyHeight: .8 + defaultProfile.torso + 1, range: [90, 180] };
    const scan = scanEvents(setup, defaultProfile);
    expect(scan.firstContact).toBeNull();
    expect(scan.firstReversal!.angle).toBeCloseTo(135, 2);
    // Pullover reference action proceeds from high to low angle: assistive then resistive.
    expect(scan.firstReversal!.transition).toBe('assists-to-resists');
    expect(scan.sampleSpacing).toBeLessThanOrEqual(.25);
    expect(scan.boundaryTolerance).toBe(.005);
  });
  it('does not manufacture reversal events for a force that is zero everywhere', () => {
    expect(scanEvents({ ...classic, tension: 0 }, defaultProfile).events.filter(event => event.kind === 'reversal')).toEqual([]);
  });
  it('reports backrest contact separately and invalidates full-region aggregates', () => {
    const setup: Setup = { ...bench, tilt: 90, hipX: 1, pulleyHeight: .5, backWidth: 1.5 };
    expect(scanEvents(setup, defaultProfile).firstContact).not.toBeNull();
    const summary = regionSummary(setup, defaultProfile, [100, 180]);
    expect(summary.complete).toBe(false);
    expect(summary.externalWork).toBeNull();
  });
});

describe('controlled comparisons and portable interpretation', () => {
  it('sweeps one dimension without mutating source equipment or changing the load', () => {
    const original = structuredClone(classic);
    const sweep = parameterSweep(classic, defaultProfile, [140, 180], 'pulleyHeight', [-.02, 0, .02]);
    expect(classic).toEqual(original);
    expect(sweep.map(point => Number(point.value.toFixed(2)))).toEqual([2.23, 2.25, 2.27]);
    expect(sweep[1].summary.mean).toBeCloseTo(regionSummary(classic, defaultProfile, [140, 180]).mean!, 10);
    expect(sweep[0].summary.mean).not.toBe(sweep[2].summary.mean);
    expect(parameterSweep({ ...classic, resistance: 'dumbbell' }, defaultProfile, [140, 180], 'pulleyHeight')).toEqual([]);
  });
  it('does not compare incompatible joint definitions', () => {
    const a = regionSummary(classic, defaultProfile, [140, 180]);
    expect(canCompareRegions(classic, { ...classic, model: 'curl' }, [a, a])).toBe(false);
  });
  it('records force convention, multiple changed variables and body provenance', () => {
    const state = createInitialState();
    const differences = comparisonDifferences(state);
    expect(differences.find(row => row.label === 'Number of cable attachments')!.different).toBe(true);
    expect(differences.find(row => row.label === 'Actual tension per attachment')!.different).toBe(false);
    expect(differences.some(row => row.label.includes('provenance'))).toBe(true);
    state.notes = 'Test a narrower backrest before interpreting overhead resistance.';
    state.observation = 'The bench felt more stable.';
    state.region = [140, 180];
    const report = comparisonReport(state);
    expect(report).toContain(state.modelVersion);
    expect(report).toContain('USER OBSERVATIONS (not computed)');
    expect(report).toContain(state.observation);
    expect(report).toContain('External-load work in reference action');
    expect(report).toContain('not estimates of muscle tension');
  });
});


it('does not report complete region metrics across a contact interval narrower than the sampling grid', () => {
  const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
  const setup: Setup = { ...bench, tilt:90, hipX:1, hipHeight:.46, backLength:defaultProfile.torso-reach*Math.cos(196.1*RAD)-BAR_RADIUS, range:[195.5,197] };
  const summary=regionSummary(setup,defaultProfile,[195.5,197]);
  expect(summary.complete).toBe(false);
  expect(summary.coverage).toBeLessThan(1);
  expect(summary.mean).toBeNull();
  expect(summary.externalWork).toBeNull();
  expect(summary.samples.some(point=>point.status==='contact')).toBe(true);
  expect(scanEvents(setup,defaultProfile).firstContact).not.toBeNull();
});
