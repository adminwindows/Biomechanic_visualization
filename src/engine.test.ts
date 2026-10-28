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

describe("pullover pose and generalized contribution", () => {
  it("matches independent finite-difference cable work for every preset and bent elbows", () => {
    const epsilon = 1e-6; // radians; do not differentiate per degree and label the result N·m
    for (const preset of presets)
      for (const angle of [75, 130, 180, 195]) {
        const setup = { ...preset, elbow: 23 };
        const current = geometry(setup, defaultProfile, angle);
        const before = geometry(setup, defaultProfile, angle - epsilon / RAD);
        const after = geometry(setup, defaultProfile, angle + epsilon / RAD);
        const generalized = current.cables.reduce(
          (sum, cable) => sum + dot(cable.force!, current.handDerivative),
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
    for (const preset of presets)
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
          expect(g.grips[side][0]).toBeCloseTo(g.barEnds[0][0], 10);
          expect(g.grips[side][2]).toBeCloseTo(g.barEnds[0][2], 10);
          expect(g.grips[side][1]).toBeGreaterThan(g.barEnds[0][1]);
          expect(g.grips[side][1]).toBeLessThan(g.barEnds[1][1]);
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
