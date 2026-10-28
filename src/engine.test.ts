import { describe, expect, it } from "vitest";
import {
  RAD,
  add,
  attachmentForce,
  axisMoment,
  cableForce,
  cross,
  defaultProfile,
  dot,
  evaluate,
  geometry,
  getDefinition,
  getTension,
  compatible,
  solveKnee,
  ANKLE_HEIGHT,
  BAR_RADIUS,
  contactAngles,
  length,
  presets,
  sampleCurve,
  scale,
  segmentBoxContact,
  sub,
  type Setup,
  type Vec3,
} from "./engine";

const classic = presets[0];
const bench = presets[1];
const closeVector = (actual: Vec3, expected: Vec3, digits = 9) =>
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], digits));
const identity: [Vec3, Vec3, Vec3] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

describe("analytical force and moment fixtures from handoff §13", () => {
  it("gives zero collinear moment and signed perpendicular moments", () => {
    expect(axisMoment([0, 0, 0], [0, 0, 0.7], [0, 0, 100], [0, 1, 0])).toBe(0);
    expect(axisMoment([0, 0, 0], [0.7, 0, 0], [0, 100, 0], [0, 0, 1])).toBe(70);
    expect(axisMoment([0, 0, 0], [0.7, 0, 0], [0, -100, 0], [0, 0, 1])).toBe(
      -70,
    );
  });

  it.each([
    [30, 35],
    [75, 67.6148078402],
    [90, 70],
  ])("computes leverage at %s°", (angle, expected) => {
    const force: Vec3 = [
      100 * Math.cos(angle * RAD),
      100 * Math.sin(angle * RAD),
      0,
    ];
    expect(axisMoment([0, 0, 0], [0.7, 0, 0], force, [0, 0, 1])).toBeCloseTo(
      expected,
      8,
    );
  });

  it("uses the actual in-plane component of an oblique force", () => {
    expect(axisMoment([0, 0, 0], [0.7, 0, 0], [0, 80, 60], [0, -1, 0])).toBe(
      42,
    );
  });

  it("sums oblique cable vectors at their actual attachments", () => {
    const forces: [Vec3, Vec3] = [
      [80, 60, 0],
      [80, -60, 0],
    ];
    closeVector(add(...forces), [160, 0, 0]);
    const attachments: [Vec3, Vec3] = [
      [0, -0.5, 0.7],
      [0, 0.5, 0.7],
    ];
    const moment = forces.reduce(
      (sum, force, i) =>
        sum + axisMoment([0, 0, 0], attachments[i], force, [0, 1, 0]),
      0,
    );
    expect(moment).toBeCloseTo(112);
  });

  it("makes the transmission factor explicit", () => {
    expect(attachmentForce(20, 0.5)).toBeCloseTo(98.1);
  });

  it("returns a singular force instead of NaN when the cable endpoints coincide", () => {
    expect(cableForce([1, 2, 3], [1, 2, 3], 100)).toBeNull();
  });

  it.each([
    [90, 44.72135955],
    [135, 0],
    [180, -44.72135955],
  ])(
    "matches the world-angle direction fixture at %s°",
    (degrees, expected) => {
      const q = degrees * RAD;
      const hand: Vec3 = [0.5 * Math.cos(q), 0, 0.5 * Math.sin(q)];
      const force = cableForce(hand, [-1, 0, 1], 100)!;
      expect(axisMoment([0, 0, 0], hand, force, [0, -1, 0])).toBeCloseTo(
        expected,
        7,
      );
    },
  );

  it("preserves reversal angle when radial length changes and shifts it with the outlet", () => {
    for (const radius of [0.2, 0.5, 0.8, 1.8]) {
      const hand: Vec3 = [
        radius * Math.cos(135 * RAD),
        0,
        radius * Math.sin(135 * RAD),
      ];
      expect(
        axisMoment(
          [0, 0, 0],
          hand,
          cableForce(hand, [-1, 0, 1], 100)!,
          [0, -1, 0],
        ),
      ).toBeCloseTo(0, 8);
      expect(
        Math.abs(
          axisMoment(
            [0, 0, 0],
            hand,
            cableForce(hand, [-2, 0, 1], 100)!,
            [0, -1, 0],
          ),
        ),
      ).toBeGreaterThan(1);
    }
  });

  it("preserves force and moment under translation and a proper rotation", () => {
    const origin: Vec3 = [0.2, 0.1, 0.3];
    const hand: Vec3 = [0.7, -0.2, 1.2];
    const outlet: Vec3 = [-0.3, 0.5, 2];
    const axis: Vec3 = [0, -1, 0];
    const translate: Vec3 = [7, -9, 4];
    const force = cableForce(hand, outlet, 100)!;
    closeVector(
      cableForce(add(hand, translate), add(outlet, translate), 100)!,
      force,
    );
    expect(
      axisMoment(add(origin, translate), add(hand, translate), force, axis),
    ).toBeCloseTo(axisMoment(origin, hand, force, axis), 9);
    const rotate = ([x, y, z]: Vec3): Vec3 => [-z, y, x];
    expect(
      axisMoment(rotate(origin), rotate(hand), rotate(force), rotate(axis)),
    ).toBeCloseTo(axisMoment(origin, hand, force, axis), 9);
    closeVector(cableForce(rotate(hand), rotate(outlet), 100)!, rotate(force));
  });
});

const presetById = (id: string): Setup => {
  const preset = presets.find((item) => item.preset === id);
  if (!preset) throw new Error(`Missing exercise preset ${id}`);
  return preset;
};

