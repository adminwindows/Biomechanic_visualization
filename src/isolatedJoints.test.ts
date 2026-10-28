import { describe, expect, it } from "vitest";
import { defaultProfile, geometry, presets, type Geometry, type Setup, type Vec3 } from "./engine";
import { buildIsolatedJoint, type IsolatedJointModel } from "./isolatedJoints";

const RAD = Math.PI / 180;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: Vec3): number => Math.hypot(...a);
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vectorClose = (actual: Vec3, expected: Vec3, digits = 8) => actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], digits));
const preset = presets.find((item) => item.preset === "curl-low")!;
type Options = Record<string, unknown>;

function configuration(model: IsolatedJointModel, overrides: Options = {}): Setup {
  const leg = model.startsWith("hip-") || model.startsWith("knee-");
  const seated = model === "knee-extension";
  return {
    ...preset, model, facing: 1, tilt: seated ? 90 : 0, kind: seated ? "bench" : "standing",
    posture: seated ? "seated" : "standing", hipHeight: seated ? 0.55 : leg ? 0.92 : 0.90,
    upperArmAngle: 0, elbow: model.startsWith("wrist-") || model === "forearm-rotation" ? 90 : 0,
    resistance: "cable", tension: 100, ...overrides,
  } as unknown as Setup;
}

function baseFor(setup: Setup): Geometry {
  const s = setup as Setup & { model: string };
  const standingLeg = (s.model.startsWith("hip-") || s.model === "knee-flexion") && s.kind !== "bench";
  return geometry({ ...setup, model: standingLeg ? "hip" : "curl", upperArmAngle: 0 }, defaultProfile, 0);
}

function build(model: IsolatedJointModel, q: number, options: Options = {}, tension: number | null = 100): Geometry {
  const setup = configuration(model, options);
  return buildIsolatedJoint(setup, defaultProfile, q, baseFor(setup), tension)!;
}

