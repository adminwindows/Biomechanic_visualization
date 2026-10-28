import { describe, expect, it } from "vitest";
import { BAR_RADIUS, RAD, defaultProfile, evaluate, geometry, presets, type Setup } from "./engine";
import { USABLE_BOUNDARY_INSET, usableIntervals } from "./usableRange";

const classic = presets.find((preset) => preset.preset === "classic")!;
const bench = presets.find((preset) => preset.preset === "bench")!;
const hip = presets.find((preset) => preset.preset === "hip-extension")!;
const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
const barExit = 180 + Math.asin((0.08 + bench.backThickness + BAR_RADIUS) / reach) / RAD;
const grazingBench = (entry: number): Setup => ({
  ...bench, tilt: 90, hipX: 1, hipHeight: 0.46,
  backLength: defaultProfile.torso - reach * Math.cos(entry * RAD) - BAR_RADIUS,
  range: [195.5, 197],
});

function expectClear(setup: Setup, intervals: [number, number][]) {
  for (const [start, end] of intervals) {
    expect(start).toBeGreaterThanOrEqual(setup.range[0]);
    expect(end).toBeLessThanOrEqual(setup.range[1]);
    expect(start).toBeLessThan(end);
    for (let step = 0; step <= 20; step++) {
      const q = start + (end - start) * step / 20;
      const result = evaluate(setup, defaultProfile, q);
      expect(["contact", "invalid", "singular"]).not.toContain(result.status);
      expect(result.geometry.cables.every((cable) => cable.length > 1e-9)).toBe(true);
    }
  }
}

describe("geometry-limited usable intervals", () => {
  it("preserves clear original endpoints without cumulatively shrinking the range", () => {
    const setup: Setup = { ...classic, range: [40, 190] };
    expect(usableIntervals(setup, defaultProfile)).toEqual({ known: true, intervals: [[40, 190]] });
    expect(setup.range).toEqual([40, 190]);
    expect(usableIntervals(setup, defaultProfile)).toEqual({ known: true, intervals: [[40, 190]] });
  });

  it("splits around a narrow contact missed by the complete 0.5° grid", () => {
    const entry = 196.1;
    const setup = grazingBench(entry);
    for (const q of [195.5, 196, 196.5, 197]) expect(evaluate(setup, defaultProfile, q).status).not.toBe("contact");
    const result = usableIntervals(setup, defaultProfile);
    expect(result.known).toBe(true);
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0][0]).toBe(195.5);
    expect(result.intervals[0][1]).toBeCloseTo(entry - USABLE_BOUNDARY_INSET, 7);
    expect(result.intervals[1][0]).toBeCloseTo(barExit + USABLE_BOUNDARY_INSET, 7);
    expect(result.intervals[1][1]).toBe(197);
    expectClear(setup, result.intervals);
  });

  it("does not merge clear intervals across an isolated corner tangency", () => {
    const setup = grazingBench(barExit);
    expect(evaluate(setup, defaultProfile, barExit).status).toBe("contact");
    const result = usableIntervals(setup, defaultProfile);
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0][1]).toBeLessThan(barExit);
    expect(result.intervals[1][0]).toBeGreaterThan(barExit);
    expectClear(setup, result.intervals);
  });

  it("finds a floor-crossing interval around an unsampled angular minimum", () => {
    // A raised foot dips below ground only within a small interval around 10.2°.
    // The standing leg remains consistent, while the moving leg follows its own arc.
    const setup: Setup = { ...hip, tilt: -10.2, hipHeight: 0.919999, range: [9.5, 11] };
    expect(evaluate(setup, defaultProfile, 10.2).status).toBe("invalid");
    for (const q of [9.5, 10, 10.5, 11]) expect(evaluate(setup, defaultProfile, q).status).not.toBe("invalid");
    const result = usableIntervals(setup, defaultProfile);
    expect(result.known).toBe(true);
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0][1]).toBeLessThan(10.2);
    expect(result.intervals[1][0]).toBeGreaterThan(10.2);
    expectClear(setup, result.intervals);
  });

  it("finds an isolated cable singularity even when unknown force masks its status", () => {
    const base: Setup = { ...classic, tilt: 0, facing: 1, hipX: 0, forceKnown: false, range: [170, 190] };
    const target = 180.137;
    const targetPose = geometry(base, defaultProfile, target);
    const setup: Setup = { ...base, planeOffset: targetPose.hand[0], pulleyHeight: targetPose.hand[2] };
    expect(evaluate(setup, defaultProfile, target).status).toBe("unknown");
    expect(evaluate(setup, defaultProfile, target).geometry.cables[0].length).toBeLessThan(1e-9);
    const result = usableIntervals(setup, defaultProfile);
    expect(result.known).toBe(true);
    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0][1]).toBeLessThan(target);
    expect(result.intervals[1][0]).toBeGreaterThan(target);
    expectClear(setup, result.intervals);
  });

  it("keeps defined routing geometrically assessable with unknown or zero force", () => {
    for (const update of [{ forceKnown: false }, { tension: 0 }]) {
      const result = usableIntervals({ ...classic, ...update }, defaultProfile);
      expect(result).toEqual({ known: true, intervals: [classic.range] });
    }
  });

  it("reports unavailable routing separately from an empty clear range", () => {
    expect(usableIntervals(presets.find((preset) => preset.model === "machine")!, defaultProfile)).toEqual({ known: false, intervals: [] });
    expect(usableIntervals({ ...classic, resistance: "unknown" }, defaultProfile)).toEqual({ known: false, intervals: [] });
    expect(usableIntervals({ ...classic, slack: true }, defaultProfile)).toEqual({ known: false, intervals: [] });
    expect(usableIntervals({ ...classic, hipHeight: 1.5 }, defaultProfile)).toEqual({ known: true, intervals: [] });
  });

  it("handles zero-width ranges and malformed input conservatively", () => {
    expect(usableIntervals({ ...classic, range: [90, 90] }, defaultProfile)).toEqual({ known: true, intervals: [] });
    expect(usableIntervals({ ...classic, range: [100, 90] }, defaultProfile)).toEqual({ known: false, intervals: [] });
    expect(usableIntervals({ ...classic, range: [NaN, 90] }, defaultProfile)).toEqual({ known: false, intervals: [] });
    expect(usableIntervals(classic, { ...defaultProfile, upperArm: -1 })).toEqual({ known: false, intervals: [] });
  });
});