describe("independent analytical fixtures for the six exercise families", () => {
  function verticallyLoaded(setup: Setup, angle: number): Setup {
    const pose = geometry(setup, defaultProfile, angle);
    return {
      ...setup,
      planeOffset: pose.hand[0],
      outletSpacing: 2 * pose.hand[1],
      pulleyHeight: pose.hand[2] - 0.8,
      tension: 100,
    };
  }

  it("calculates an elbow curl about the elbow rather than the shoulder", () => {
    const base = { ...presetById("curl-low"), upperArmAngle: 0, tilt: 0 };
    const setup = verticallyLoaded(base, 90);
    const result = evaluate(setup, defaultProfile, 90);
    expect(result.status).toBe("resists");
    expect(result.moment).toBeCloseTo(100 * (defaultProfile.forearm + defaultProfile.hand), 9);
    closeVector(result.geometry.jointOrigin!, result.geometry.elbow);
    const lower = geometry(setup, defaultProfile, 20);
    const upper = geometry(setup, defaultProfile, 120);
    closeVector(lower.elbow, upper.elbow);
    expect(lower.hand).not.toEqual(upper.hand);
  });

  it("changes shoulder posture in a Bayesian curl while keeping an elbow-only motion", () => {
    const low = geometry(presetById("curl-low"), defaultProfile, 80);
    const bayesian = geometry(presetById("curl-bayesian"), defaultProfile, 80);
    const armA = sub(low.elbow, low.shoulders[1]);
    const armB = sub(bayesian.elbow, bayesian.shoulders[1]);
    expect(armA[0]).toBeCloseTo(0, 9);
    expect(armB[0]).toBeLessThan(0);
    expect(length(armA)).toBeCloseTo(length(armB), 9);
    const extended = geometry(presetById("curl-bayesian"), defaultProfile, 10);
    closeVector(extended.elbow, bayesian.elbow);
  });

  it("distinguishes gravity assisting upright extension from resisting overhead extension", () => {
    const upright = verticallyLoaded({ ...presetById("extension-pushdown"), facing: 1, upperArmAngle: 0, tilt: 0 }, 90);
    const overhead = verticallyLoaded({ ...presetById("extension-overhead"), upperArmAngle: 180, tilt: 0 }, 90);
    const magnitude = 100 * (defaultProfile.forearm + defaultProfile.hand);
    expect(evaluate(upright, defaultProfile, 90)).toMatchObject({ status: "assists" });
    expect(evaluate(upright, defaultProfile, 90).moment).toBeCloseTo(-magnitude, 9);
    expect(evaluate(overhead, defaultProfile, 90)).toMatchObject({ status: "resists" });
    expect(evaluate(overhead, defaultProfile, 90).moment).toBeCloseTo(magnitude, 9);
  });

  it.each([0, 30, 90, 120])("matches unilateral dumbbell leverage at %s° without doubling it", (angle) => {
    const setup: Setup = { ...presetById("raise-dumbbell"), tilt: 0, elbow: 0, loadMass: 5 };
    const result = evaluate(setup, defaultProfile, angle);
    const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
    expect(result.moment).toBeCloseTo(5 * 9.81 * reach * Math.sin(angle * RAD), 9);
    expect(result.cableMoment).toBe(0);
    expect(result.geometry.cables).toHaveLength(0);
    expect(result.geometry.loads?.filter((load) => load.kind === "gravity")).toHaveLength(1);
  });

  it("rotates the gravity lever with prescribed frontal torso lean", () => {
    const setup: Setup = { ...presetById("raise-dumbbell"), tilt: 25, elbow: 0, loadMass: 5 };
    const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
    expect(evaluate(setup, defaultProfile, 70).moment).toBeCloseTo(5 * 9.81 * reach * Math.sin(45 * RAD), 9);
  });

  it("uses a lateral-raise axis consistent with its hand derivative and segment gravity", () => {
    const setup: Setup = {
      ...presetById("raise-dumbbell"), tilt: 0, elbow: 0, loadMass: 0,
      segmentGravity: true, upperArmMass: 3, forearmMass: 2,
    };
    const result = evaluate(setup, defaultProfile, 90);
    const g = result.geometry;
    closeVector(cross(g.jointAxis!, sub(g.hand, g.jointOrigin!)), g.handDerivative);
    const distalReach = defaultProfile.forearm + defaultProfile.hand;
    const expected = 9.81 * (3 * defaultProfile.upperArm / 2 + 2 * (defaultProfile.upperArm + distalReach / 2));
    expect(result.gravityMoment).toBeCloseTo(expected, 9);
    expect(result.moment).toBeCloseTo(expected, 9);
    expect(result.status).toBe("resists");
  });

  it("keeps front/back cable placement distinct from the frontal arm path", () => {
    const base = presetById("raise-cable");
    const front = geometry({ ...base, planeOffset: base.hipX + 0.4 }, defaultProfile, 60);
    const behind = geometry({ ...base, planeOffset: base.hipX - 0.4 }, defaultProfile, 60);
    closeVector(front.hand, behind.hand);
    expect(front.cables).toHaveLength(1);
    expect(front.cables[0].force![0]).toBeGreaterThan(0);
    expect(behind.cables[0].force![0]).toBeLessThan(0);
  });

  it("sums two independent fly handles using mirrored derivatives", () => {
    const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
    const setup: Setup = {
      ...presetById("fly-cable"), elbow: 0, tilt: 0, tension: 100,
      planeOffset: -0.25, outletSpacing: defaultProfile.shoulderWidth + 2 * reach,
      pulleyHeight: 0.90 + defaultProfile.torso,
    };
    const result = evaluate(setup, defaultProfile, 0);
    expect(result.moment).toBeCloseTo(2 * 100 * reach, 9);
    expect(result.geometry.cables).toHaveLength(2);
    expect(result.geometry.hasBar).toBe(false);
    const epsilon = 1e-6;
    const current = geometry(setup, defaultProfile, 45);
    const before = geometry(setup, defaultProfile, 45 - epsilon / RAD);
    const after = geometry(setup, defaultProfile, 45 + epsilon / RAD);
    for (let side = 0; side < 2; side++) {
      const independentlyDifferentiated = scale(sub(after.cables[side].attachment, before.cables[side].attachment), 1 / (2 * epsilon));
      closeVector(current.cables[side].derivative!, independentlyDifferentiated, 7);
    }
    expect(current.cables[0].derivative![1]).toBeGreaterThan(0);
    expect(current.cables[1].derivative![1]).toBeLessThan(0);
    expect(current.cables[0].derivative![0]).toBeCloseTo(current.cables[1].derivative![0], 9);
  });

  it("loads the ankle in hip extension and preserves a valid grounded stance", () => {
    const base = presetById("hip-extension");
    const pose = geometry(base, defaultProfile, 0);
    const setup: Setup = { ...base, pulleyHeight: pose.hand[2], planeOffset: pose.hand[0] - 1, tension: 100 };
    const result = evaluate(setup, defaultProfile, 0);
    expect(result.status).toBe("resists");
    expect(result.geometry.supportValid).toBe(true);
    expect(result.moment).toBeCloseTo(100 * (defaultProfile.thigh! + defaultProfile.shank!), 9);
    const loadedShank = result.geometry.limbs!.find((limb) => limb.kind === "shank" && limb.to[1] > 0)!;
    closeVector(result.geometry.cables[0].attachment, loadedShank.to);
    expect(result.geometry.supportPoints).toHaveLength(1);
  });

  it("keeps curve coordinates and force conventions compatible only where defined", () => {
    expect(compatible(presetById("raise-cable"), presetById("raise-dumbbell"))).toBe(true);
    expect(compatible(classic, presetById("curl-low"))).toBe(false);
    expect(compatible(presetById("curl-low"), presetById("extension-pushdown"))).toBe(false);
    expect(compatible(presetById("machine-unknown"), presetById("machine-unknown"))).toBe(false);
    const requiredFamilies = ["pullover", "curl", "extension", "raise", "fly", "hip"];
    expect([...new Set(presets.map((preset) => getDefinition(preset).id))]).toEqual(expect.arrayContaining(requiredFamilies));
  });
});