describe("isolated-joint geometry and analytical leverage", () => {
  it.each(["hip-abduction", "hip-adduction"] as const)("preserves the leg in %s and applies the force at its ankle", (model) => {
    const setup = configuration(model);
    const before = baseFor(setup);
    const output = buildIsolatedJoint(setup, defaultProfile, 30, structuredClone(before), 100)!;
    expect(output.supportValid).toBe(true);
    const activeLeg = output.limbs!.filter((limb) => ["thigh", "shank"].includes(limb.kind) && limb.from[1] > 0);
    expect(activeLeg).toHaveLength(2);
    expect(norm(sub(activeLeg[0].to, activeLeg[0].from))).toBeCloseTo(defaultProfile.thigh!, 9);
    expect(norm(sub(activeLeg[1].to, activeLeg[1].from))).toBeCloseTo(defaultProfile.shank!, 9);
    vectorClose(output.cables[0].attachment, activeLeg[1].to);
    vectorClose(output.jointAxis!, [1, 0, 0]);
    expect(output.hand[1]).toBeCloseTo(defaultProfile.pelvisWidth! / 2 + (defaultProfile.thigh! + defaultProfile.shank!) * Math.sin(30 * RAD), 9);
    const stance = (g: Geometry) => g.limbs!.filter((limb) => ["thigh", "shank", "foot"].includes(limb.kind) && limb.from[1] < 0);
    expect(stance(output)).toEqual(stance(before));
  });

  it("has the expected neutral hip-abduction lever against a lateral cable", () => {
    const pose = build("hip-abduction", 0);
    const output = build("hip-abduction", 0, { outletPositions: [add(pose.hand, [0, -1, 0])] });
    expect(dot(output.cables[0].force!, output.cables[0].derivative!)).toBeCloseTo(-100 * (defaultProfile.thigh! + defaultProfile.shank!), 9);
    expect(output.cables).toHaveLength(1);
  });

  it("rotates the shank about a fixed knee during seated extension", () => {
    const extended = build("knee-extension", 0);
    const flexed = build("knee-extension", 90);
    vectorClose(extended.elbow, flexed.elbow);
    vectorClose(extended.jointOrigin!, extended.elbow);
    expect(norm(sub(extended.hand, extended.elbow))).toBeCloseTo(defaultProfile.shank!, 9);
    expect(norm(sub(flexed.hand, flexed.elbow))).toBeCloseTo(defaultProfile.shank!, 9);
    expect(extended.hand[2]).toBeCloseTo(0.55, 9);
    expect(flexed.hand[2]).toBeCloseTo(0.55 - defaultProfile.shank!, 9);
    const loaded = build("knee-extension", 0, { outletPositions: [add(extended.hand, [0, 0, -0.4])] });
    // q is flexion; downward force assists q+, and therefore resists extension q−.
    expect(dot(loaded.cables[0].force!, loaded.handDerivative)).toBeCloseTo(100 * defaultProfile.shank!, 9);
  });

  it("uses the standing knee-flexion lever without moving the thigh", () => {
    const pose = build("knee-flexion", 90);
    const straight = build("knee-flexion", 0);
    vectorClose(pose.elbow, straight.elbow);
    vectorClose(pose.handDerivative, [0, 0, defaultProfile.shank!]);
    const loaded = build("knee-flexion", 90, { outletPositions: [add(pose.hand, [0, 0, -0.3])] });
    expect(dot(loaded.cables[0].force!, loaded.handDerivative)).toBeCloseTo(-100 * defaultProfile.shank!, 9);
  });

  it.each(["wrist-flexion", "wrist-extension"] as const)("holds the forearm fixed and preserves hand length in %s", (model) => {
    const a = build(model, -40), b = build(model, 55);
    vectorClose(a.elbow, b.elbow); vectorClose(a.wrist, b.wrist);
    expect(norm(sub(a.wrist, a.elbow))).toBeCloseTo(defaultProfile.forearm, 9);
    expect(norm(sub(a.hand, a.wrist))).toBeCloseTo(defaultProfile.hand, 9);
    expect(norm(sub(b.hand, b.wrist))).toBeCloseTo(defaultProfile.hand, 9);
    vectorClose(a.jointOrigin!, a.wrist);
    const zero = build(model, 0);
    const loaded = build(model, 0, { outletPositions: [add(zero.hand, [0, 0, -0.4])] });
    expect(dot(loaded.cables[0].force!, loaded.handDerivative)).toBeCloseTo(-100 * defaultProfile.hand, 9);
  });

  it("rotates an explicit schematic lever around the fixed forearm axis", () => {
    const a = build("forearm-rotation", 0), b = build("forearm-rotation", 90);
    vectorClose(a.wrist, b.wrist); vectorClose(a.elbow, b.elbow);
    vectorClose(a.jointAxis!, [1, 0, 0]);
    const center = add(a.wrist, [defaultProfile.hand, 0, 0]);
    expect(norm(sub(a.hand, center))).toBeCloseTo(0.08, 9);
    expect(norm(sub(b.hand, center))).toBeCloseTo(0.08, 9);
    expect(dot(sub(a.hand, center), a.jointAxis!)).toBeCloseTo(0, 9);
    const loaded = build("forearm-rotation", 0, { outletPositions: [add(a.hand, [0, 0, -0.4])] });
    expect(dot(loaded.cables[0].force!, loaded.handDerivative)).toBeCloseTo(8, 9);
  });

  it("translates both shoulder girdles in a shrug without stretching the torso", () => {
    const setup = configuration("shrug");
    const base = baseFor(setup);
    const raised = buildIsolatedJoint(setup, defaultProfile, 5, structuredClone(base), 100)!;
    vectorClose(raised.hip, base.hip); vectorClose(raised.shoulder, base.shoulder); vectorClose(raised.head, base.head);
    for (let side = 0; side < 2; side++) {
      vectorClose(raised.shoulders[side], add(base.shoulders[side], [0, 0, 0.05]));
      vectorClose(raised.grips[side], add(base.grips[side], [0, 0, 0.05]));
      expect(norm(sub(raised.elbows[side], raised.shoulders[side]))).toBeCloseTo(defaultProfile.upperArm, 9);
    }
    vectorClose(raised.handDerivative, [0, 0, 1]);
    expect(raised.cables).toHaveLength(2);
  });

  it.each([
    ["hip-abduction", 25], ["hip-adduction", 25], ["knee-extension", 55], ["knee-flexion", 65],
    ["wrist-flexion", 25], ["wrist-extension", -25], ["forearm-rotation", 65], ["shrug", 3],
  ] as const)("matches independent position and cable-work derivatives for %s", (model, q) => {
    const epsilon = 1e-6;
    const step = model === "shrug" ? epsilon * 100 : epsilon / RAD;
    const middle = build(model, q), before = build(model, q - step), after = build(model, q + step);
    for (let i = 0; i < middle.cables.length; i++) {
      vectorClose(middle.cables[i].derivative!, scale(sub(after.cables[i].attachment, before.cables[i].attachment), 1 / (2 * epsilon)), 7);
      const virtualWork = dot(middle.cables[i].force!, middle.cables[i].derivative!);
      expect(virtualWork).toBeCloseTo(-100 * (after.cables[i].length - before.cables[i].length) / (2 * epsilon), 5);
    }
  });
});

