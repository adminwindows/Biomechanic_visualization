import { describe, expect, it } from "vitest";
import type { Geometry, Profile, Setup, Vec3 } from "./engine";
import { evaluate, geometry, sampleCurve } from "./engine";
import { usableIntervals } from "./usableRange";
import {
  bodyCapsules, collisionAt, collisionBands, segmentBoxDistance, segmentSegmentDistance,
  type CollisionBands, type CollisionObstacle,
} from "./collisions";

const RAD = Math.PI / 180;
const profile: Profile = { height: 1.75, upperArm: 0.33, forearm: 0.27, hand: 0.1, torso: 0.59, shoulderWidth: 0.42 };
const baseSetup: Setup = {
  preset: "collision-fixture", name: "Synthetic collision fixture", model: "pullover", kind: "standing", facing: 1,
  tilt: 0, hipX: 1, hipHeight: 0.9, pulleyHeight: 2, outletSpacing: 1, attachmentSpacing: 1,
  cables: 1, tension: 100, elbow: 0, backLength: 0.8, backWidth: 0.34, backThickness: 0.1, range: [0, 1],
};
const settings = (patch: Record<string, unknown>): Setup => ({ ...baseSetup, ...patch }) as Setup;
const blank = (): Geometry => ({
  hip: [20, 20, 20], shoulder: [20, 20, 21], elbow: [20, 20, 22], wrist: [20, 20, 23], hand: [20, 20, 24], head: [20, 20, 25],
  backBase: [20, 20, 20], backTop: [20, 20, 21], torsoDirection: [0, 0, 1], normal: [1, 0, 0], axis: [0, 1, 0], handDerivative: [0, 0, 0],
  grips: [[-0.2, 0, 0], [0.2, 0, 0]], elbows: [[-0.2, 0, -0.3], [0.2, 0, -0.3]],
  shoulders: [[-0.2, 0, -0.6], [0.2, 0, -0.6]],
  barEnds: [[-0.3, 0, 0], [0.3, 0, 0]], backCorners: [], cables: [], limbs: [], loads: [], hasBar: false, supportValid: true,
});
const addCable = (g: Geometry, a: Vec3, b: Vec3) => {
  g.cables.push({ attachment: a, outlet: b, force: [1, 0, 0], length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) });
};
const sphere = (center: Vec3, radius: number, patch: Partial<CollisionObstacle> = {}): CollisionObstacle => ({ id: "object", name: "Named frame", type: "capsule", a: center, b: center, radius, ...patch } as CollisionObstacle);
const covers = (bands: CollisionBands, q: number) => [...bands.unsafe, ...bands.unresolved].some(([a, b]) => q >= a - 1e-10 && q <= b + 1e-10);
const pointOnCircle = (q: number, radius = 1): Vec3 => [radius * Math.cos(q * RAD), radius * Math.sin(q * RAD), 0];
const rotatingPoint = (_setup: Setup, _profile: Profile, q: number): Geometry => {
  const g = blank(), point = pointOnCircle(q);
  g.hasBar = true; g.barEnds = [point, point];
  return g;
};

describe("exact geometric distance primitives", () => {
  it("handles crossing, parallel, skew and degenerate closed segments", () => {
    expect(segmentSegmentDistance([-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]).distance).toBeCloseTo(0, 12);
    expect(segmentSegmentDistance([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]).distance).toBeCloseTo(1, 12);
    const skew = segmentSegmentDistance([0, 0, 0], [1, 0, 0], [0.5, 1, -1], [0.5, 1, 1]);
    expect(skew.distance).toBeCloseTo(1, 12);
    expect(skew.a).toEqual([0.5, 0, 0]); expect(skew.b).toEqual([0.5, 1, 0]);
    expect(segmentSegmentDistance([0, 0, 0], [0, 0, 0], [0, 3, 0], [0, 3, 0]).distance).toBe(3);
  });

  it("does not mistake a nearly parallel crossing for two separated lines", () => {
    const result = segmentSegmentDistance([0, 0, 0], [1, 0, 0], [0, 1e-8, 0], [1, -1e-8, 0]);
    expect(result.distance).toBeCloseTo(0, 14);
    expect(result.a[0]).toBeCloseTo(0.5, 12);
  });

  it("computes Euclidean box-edge and corner distances without square inflation", () => {
    expect(segmentBoxDistance([-2, 0, 0], [2, 0, 0], [0, 0, 0], [2, 2, 2]).distance).toBe(0);
    const edge = segmentBoxDistance([1.1, 1.1, -2], [1.1, 1.1, 2], [0, 0, 0], [2, 2, 2]);
    expect(edge.distance).toBeCloseTo(Math.sqrt(0.02), 12);
    expect(segmentBoxDistance([2, 2, 2], [2, 2, 2], [0, 0, 0], [2, 2, 2]).distance).toBeCloseTo(Math.sqrt(3), 12);
    const g = blank(); g.hasBar = true; g.barEnds = [[1.1, 1.1, -2], [1.1, 1.1, 2]];
    expect(collisionAt(settings({ barRadius: 0.12, obstacles: [{ id: "box", name: "Frame", type: "box", center: [0, 0, 0], size: [2, 2, 2] }] }), g)).toBeNull();
  });
});