describe("support constraints and independent load states", () => {
  it.each([
    "classic", "outside", "inside", "bench", "curl-low", "curl-bayesian",
    "extension-pushdown", "extension-overhead", "raise-cable", "raise-dumbbell",
    "fly-cable", "hip-extension",
  ])("provides a usable numerical starting pose for release scenario %s", (id) => {
    const setup = presetById(id);
    const result = evaluate(setup, defaultProfile, (setup.range[0] + setup.range[1]) / 2);
    expect(["resists", "assists", "near-zero"]).toContain(result.status);
    expect(Number.isFinite(result.moment)).toBe(true);
    expect(result.geometry.supportValid).toBe(true);
    expect(result.metricLabel).toBeTruthy();
    expect(result.referenceAction).toBe(getDefinition(setup).action);
  });

  it("solves a wider rigid-bar grip while preserving lengths and the true elbow bend", () => {
    const setup: Setup = { ...classic, elbow: 40, gripWidth: 0.64 };
    const distalLength = defaultProfile.forearm + defaultProfile.hand;
    for (const angle of [40, 130, 185]) {
      const g = geometry(setup, defaultProfile, angle);
      expect(g.gripCompatible).toBe(true);
      expect(g.grips[1][1] - g.grips[0][1]).toBeCloseTo(setup.gripWidth!, 9);
      for (let side = 0; side < 2; side++) {
        const upper = sub(g.elbows[side], g.shoulders[side]);
        const distal = sub(g.grips[side], g.elbows[side]);
        expect(length(upper)).toBeCloseTo(defaultProfile.upperArm, 9);
        expect(length(distal)).toBeCloseTo(distalLength, 9);
        expect(dot(upper, distal) / (length(upper) * length(distal))).toBeCloseTo(Math.cos(setup.elbow * RAD), 9);
        expect(g.grips[side][0]).toBeCloseTo(g.barEnds[0][0], 9);
        expect(g.grips[side][2]).toBeCloseTo(g.barEnds[0][2], 9);
      }
    }
    const epsilon = 1e-6;
    const current = geometry(setup, defaultProfile, 130);
    const before = geometry(setup, defaultProfile, 130 - epsilon / RAD);
    const after = geometry(setup, defaultProfile, 130 + epsilon / RAD);
    const cableWork = current.cables.reduce((sum, cable) => sum + dot(cable.force!, cable.derivative ?? current.handDerivative), 0);
    const independent = current.cables.reduce((sum, _cable, i) => sum - setup.tension * (after.cables[i].length - before.cables[i].length) / (2 * epsilon), 0);
    expect(cableWork).toBeCloseTo(independent, 5);
  });

  it("rejects a wider grip with locked straight elbows instead of stretching the arms", () => {
    const result = evaluate({ ...classic, elbow: 0, gripWidth: 0.64 }, defaultProfile, 170);
    expect(result).toMatchObject({ status: "invalid", moment: null });
    expect(result.geometry.gripCompatible).toBe(false);
    expect(result.validityReason).toMatch(/grip|Grip/);
    for (let side = 0; side < 2; side++) {
      expect(length(sub(result.geometry.elbows[side], result.geometry.shoulders[side]))).toBeCloseTo(defaultProfile.upperArm, 9);
      expect(length(sub(result.geometry.grips[side], result.geometry.elbows[side]))).toBeCloseTo(defaultProfile.forearm + defaultProfile.hand, 9);
    }
  });

  it("solves two-link support without stretching either measured segment", () => {
    const hip: Vec3 = [0, 0, 0.8];
    const ankle: Vec3 = [0.06, 0, ANKLE_HEIGHT];
    const knee = solveKnee(hip, ankle, 0.43, 0.41, 1)!;
    expect(knee).not.toBeNull();
    expect(length(sub(knee, hip))).toBeCloseTo(0.43, 9);
    expect(length(sub(ankle, knee))).toBeCloseTo(0.41, 9);
    expect(solveKnee([0, 0, 1.2], ankle, 0.43, 0.41, 1)).toBeNull();
    expect(solveKnee([0, 0, 0.08], [0, 0, 0.06], 0.5, 0.2, 1)).toBeNull();
  });

  it.each(["classic", "bench", "classic-kneeling", "hip-extension"])("preserves leg dimensions and support in the %s preset", (id) => {
    const setup = presetById(id);
    const g = geometry(setup, defaultProfile, (setup.range[0] + setup.range[1]) / 2);
    expect(g.supportValid).toBe(true);
    const legs = g.limbs!.filter((limb) => limb.kind === "thigh" || limb.kind === "shank");
    expect(legs).toHaveLength(4);
    for (const limb of legs) expect(length(sub(limb.to, limb.from))).toBeCloseTo(limb.kind === "thigh" ? defaultProfile.thigh! : defaultProfile.shank!, 9);
    for (const support of g.supportPoints!) expect(support[2]).toBeCloseTo(ANKLE_HEIGHT, 9);
  });

  it("reports conflicting pelvis/leg dimensions instead of moving equipment or stretching limbs", () => {
    const setup = presetById("curl-low");
    const result = evaluate({ ...setup, hipHeight: 1.4 }, defaultProfile, 70);
    expect(result).toMatchObject({ status: "invalid", moment: null, cableMoment: null, gravityMoment: null });
    expect(result.geometry.hip[2]).toBe(1.4);
    for (const limb of result.geometry.limbs!.filter((limb) => limb.kind === "thigh" || limb.kind === "shank")) {
      expect(length(sub(limb.to, limb.from))).toBeCloseTo(limb.kind === "thigh" ? defaultProfile.thigh! : defaultProfile.shank!, 9);
    }
    expect(result.validityReason).toMatch(/incompatible/);
  });

  it("adds cable and explicitly modeled gravity contributions", () => {
    const base = { ...presetById("curl-low"), upperArmAngle: 0 };
    const combined = evaluate({ ...base, segmentGravity: true, upperArmMass: 2, forearmMass: 1.5 }, defaultProfile, 90);
    const cableOnly = evaluate(base, defaultProfile, 90);
    const gravityOnly = evaluate({ ...base, tension: 0, segmentGravity: true, upperArmMass: 2, forearmMass: 1.5 }, defaultProfile, 90);
    const expectedGravity = 1.5 * 9.81 * (defaultProfile.forearm + defaultProfile.hand) / 2;
    expect(combined.gravityMoment).toBeCloseTo(expectedGravity, 9);
    expect(gravityOnly.status).toBe("resists");
    expect(gravityOnly.cableMoment).toBe(0);
    expect(combined.moment).toBeCloseTo(cableOnly.moment! + gravityOnly.moment!, 9);
    expect(combined.moment).toBeCloseTo(combined.cableMoment! + combined.gravityMoment!, 9);
  });

  it("keeps known gravity visible when cable force is unknown", () => {
    const setup: Setup = { ...presetById("curl-low"), forceKnown: false, segmentGravity: true, upperArmMass: 2, forearmMass: 1.5 };
    const result = evaluate(setup, defaultProfile, 90);
    expect(result).toMatchObject({ status: "unknown", moment: null, cableMoment: null });
    expect(result.gravityMoment).toBeGreaterThan(0);
    expect(result.outputLevel).toBe("geometry");
  });

  it("distinguishes explicitly slack, known zero force and unknown tension", () => {
    const setup = presetById("curl-low");
    expect(evaluate({ ...setup, slack: true }, defaultProfile, 80)).toMatchObject({ status: "slack", moment: 0, cableMoment: 0 });
    expect(evaluate({ ...setup, tension: 0 }, defaultProfile, 80)).toMatchObject({ status: "no-force", moment: 0, cableMoment: 0 });
    expect(evaluate({ ...setup, forceKnown: false }, defaultProfile, 80)).toMatchObject({ status: "unknown", moment: null, cableMoment: null });
    expect(evaluate({ ...setup, slack: true, segmentGravity: true, upperArmMass: 2, forearmMass: 1.5 }, defaultProfile, 90)).toMatchObject({ status: "resists", cableMoment: 0 });
  });

  it("does not invent an unknown machine profile or missing load masses", () => {
    expect(evaluate(presetById("machine-unknown"), defaultProfile, 120)).toMatchObject({ status: "unknown", moment: null, cableMoment: null, outputLevel: "geometry" });
    expect(evaluate({ ...presetById("raise-dumbbell"), loadMass: undefined }, defaultProfile, 70)).toMatchObject({ status: "unknown", moment: null, gravityMoment: null });
    expect(evaluate({ ...presetById("curl-low"), segmentGravity: true }, defaultProfile, 70)).toMatchObject({ status: "unknown", moment: null, gravityMoment: null });
  });

  it("converts a declared mass/transmission once, and keeps missing ratios unknown", () => {
    const setup: Setup = { ...presetById("curl-low"), loadMode: "mass", loadMass: 20, transmissionFactor: 0.5 };
    expect(getTension(setup)).toBeCloseTo(98.1, 9);
    const fromMass = evaluate(setup, defaultProfile, 80);
    const fromForce = evaluate({ ...setup, loadMode: "force", tension: 98.1 }, defaultProfile, 80);
    expect(fromMass.moment).toBeCloseTo(fromForce.moment!, 9);
    expect(evaluate({ ...setup, transmissionFactor: undefined }, defaultProfile, 80)).toMatchObject({ status: "unknown", moment: null });
  });
});