describe("isolated-joint loading, support and unknown inputs", () => {
  const gravityContribution = (g: Geometry) => g.loads!.filter((load) => load.kind === "gravity").reduce((sum, load) => sum + dot(load.force, load.derivative), 0);

  it("counts a barbell's total mass once for bilateral shrugging", () => {
    const barbell = build("shrug", 4, { resistance: "dumbbell", freeWeightKind: "barbell", loadMass: 20 });
    const dumbbells = build("shrug", 4, { resistance: "dumbbell", freeWeightKind: "dumbbell", loadMass: 20 });
    const shared = build("shrug", 4, { resistance: "dumbbell", freeWeightKind: "shared", loadMass: 20 });
    expect(gravityContribution(barbell)).toBeCloseTo(-20 * 9.81, 9);
    expect(gravityContribution(dumbbells)).toBeCloseTo(-40 * 9.81, 9);
    expect(gravityContribution(shared)).toBeCloseTo(-20 * 9.81, 9);
    expect(shared.hasBar).toBe(true);
    expect(barbell.hasBar).toBe(true); expect(dumbbells.hasBar).toBe(false);
    expect(barbell.cables).toHaveLength(0);
  });

  it("respects unilateral and bilateral handles while keeping leg loading unilateral", () => {
    expect(build("wrist-flexion", 20).cables).toHaveLength(1);
    expect(build("wrist-flexion", 20, { loadedSides: "bilateral" }).cables).toHaveLength(2);
    expect(build("shrug", 3, { loadedSides: "unilateral" }).cables).toHaveLength(1);
    expect(build("hip-abduction", 20, { loadedSides: "bilateral" }).cables).toHaveLength(1);
  });

  it("uses explicit outlet positions and preserves unknown cable directions", () => {
    const outlets: Vec3[] = [[-0.2, -0.4, 1.6], [0.3, 0.5, 1.7]];
    const g = build("wrist-flexion", 20, { loadedSides: "bilateral", outletPositions: outlets }, null);
    expect(g.cables.map((cable) => cable.outlet)).toEqual(outlets);
    expect(g.cables.every((cable) => cable.force === null)).toBe(true);
    expect(g.loads).toHaveLength(0);
  });

  it("excludes fixed-thigh gravity from the moving knee coordinate", () => {
    const g = build("knee-extension", 0, { segmentGravity: true, thighMass: 20, shankMass: 2, tension: 0 }, 0);
    expect(g.gravityKnown).toBe(true);
    expect(gravityContribution(g)).toBeCloseTo(2 * 9.81 * defaultProfile.shank! / 2, 9);
    const changedThigh = build("knee-extension", 0, { segmentGravity: true, thighMass: 40, shankMass: 2 }, 0);
    expect(gravityContribution(changedThigh)).toBeCloseTo(gravityContribution(g), 9);
  });

  it("includes declared hand gravity for wrist flexion and coaxial zero for rotation", () => {
    const wrist = build("wrist-flexion", 0, { segmentGravity: true, handMass: 0.5 }, 0);
    expect(gravityContribution(wrist)).toBeCloseTo(-0.5 * 9.81 * defaultProfile.hand / 2, 9);
    const rotation = build("forearm-rotation", 60, { segmentGravity: true, handMass: 0.5 }, 0);
    expect(gravityContribution(rotation)).toBeCloseTo(0, 9);
    expect(rotation.gravityKnown).toBe(true);
  });

  it("includes both moving arms' declared masses during a shrug", () => {
    const g = build("shrug", 3, { segmentGravity: true, upperArmMass: 2, forearmMass: 1, loadedSides: "unilateral" }, 0);
    expect(gravityContribution(g)).toBeCloseTo(-2 * (2 + 1) * 9.81, 9);
  });

  it.each(["hip-abduction", "knee-extension", "wrist-flexion", "forearm-rotation", "shrug"] as const)("keeps missing segment masses unknown in %s", (model) => {
    expect(build(model, 20, { segmentGravity: true }, 0).gravityKnown).toBe(false);
  });

  it("does not invent an unknown dumbbell mass or loading geometry", () => {
    expect(build("shrug", 2, { resistance: "dumbbell", loadMass: undefined }).gravityKnown).toBe(false);
    const unknown = build("wrist-flexion", 10, { resistance: "unknown" }, null);
    expect(unknown.cables).toHaveLength(0); expect(unknown.loads).toHaveLength(0);
  });

  it("reports an active foot crossing the floor without stretching its shank", () => {
    const g = build("knee-extension", 90, { hipHeight: 0.46 });
    expect(g.supportValid).toBe(false);
    expect(g.validityReason).toMatch(/foot crosses the floor/);
    expect(norm(sub(g.hand, g.elbow))).toBeCloseTo(defaultProfile.shank!, 9);
  });

  it("preserves an existing support conflict", () => {
    const setup = configuration("wrist-flexion");
    const base = baseFor(setup);
    base.supportValid = false; base.validityReason = "Existing support conflict";
    const g = buildIsolatedJoint(setup, defaultProfile, 20, base, 100)!;
    expect(g.supportValid).toBe(false);
    expect(g.validityReason).toBe("Existing support conflict");
  });

  it("leaves unrelated exercise geometry untouched", () => {
    const base = geometry(preset, defaultProfile, 50), before = structuredClone(base);
    expect(buildIsolatedJoint(preset, defaultProfile, 50, base, 100)).toBeNull();
    expect(base).toEqual(before);
  });
});