describe("represented body, frame and attachment contact", () => {
  it("has a true disabled fast path", () => {
    const g = blank(); g.hasBar = true;
    expect(collisionAt(baseSetup, g)).toBeNull();
    expect(collisionBands(baseSetup, profile, () => { throw new Error("Should not run"); }, RAD)).toEqual({ unsafe: [], unresolved: [] });
  });

  it("exports exactly the same body radius for rendering, including head but excluding feet", () => {
    const g = blank();
    g.limbs = [{ from: [0, 0, 0], to: [0, 0, 1], kind: "body" }, { from: [0, 0, 0], to: [1, 0, 0], kind: "foot" }];
    expect(bodyCapsules(g, baseSetup)).toEqual([]);
    const capsules = bodyCapsules(g, settings({ bodyCollision: true }));
    expect(capsules).toHaveLength(2);
    expect(capsules.every((capsule) => capsule.radius === 0.06)).toBe(true);
    expect(capsules.find((capsule) => capsule.name === "Head")!.a).toEqual(g.head);
  });

  it("exempts a cable's intended grip contact but still detects contact farther along it", () => {
    const g = blank();
    g.limbs = [{ from: [-0.3, 0, 0], to: [0, 0, 0], kind: "forearm" }];
    addCable(g, [0, 0, 0], [1, 0, 0]);
    const s = settings({ bodyCollision: true });
    expect(collisionAt(s, g)).toBeNull();
    g.limbs.push({ from: [0.5, -0.2, 0], to: [0.5, 0.2, 0], kind: "upperArm" });
    expect(collisionAt(s, g)).toMatchObject({ kind: "cable–body" });
  });

  it("never applies the intentional grip allowance to an external obstacle", () => {
    const g = blank(); addCable(g, [0, 0, 0], [1, 0, 0]);
    const s = settings({ obstacles: [sphere([0.025, 0, 0], 0.005)], collisionAttachmentClearance: 0.1 });
    expect(collisionAt(s, g)).toMatchObject({ kind: "cable–obstacle", label: "Cable 1 meets Named frame" });
    const bands = collisionBands(s, profile, () => structuredClone(g), RAD);
    expect(bands.unsafe).toEqual([[0, 1]]);
  });

  it("trims the forearm chain near a rigid bar grip without ignoring proximal body contact", () => {
    const g = blank(); g.hasBar = true;
    g.grips = [[-0.2, 0, 0], [0.2, 0, 0]];
    g.limbs = [-0.2, 0.2].flatMap((x) => [
      { from: [x, 0, -0.3] as Vec3, to: [x, 0, -0.03] as Vec3, kind: "forearm" as const },
      { from: [x, 0, -0.03] as Vec3, to: [x, 0, 0] as Vec3, kind: "forearm" as const },
    ]);
    const s = settings({ bodyCollision: true });
    expect(collisionAt(s, g)).toBeNull();
    g.limbs.push({ from: [-0.1, -0.2, 0], to: [-0.1, 0.2, 0], kind: "body" });
    expect(collisionAt(s, g)).toMatchObject({ kind: "bar–body" });
  });

  it("exempts explicit support/body contact while continuing to check cables and bars", () => {
    const g = blank(); g.limbs = [{ from: [0, 0, 0], to: [0, 0, 1], kind: "body" }];
    const obstacle = { id: "seat", name: "Seat", type: "box", center: [0, 0, 0], size: [0.5, 0.5, 0.1] };
    expect(collisionAt(settings({ bodyCollision: true, obstacles: [obstacle] }), g)?.kind).toBe("body–obstacle");
    const s = settings({ bodyCollision: true, obstacles: [{ ...obstacle, allowBodyContact: true }] });
    expect(collisionAt(s, g)).toBeNull();
    g.hasBar = true;
    g.barEnds = [[-0.3, 0.2, 0], [0.3, 0.2, 0]];
    expect(collisionAt(s, g)?.kind).toBe("bar–obstacle");
  });

  it("detects a capsule tangent and returns named finite witnesses", () => {
    const g = blank(); g.hasBar = true; g.barEnds = [[-1, 0, 0], [1, 0, 0]];
    const contact = collisionAt(settings({ barRadius: 0.02, obstacles: [sphere([0, 0.12, 0], 0.1)] }), g)!;
    expect(contact).toMatchObject({ kind: "bar–obstacle", label: "Bar meets Named frame" });
    expect(contact.clearance).toBeCloseTo(0, 12);
    expect(contact.point.every(Number.isFinite)).toBe(true);
  });
});