describe("pullover pose and generalized contribution", () => {
  it("matches independent finite-difference cable work for every preset and bent elbows", () => {
    const epsilon = 1e-6; // radians; do not differentiate per degree and label the result N·m
    for (const preset of presets)
      for (const angle of [75, 130, 180, 195]) {
        const setup = { ...preset, elbow: 23 };
        const current = geometry(setup, defaultProfile, angle);
        const before = geometry(setup, defaultProfile, angle - epsilon / (getDefinition(setup).coordinateScale??RAD));
        const after = geometry(setup, defaultProfile, angle + epsilon / (getDefinition(setup).coordinateScale??RAD));
        const generalized = current.cables.reduce(
          (sum, cable) => sum + dot(cable.force!, cable.derivative ?? current.handDerivative),
          0,
        );
        const workDerivative = current.cables.reduce(
          (sum, _cable, i) =>
            sum -
            (setup.tension *
              (after.cables[i].length - before.cables[i].length)) /
              (2 * epsilon),
          0,
        );
        expect(generalized).toBeCloseTo(workDerivative, 5);
      }
  });

  it("uses the same axis for the derivative and the signed total moment", () => {
    const g = geometry({ ...bench, elbow: 25 }, defaultProfile, 170);
    closeVector(g.handDerivative, cross(g.axis, sub(g.hand, g.shoulder)));
    const sum = g.cables.reduce(
      (total, cable) =>
        total + axisMoment(g.shoulder, cable.attachment, cable.force!, g.axis),
      0,
    );
    expect(sum).toBeCloseTo(
      g.cables.reduce(
        (total, cable) => total + dot(cable.force!, g.handDerivative),
        0,
      ),
      9,
    );
  });

  it("doubles force effects without moving geometry", () => {
    const a = evaluate(classic, defaultProfile, 160);
    const b = evaluate(
      { ...classic, tension: classic.tension * 2 },
      defaultProfile,
      160,
    );
    expect(b.moment).toBeCloseTo(a.moment! * 2, 9);
    expect(b.geometry.hand).toEqual(a.geometry.hand);
  });

  it("preserves rigid arm segments and grip closure under all presets", () => {
    for (const preset of presets.filter(p=>!['wrist-flexion','wrist-extension','forearm-rotation'].includes(p.model??'')))
      for (const q of [0, 130, 180, 200]) {
        const g = geometry({ ...preset, elbow: 30 }, defaultProfile, q);
        for (let side = 0; side < 2; side++) {
          expect(length(sub(g.elbows[side], g.shoulders[side]))).toBeCloseTo(
            defaultProfile.upperArm,
            10,
          );
          expect(length(sub(g.grips[side], g.elbows[side]))).toBeCloseTo(
            defaultProfile.forearm + defaultProfile.hand,
            10,
          );
          if (g.hasBar) {
            expect(g.grips[side][0]).toBeCloseTo(g.barEnds[0][0], 10);
            expect(g.grips[side][2]).toBeCloseTo(g.barEnds[0][2], 10);
            expect(g.grips[side][1]).toBeGreaterThan(g.barEnds[0][1]);
            expect(g.grips[side][1]).toBeLessThan(g.barEnds[1][1]);
          }
        }
      }
  });

  it("changes hand placement with elbow flexion without changing the upper-arm angle", () => {
    const straight = geometry(classic, defaultProfile, 170);
    const bent = geometry({ ...classic, elbow: 30 }, defaultProfile, 170);
    expect(bent.elbow).toEqual(straight.elbow);
    expect(bent.hand).not.toEqual(straight.hand);
  });

  it("continues past 180° instead of folding back through acos", () => {
    const setup = { ...classic, facing: 1 as const, tilt: 0 };
    const earlier = geometry(setup, defaultProfile, 160);
    const later = geometry(setup, defaultProfile, 200);
    expect(earlier.hand[0]).toBeGreaterThan(earlier.shoulder[0]);
    expect(later.hand[0]).toBeLessThan(later.shoulder[0]);
    expect(
      length(
        sub(
          geometry(setup, defaultProfile, 180.001).hand,
          geometry(setup, defaultProfile, 179.999).hand,
        ),
      ),
    ).toBeLessThan(0.0001);
  });

  it("keeps hips, bench, and pulleys fixed when body dimensions change", () => {
    const a = geometry(bench, defaultProfile, 170);
    const b = geometry(
      bench,
      { ...defaultProfile, torso: 0.7, upperArm: 0.4 },
      170,
    );
    expect(b.hip).toEqual(a.hip);
    expect(b.backBase).toEqual(a.backBase);
    expect(b.backTop).toEqual(a.backTop);
    expect(b.cables.map((cable) => cable.outlet)).toEqual(
      a.cables.map((cable) => cable.outlet),
    );
    expect(b.shoulder).not.toEqual(a.shoulder);
    expect(b.hand).not.toEqual(a.hand);
  });

  it("has horizontal torso and flat/upright bench limits", () => {
    expect(
      geometry(classic, defaultProfile, 180).torsoDirection[2],
    ).toBeCloseTo(0, 10);
    closeVector(
      geometry({ ...bench, tilt: 0 }, defaultProfile, 180).torsoDirection,
      [-1, 0, 0],
    );
    closeVector(
      geometry({ ...bench, tilt: 90 }, defaultProfile, 180).torsoDirection,
      [0, 0, 1],
    );
  });

  it("allows shoulders behind the outlet plane while the hands are in front", () => {
    const g = geometry(
      presets.find((p) => p.preset === "inside")!,
      defaultProfile,
      180,
    );
    expect(g.shoulder[0]).toBeLessThan(0);
    expect(g.hand[0]).toBeGreaterThan(0);
  });

  it("distinguishes resists, assists, near-zero, zero force, singular, and impossible geometry", () => {
    expect(evaluate(classic, defaultProfile, 180).status).toBe("resists");
    expect(
      evaluate(
        presets.find((p) => p.preset === "inside-upright")!,
        defaultProfile,
        180,
      ).status,
    ).toBe("assists");
    const collinear: Setup = {
      ...classic,
      facing: 1,
      tilt: 0,
      hipX: 0,
      pulleyHeight: 2.8,
    };
    expect(evaluate(collinear, defaultProfile, 180).status).toBe("near-zero");
    expect(
      evaluate({ ...classic, tension: 0 }, defaultProfile, 180),
    ).toMatchObject({ status: "no-force", moment: 0 });
    const singular = {
      ...collinear,
      pulleyHeight:
        collinear.hipHeight +
        defaultProfile.torso +
        defaultProfile.upperArm +
        defaultProfile.forearm +
        defaultProfile.hand,
    };
    expect(evaluate(singular, defaultProfile, 180)).toMatchObject({
      status: "singular",
      moment: null,
    });
    expect(
      evaluate({ ...classic, hipHeight: 0.1 }, defaultProfile, 90),
    ).toMatchObject({ status: "invalid", moment: null });
  });

  it("preserves symmetric contribution when the complete setup faces the other way", () => {
    const original = presets.find((p) => p.preset === "outside")!;
    const mirrored: Setup = { ...original, hipX: -original.hipX, facing: -1 };
    const a = evaluate(original, defaultProfile, 160);
    const b = evaluate(mirrored, defaultProfile, 160);
    expect(a.moment).toBeCloseTo(b.moment!, 9);
    expect(a.geometry.hand[0]).toBeCloseTo(-b.geometry.hand[0], 9);
    expect(a.geometry.axis[1]).toBe(-b.geometry.axis[1]);
  });

  it("rejects nonfinite or physically undefined numeric inputs", () => {
    expect(() =>
      evaluate({ ...classic, tension: NaN }, defaultProfile, 180),
    ).toThrow(RangeError);
    expect(() =>
      geometry(classic, { ...defaultProfile, upperArm: -1 }, 180),
    ).toThrow(RangeError);
    expect(() => cableForce([0, 0, 0], [1, 0, 0], -100)).toThrow(RangeError);
  });
});