it('partitions a translational shrug at a cable singularity using centimetres', () => {
  const setup: Setup = { ...classic, model: 'shrug', resistance: 'cable', loadedSides: 'unilateral', cables: 1, tilt: 0, facing: 1, hipHeight: .9, range: [0, 12], forceKnown: false };
  const crossing = 6.137;
  const target = geometry(setup, defaultProfile, crossing).cables[0].attachment;
  setup.outletPositions = [[...target]];
  expect(geometry(setup, defaultProfile, crossing).cables[0].length).toBeLessThan(1e-9);
  const result = usableIntervals(setup, defaultProfile);
  expect(result.known).toBe(true);
  expect(result.intervals).toHaveLength(2);
  expect(result.intervals[0][1]).toBeCloseTo(crossing - USABLE_BOUNDARY_INSET, 6);
  expect(result.intervals[1][0]).toBeCloseTo(crossing + USABLE_BOUNDARY_INSET, 6);
  expectClear(setup, result.intervals);
});


it('restricts motion around a narrow cable-travel violation, not just its singular centre', () => {
  const setup: Setup = { ...classic, model: 'shrug', resistance: 'cable', loadedSides: 'unilateral', cables: 1, tilt: 0, facing: 1, hipHeight: .9, range: [6, 6.3], cableTravelMin: .0001 };
  const target = geometry(setup, defaultProfile, 6.137).cables[0].attachment;
  setup.outletPositions = [[...target]];
  const result = usableIntervals(setup, defaultProfile);
  expect(result.known).toBe(true);
  expect(result.intervals).toHaveLength(2);
  expect(result.intervals[0][1]).toBeLessThan(6.127);
  expect(result.intervals[1][0]).toBeGreaterThan(6.147);
  for (const interval of result.intervals) for (const value of interval) expect(geometry(setup, defaultProfile, value).travelValid).toBe(true);
});