describe("continuous conservative collision intervals", () => {
  it("keeps an integrated narrow obstacle out of both plotted mechanics and usable ranges", () => {
    const target = 160.173;
    const plain = settings({ resistance: "dumbbell", freeWeightKind: "barbell", loadedSides: "bilateral", loadMass: 10, barRadius: 0.00001, range: [160, 161] });
    const center = geometry(plain, profile, target).hand;
    const s = { ...plain, obstacles: [sphere(center, 0.0001)] } as Setup;
    for (const q of [160, 160.5, 161]) expect(evaluate(s, profile, q).moment).not.toBeNull();
    expect(evaluate(s, profile, target)).toMatchObject({ status: "contact", moment: null, contactKind: "bar–obstacle" });
    expect(sampleCurve(s, profile).some((point) => point.moment === null)).toBe(true);
    const usable = usableIntervals(s, profile);
    expect(usable.known).toBe(true);
    expect(usable.intervals).toHaveLength(2);
    expect(usable.intervals.some(([a, b]) => target >= a && target <= b)).toBe(false);
    for (const [start, end] of usable.intervals) for (let step = 0; step <= 30; step++) {
      const q = start + (end - start) * step / 30;
      expect(collisionAt(s, geometry(s, profile, q))).toBeNull();
      expect(evaluate(s, profile, q).moment).not.toBeNull();
    }
  });

  it("captures a narrow obstacle crossing entirely between 0.5° samples", () => {
    const target = 0.173;
    const s = settings({ barRadius: 0.00001, obstacles: [sphere(pointOnCircle(target), 0.0001)] });
    for (const q of [0, 0.5, 1]) expect(collisionAt(s, rotatingPoint(s, profile, q))).toBeNull();
    expect(collisionAt(s, rotatingPoint(s, profile, target))).not.toBeNull();
    const bands = collisionBands(s, profile, rotatingPoint, RAD);
    expect(covers(bands, target)).toBe(true);
    expect(bands.unsafe.length).toBeGreaterThan(0);
    expect(bands.unresolved.length).toBeGreaterThan(0);
    for (let step = 0; step <= 2000; step++) {
      const q = step / 2000;
      if (collisionAt(s, rotatingPoint(s, profile, q))) expect(covers(bands, q)).toBe(true);
    }
  });

  it("never certifies a tangency as clear even without a negative clearance sample", () => {
    const target = 0.173, radius = 0.01;
    const s = settings({ barRadius: 0, obstacles: [sphere(pointOnCircle(target, 1 + radius), radius)] });
    expect(collisionAt(s, rotatingPoint(s, profile, target))).not.toBeNull();
    expect(collisionAt(s, rotatingPoint(s, profile, target - 0.01))).toBeNull();
    expect(collisionAt(s, rotatingPoint(s, profile, target + 0.01))).toBeNull();
    const bands = collisionBands(s, profile, rotatingPoint, RAD);
    expect(covers(bands, target)).toBe(true);
    expect(bands.unresolved.some(([a, b]) => target >= a && target <= b)).toBe(true);
  });

  it("certifies a clear gap and a static contact without unnecessary subdivision", () => {
    const clearSetup = settings({ obstacles: [sphere([5, 5, 5], 0.1)] });
    expect(collisionBands(clearSetup, profile, rotatingPoint, RAD)).toEqual({ unsafe: [], unresolved: [] });
    const g = blank(); g.hasBar = true;
    const contactSetup = settings({ obstacles: [sphere([0, 0, 0], 0.1)] });
    expect(collisionBands(contactSetup, profile, () => structuredClone(g), RAD)).toEqual({ unsafe: [[0, 1]], unresolved: [] });
  });

  it("uses affine centimetre motion for shrug without a second coordinate conversion", () => {
    const s = settings({ model: "shrug", range: [0, 2], barRadius: 0.00001, obstacles: [sphere([0, 0, 0.0073], 0.00005)] });
    const translate = (_s: Setup, _p: Profile, q: number): Geometry => {
      const g = blank(); g.hasBar = true; g.barEnds = [[0, 0, q * 0.01], [0, 0, q * 0.01]]; return g;
    };
    const bands = collisionBands(s, profile, translate, 0.01);
    expect(covers(bands, 0.73)).toBe(true);
    for (let step = 0; step <= 1000; step++) {
      const q = step / 500;
      if (collisionAt(s, translate(s, profile, q))) expect(covers(bands, q)).toBe(true);
    }
  });

  it("keeps intentional bar-hand exemptions stable through a rotating motion", () => {
    const s = settings({ bodyCollision: true, range: [0, 180] });
    const rotateBody = (_s: Setup, _p: Profile, q: number): Geometry => {
      const g = blank(), c = Math.cos(q * RAD), sn = Math.sin(q * RAD);
      const rotate = ([x, y, z]: Vec3): Vec3 => [x * c + z * sn, y, -x * sn + z * c];
      g.hasBar = true; g.grips = [[0, -0.2, 0], [0, 0.2, 0]];
      g.barEnds = [[0, -0.3, 0], [0, 0.3, 0]];
      g.limbs = [-0.2, 0.2].map((y) => ({ from: rotate([0, y, -0.3]), to: rotate([0, y, 0]), kind: "forearm" as const }));
      return g;
    };
    expect(collisionBands(s, profile, rotateBody, RAD)).toEqual({ unsafe: [], unresolved: [] });
  });
});