describe("spatial backrest contact and curve agreement", () => {
  it("finds a 0.075° bar-contact interval that an entire 0.5° grid misses", () => {
    // Synthetic grazing fixture: at 196.1° the bar enters below the inflated
    // backrest top; at 196.17496° it leaves behind its rear depth boundary.
    const entry = 196.1;
    const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
    const setup: Setup = {
      ...bench, tilt: 90, hipX: 1, hipHeight: 0.46,
      backLength: defaultProfile.torso - reach * Math.cos(entry * RAD) - BAR_RADIUS,
      range: [195.5, 197],
    };
    const depthFromShoulder = 0.08 + setup.backThickness + BAR_RADIUS;
    const exit = 180 + Math.asin(depthFromShoulder / reach) / RAD;
    expect(exit - entry).toBeLessThan(0.08);
    for (const angle of [195.5, 196, 196.5, 197]) {
      expect(evaluate(setup, defaultProfile, angle).status).toBe("resists");
    }
    expect(evaluate(setup, defaultProfile, (entry + exit) / 2)).toMatchObject({
      status: "contact", moment: null, contactKind: "bar–backrest",
    });
    const candidates = contactAngles(setup, defaultProfile);
    expect(candidates.some((angle) => Math.abs(angle - entry) < 1e-7)).toBe(true);
    expect(candidates.some((angle) => Math.abs(angle - exit) < 1e-7)).toBe(true);
    const curve = sampleCurve(setup, defaultProfile);
    const contacts = curve.filter((point) => point.status === "contact");
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    expect(contacts[0].angle).toBeCloseTo(entry, 7);
    expect(contacts.at(-1)!.angle).toBeCloseTo(exit, 7);
    for (const point of curve) {
      const evaluated = evaluate(setup, defaultProfile, point.angle);
      expect(point.status).toBe(evaluated.status);
      expect(point.moment).toBe(evaluated.moment);
    }
  });

  it("retains an isolated corner tangency without inventing an interval-wide collision", () => {
    const reach = defaultProfile.upperArm + defaultProfile.forearm + defaultProfile.hand;
    const angle = 180 + Math.asin((0.08 + bench.backThickness + BAR_RADIUS) / reach) / RAD;
    const setup: Setup = {
      ...bench, tilt: 90, hipX: 1,
      backLength: defaultProfile.torso - reach * Math.cos(angle * RAD) - BAR_RADIUS,
      range: [195.5, 197],
    };
    expect(evaluate(setup, defaultProfile, angle).status).toBe("contact");
    expect(evaluate(setup, defaultProfile, angle - 0.001).status).not.toBe("contact");
    expect(evaluate(setup, defaultProfile, angle + 0.001).status).not.toBe("contact");
    const contacts = sampleCurve(setup, defaultProfile).filter((point) => point.status === "contact");
    expect(contacts.length).toBeGreaterThan(0);
    for (const point of contacts) expect(point.angle).toBeCloseTo(angle, 6);
  });

  it("distinguishes a projected crossing from real contact with a wider backrest", () => {
    const setup: Setup = { ...bench, tilt: 90, hipX: 1, pulleyHeight: 0.5 };
    const narrow = evaluate(setup, defaultProfile, 140);
    const wide = evaluate({ ...setup, backWidth: 1.5 }, defaultProfile, 140);
    expect(narrow.status).not.toBe("contact");
    expect(wide).toMatchObject({
      status: "contact",
      contactKind: "cable–backrest",
      moment: null,
    });
    expect(wide.contact).not.toBeNull();
  });

  it("handles tangential, parallel, thickness-boundary and edge contact", () => {
    const hit = (a: Vec3, b: Vec3) =>
      segmentBoxContact(
        a,
        b,
        [0, 0, 0],
        identity,
        [-1, -1, -0.05],
        [1, 1, 0.05],
      );
    expect(hit([-2, 1, 0.05], [2, 1, 0.05])).not.toBeNull();
    expect(hit([-2, 1.001, 0.05], [2, 1.001, 0.05])).toBeNull();
    expect(hit([0, 0, -1], [0, 0, 1])).not.toBeNull();
    expect(hit([2, 0, -1], [2, 0, 1])).toBeNull();
    expect(hit([0, 0, 0], [0, 0, 0])).not.toBeNull();
  });

  it("keeps collision tests equivalent when box and segment are translated and rotated", () => {
    const shift: Vec3 = [2, 3, 4];
    const rotate = ([x, y, z]: Vec3): Vec3 => [z, y, -x];
    const start: Vec3 = [-2, 0, 0];
    const end: Vec3 = [2, 0, 0];
    const minimum: Vec3 = [-1, -0.5, -0.2];
    const maximum: Vec3 = [1, 0.5, 0.2];
    const initial = segmentBoxContact(
      start,
      end,
      [0, 0, 0],
      identity,
      minimum,
      maximum,
    )!;
    const moved = segmentBoxContact(
      add(rotate(start), shift),
      add(rotate(end), shift),
      shift,
      identity.map(rotate) as [Vec3, Vec3, Vec3],
      minimum,
      maximum,
    )!;
    closeVector(moved, add(rotate(initial), shift));
  });

  it("samples the same engine as the current position and preserves invalid gaps", () => {
    const setup: Setup = {
      ...bench,
      tilt: 90,
      hipX: 1,
      pulleyHeight: 0.5,
      backWidth: 1.5,
    };
    const curve = sampleCurve(setup, defaultProfile);
    expect(curve[0].angle).toBe(setup.range[0]);
    expect(curve.at(-1)!.angle).toBe(setup.range[1]);
    expect(
      curve.some(
        (point) => point.status === "contact" && point.moment === null,
      ),
    ).toBe(true);
    for (const point of curve) {
      const current = evaluate(setup, defaultProfile, point.angle);
      expect(point.moment).toBe(current.moment);
      expect(point.status).toBe(current.status);
    }
    const transition = curve.findIndex(
      (point, i) =>
        i > 0 && (point.moment === null) !== (curve[i - 1].moment === null),
    );
    expect(transition).toBeGreaterThan(0);
    expect(curve[transition].angle - curve[transition - 1].angle).toBeLessThan(
      0.02,
    );
  });
});

describe('explicit leg gravity and equipment constraints', () => {
  it('calculates moving hip segments from supplied masses and midpoint centres', () => {
    const preset=presets.find(item=>item.preset==='hip-extension')!;
    const q=30;
    const result=evaluate({...preset,tension:0,segmentGravity:true,thighMass:6,shankMass:3},defaultProfile,q);
    const expected=9.81*Math.sin(q*RAD)*(6*defaultProfile.thigh!/2+3*(defaultProfile.thigh!+defaultProfile.shank!/2));
    expect(result.status).toBe('resists');
    expect(result.cableMoment).toBe(0);
    expect(result.gravityMoment).toBeCloseTo(expected,9);
    expect(result.moment).toBeCloseTo(expected,9);
  });

  it('adds cable and moving-leg gravity without inferring missing masses', () => {
    const preset=presets.find(item=>item.preset==='hip-extension')!;
    const result=evaluate({...preset,segmentGravity:true,thighMass:6,shankMass:3},defaultProfile,35);
    expect(result.moment).toBeCloseTo(result.cableMoment!+result.gravityMoment!,9);
    const missing=evaluate({...preset,segmentGravity:true,thighMass:6},defaultProfile,35);
    expect(missing.status).toBe('unknown');
    expect(missing.moment).toBeNull();
    expect(missing.cableMoment).not.toBeNull();
  });

  it('keeps physical bar length fixed when body width changes', () => {
    const setup={...presets[0],elbow:30};
    const before=geometry(setup,defaultProfile,150);
    const after=geometry(setup,{...defaultProfile,shoulderWidth:0.55},150);
    expect(length(sub(after.barEnds[1],after.barEnds[0]))).toBeCloseTo(length(sub(before.barEnds[1],before.barEnds[0])),10);
    const invalid=evaluate({...setup,barLength:0.35},defaultProfile,150);
    expect(invalid.status).toBe('invalid');
    expect(invalid.moment).toBeNull();
  });

  it('does not assert a straight-line route for a slack cable', () => {
    const setup:Setup={...presets[1],tilt:90,hipX:1,pulleyHeight:0.5,backWidth:1.5};
    expect(evaluate(setup,defaultProfile,140).status).toBe('contact');
    const slack=evaluate({...setup,slack:true,forceKnown:false},defaultProfile,140);
    expect(slack.status).toBe('slack');
    expect(slack.moment).toBe(0);
  });

  it('rejects a cable-count setting that the named family cannot represent', () => {
    for(const id of ['raise-cable','hip-extension']) {
      const preset=presets.find(item=>item.preset===id)!;
      expect(evaluate({...preset,cables:2},defaultProfile,30).status).toBe('invalid');
    }
    const fly=presets.find(item=>item.preset==='fly-cable')!;
    expect(evaluate({...fly,cables:1},defaultProfile,30).status).toBe('invalid');
  });
});

describe('expanded selectable isolated catalog',()=>{
  it.each(presets.filter(p=>p.model!=='machine').map(p=>[p.preset,p] as const))('has a valid computable representative pose for %s',(_id,setup)=>{
    const q=(setup.range[0]+setup.range[1])/2;
    const result=evaluate(setup,defaultProfile,q);
    expect(result.moment,`${setup.name}: ${result.status} ${result.validityReason??''}`).not.toBeNull();
    expect(Number.isFinite(result.moment)).toBe(true);
  });
});

describe('expanded physical conventions and represented apparatus',()=>{
  const find=(id:string)=>presets.find(p=>p.preset===id)!;
  it('counts a shared bar mass once and two dumbbells separately',()=>{
    const bar=find('shrug-barbell');
    expect(evaluate(bar,defaultProfile,4).moment).toBeCloseTo(30*9.81,9);
    expect(evaluate({...bar,freeWeightKind:'dumbbell'},defaultProfile,4).moment).toBeCloseTo(60*9.81,9);
    expect(evaluate({...find('pullover-barbell'),loadMass:20},defaultProfile,120).moment).toBeCloseTo(evaluate({...find('pullover-barbell'),loadMass:10,freeWeightKind:'dumbbell'},defaultProfile,120).moment!,9);
  });
  it('changes the actual fly trajectory when choosing low-to-high or high-to-low planes',()=>{
    const low=geometry(find('fly-low-high'),defaultProfile,70),high=geometry(find('fly-high-low'),defaultProfile,70);
    expect(low.hand[2]).toBeGreaterThan(low.shoulder[2]);
    expect(high.hand[2]).toBeLessThan(high.shoulder[2]);
    expect(compatible(find('fly-low-high'),find('fly-high-low'))).toBe(false);
  });
  it('preserves arm lengths and orthogonal equipment axes in rolled poses',()=>{
    for(const id of ['raise-side-lying','curl-dumbbell','fly-dumbbell-flat']) {
      const setup:Setup={...find(id),posture:'side-lying',kind:'bench',hipHeight:.8,bodyRoll:-70};
      const g=geometry(setup,defaultProfile,45);
      for(let side=0;side<2;side++) {
        expect(length(sub(g.elbows[side],g.shoulders[side]))).toBeCloseTo(defaultProfile.upperArm,10);
        expect(length(sub(g.grips[side],g.elbows[side]))).toBeCloseTo(defaultProfile.forearm+defaultProfile.hand,10);
      }
      for(const axis of g.backrestAxes!)expect(length(axis)).toBeCloseTo(1,10);
      expect(dot(g.backrestAxes![0],g.backrestAxes![2])).toBeCloseTo(0,10);
    }
  });
  it('moves the actual leg in supported hip extension and side-lying abduction',()=>{
    for(const id of ['hip-extension','hip-abduction']) {
      const setup:Setup={...find(id),posture:id==='hip-extension'?'supine':'side-lying',kind:'bench',hipHeight:.9,bodyRoll:-90,tilt:0,resistance:'dumbbell',loadMass:2};
      const g=geometry(setup,defaultProfile,30),next=geometry(setup,defaultProfile,31);
      expect(g.limbs?.filter(l=>l.kind==='thigh')).toHaveLength(2);
      expect(g.limbs?.filter(l=>l.kind==='shank')).toHaveLength(2);
      expect(length(sub(next.hand,g.hand))).toBeGreaterThan(.01);
      expect(length(sub(g.elbow,g.jointOrigin!))).toBeCloseTo(defaultProfile.thigh!,10);
      expect(length(sub(g.hand,g.elbow))).toBeCloseTo(defaultProfile.shank!,10);
    }
  });
  it('keeps asymmetric outlets fixed when shifting the body laterally',()=>{
    const setup:Setup={...classic,cables:2,outletPositions:[[0,-.3,2.1],[.2,.7,1.9]]};
    const a=geometry(setup,defaultProfile,140),b=geometry({...setup,hipY:.4},defaultProfile,140);
    expect(b.cables.map(c=>c.outlet)).toEqual(a.cables.map(c=>c.outlet));
    closeVector(sub(b.cables[0].attachment,a.cables[0].attachment),[0,.4,0]);
  });
  it('enforces declared apparatus limits unless exploration is explicitly enabled',()=>{
    const setup:Setup={...classic,equipmentLimits:{pulleyMin:.1,pulleyMax:1,distanceMin:-1,distanceMax:2}};
    expect(evaluate(setup,defaultProfile,150).validityReason).toContain('apparatus adjustment limits');
    expect(evaluate({...setup,exploration:true},defaultProfile,150).moment).not.toBeNull();
  });
  it('invalidates direct mechanics on a represented frame contact',()=>{
    const q=150,g=geometry(classic,defaultProfile,q),cable=g.cables[0];
    const center=scale(add(cable.attachment,cable.outlet),.5);
    const setup:Setup={...classic,obstacles:[{id:'frame',name:'Measured frame rail',type:'box',center,size:[.08,.08,.08]}]};
    const result=evaluate(setup,defaultProfile,q);
    expect(result.status).toBe('contact');expect(result.moment).toBeNull();
    expect(result.contactKind).toBe('cable–obstacle');expect(result.validityReason).toContain('Measured frame rail');
    expect(result.contact).not.toBeNull();
  });
});
