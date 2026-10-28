/** Pure quasi-static, symmetric pullover model. Distances: m; forces: N. */
export type Vec3 = [number, number, number];
export type Profile = {
  height: number;
  upperArm: number;
  forearm: number;
  hand: number;
  torso: number;
  shoulderWidth: number;
};
export type Setup = {
  preset: string;
  name: string;
  kind: "standing" | "bench";
  facing: 1 | -1;
  /** Standing: inclination from vertical. Bench: backrest angle above floor. */
  tilt: number;
  hipX: number;
  hipHeight: number;
  pulleyHeight: number;
  outletSpacing: number;
  attachmentSpacing: number;
  cables: 1 | 2;
  /** Actual, constant tension at EACH attachment, not selected stack mass. */
  tension: number;
  elbow: number;
  backLength: number;
  backWidth: number;
  backThickness: number;
  range: [number, number];
};
export type Status =
  | "resists"
  | "assists"
  | "near-zero"
  | "no-force"
  | "singular"
  | "contact"
  | "invalid";
export type Cable = {
  attachment: Vec3;
  outlet: Vec3;
  force: Vec3 | null;
  length: number;
};
export type Geometry = {
  hip: Vec3;
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
  hand: Vec3;
  head: Vec3;
  backBase: Vec3;
  backTop: Vec3;
  torsoDirection: Vec3;
  normal: Vec3;
  axis: Vec3;
  handDerivative: Vec3;
  grips: [Vec3, Vec3];
  elbows: [Vec3, Vec3];
  shoulders: [Vec3, Vec3];
  barEnds: [Vec3, Vec3];
  backCorners: Vec3[];
  cables: Cable[];
};
export type Evaluation = {
  geometry: Geometry;
  /** Total generalized cable moment for the symmetric movement, not per shoulder. */
  moment: number | null;
  status: Status;
  contact: Vec3 | null;
  contactKind: string | null;
};
export type CurvePoint = {
  angle: number;
  moment: number | null;
  status: Status;
};

export const MODEL_VERSION = "pullover-1";
export const RAD = Math.PI / 180;
export const NUMERIC_EPSILON = 1e-9;
export const CABLE_RADIUS = 0.003;
export const BAR_RADIUS = 0.015;

export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const scale = (a: Vec3, k: number): Vec3 => [
  a[0] * k,
  a[1] * k,
  a[2] * k,
];
export const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3): number => Math.hypot(...a);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function cableForce(
  attachment: Vec3,
  outlet: Vec3,
  tension: number,
): Vec3 | null {
  if (
    !Number.isFinite(tension) ||
    tension < 0 ||
    ![...attachment, ...outlet].every(Number.isFinite)
  ) {
    throw new RangeError(
      "Cable inputs must be finite and tension non-negative.",
    );
  }
  const displacement = sub(outlet, attachment);
  const distance = length(displacement);
  return distance <= NUMERIC_EPSILON
    ? null
    : scale(displacement, tension / distance);
}

export function axisMoment(
  origin: Vec3,
  application: Vec3,
  force: Vec3,
  axis: Vec3,
): number {
  return dot(axis, cross(sub(application, origin), force));
}

export function attachmentForce(
  selectedMass: number,
  transmissionFactor: number,
): number {
  if (
    ![selectedMass, transmissionFactor].every(Number.isFinite) ||
    selectedMass < 0 ||
    transmissionFactor < 0
  ) {
    throw new RangeError(
      "Mass and transmission factor must be finite and non-negative.",
    );
  }
  return selectedMass * 9.81 * transmissionFactor;
}

function validate(setup: Setup, profile: Profile, angle: number): void {
  const values = [
    angle,
    ...Object.values(profile),
    setup.tilt,
    setup.hipX,
    setup.hipHeight,
    setup.pulleyHeight,
    setup.outletSpacing,
    setup.attachmentSpacing,
    setup.tension,
    setup.elbow,
    setup.backLength,
    setup.backWidth,
    setup.backThickness,
    ...setup.range,
  ];
  if (
    !values.every(Number.isFinite) ||
    Object.values(profile).some((value) => value <= 0) ||
    setup.tension < 0 ||
    setup.outletSpacing < 0 ||
    setup.attachmentSpacing < 0 ||
    setup.backLength <= 0 ||
    setup.backWidth <= 0 ||
    setup.backThickness <= 0 ||
    setup.range[0] > setup.range[1] ||
    ![1, 2].includes(setup.cables) ||
    ![-1, 1].includes(setup.facing) ||
    !["standing", "bench"].includes(setup.kind)
  ) {
    throw new RangeError(
      "Invalid pullover configuration. All lengths must be positive and numeric inputs finite.",
    );
  }
}

/** q is continuous elevation from the hipward torso direction; elbow flexion is fixed. */
export function geometry(
  setup: Setup,
  profile: Profile,
  qDegrees: number,
): Geometry {
  validate(setup, profile, qDegrees);
  const q = qDegrees * RAD;
  const beta = (setup.kind === "bench" ? setup.tilt - 90 : setup.tilt) * RAD;
  const d = setup.facing;
  const torsoDirection: Vec3 = [d * Math.sin(beta), 0, Math.cos(beta)];
  const normal: Vec3 = [d * Math.cos(beta), 0, -Math.sin(beta)];
  const axis: Vec3 = [0, -d, 0];
  const hip: Vec3 = [setup.hipX, 0, setup.hipHeight];
  const shoulder = add(hip, scale(torsoDirection, profile.torso));
  const direction = (angle: number): Vec3 =>
    add(
      scale(normal, Math.sin(angle)),
      scale(torsoDirection, -Math.cos(angle)),
    );
  const derivative = (angle: number): Vec3 =>
    add(scale(normal, Math.cos(angle)), scale(torsoDirection, Math.sin(angle)));
  const forearmAngle = q + setup.elbow * RAD;
  const elbow = add(shoulder, scale(direction(q), profile.upperArm));
  const wrist = add(elbow, scale(direction(forearmAngle), profile.forearm));
  const hand = add(wrist, scale(direction(forearmAngle), profile.hand));
  const handDerivative = add(
    scale(derivative(q), profile.upperArm),
    scale(derivative(forearmAngle), profile.forearm + profile.hand),
  );
  const head = add(
    add(shoulder, scale(torsoDirection, (0.18 * profile.height) / 1.75)),
    scale(normal, 0.1),
  );
  // Bench placement is independent of torso length: changing body proportions never moves it.
  const backBase = sub(hip, scale(normal, setup.backThickness / 2 + 0.08));
  const backTop = add(backBase, scale(torsoDirection, setup.backLength));
  const pair = (point: Vec3, width: number): [Vec3, Vec3] => [
    add(point, [0, -width / 2, 0]),
    add(point, [0, width / 2, 0]),
  ];
  const grips = pair(hand, profile.shoulderWidth);
  const elbows = pair(elbow, profile.shoulderWidth);
  const shoulders = pair(shoulder, profile.shoulderWidth);
  const barWidth =
    Math.max(
      profile.shoulderWidth,
      setup.cables === 2 ? setup.attachmentSpacing : 0,
    ) + 0.08;
  const barEnds = pair(hand, barWidth);
  const backCorners: Vec3[] = [];
  for (const along of [0, setup.backLength]) {
    for (const [lateral, depth] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      backCorners.push(
        add(
          add(add(backBase, scale(torsoDirection, along)), [
            0,
            (lateral * setup.backWidth) / 2,
            0,
          ]),
          scale(normal, (depth * setup.backThickness) / 2),
        ),
      );
    }
  }
  const sides = setup.cables === 1 ? [0] : [-1, 1];
  const cables = sides.map((side) => {
    const attachment: Vec3 = [
      hand[0],
      (side * setup.attachmentSpacing) / 2,
      hand[2],
    ];
    const outlet: Vec3 = [
      0,
      (side * setup.outletSpacing) / 2,
      setup.pulleyHeight,
    ];
    return {
      attachment,
      outlet,
      force: cableForce(attachment, outlet, setup.tension),
      length: length(sub(outlet, attachment)),
    };
  });
  return {
    hip,
    shoulder,
    elbow,
    wrist,
    hand,
    head,
    backBase,
    backTop,
    torsoDirection,
    normal,
    axis,
    handDerivative,
    grips,
    elbows,
    shoulders,
    barEnds,
    backCorners,
    cables,
  };
}

/** Segment vs oriented box, conservatively expanded by radius (including its corners). */
export function segmentBoxContact(
  start: Vec3,
  end: Vec3,
  origin: Vec3,
  axes: [Vec3, Vec3, Vec3],
  minimum: Vec3,
  maximum: Vec3,
  radius = 0,
): Vec3 | null {
  const local = (point: Vec3): Vec3 =>
    axes.map((axis) => dot(sub(point, origin), axis)) as Vec3;
  const a = local(start);
  const delta = sub(local(end), a);
  let enter = 0;
  let leave = 1;
  for (let i = 0; i < 3; i++) {
    const low = minimum[i] - radius;
    const high = maximum[i] + radius;
    if (Math.abs(delta[i]) <= NUMERIC_EPSILON) {
      if (a[i] < low - NUMERIC_EPSILON || a[i] > high + NUMERIC_EPSILON)
        return null;
    } else {
      const t1 = (low - a[i]) / delta[i];
      const t2 = (high - a[i]) / delta[i];
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave + NUMERIC_EPSILON) return null;
    }
  }
  return add(start, scale(sub(end, start), Math.max(0, Math.min(1, enter))));
}

export function backrestContact(
  start: Vec3,
  end: Vec3,
  g: Geometry,
  setup: Setup,
  radius = 0,
): Vec3 | null {
  return segmentBoxContact(
    start,
    end,
    g.backBase,
    [g.torsoDirection, [0, 1, 0], g.normal],
    [0, -setup.backWidth / 2, -setup.backThickness / 2],
    [setup.backLength, setup.backWidth / 2, setup.backThickness / 2],
    radius,
  );
}

export function evaluate(
  setup: Setup,
  profile: Profile,
  qDegrees: number,
): Evaluation {
  const g = geometry(setup, profile, qDegrees);
  const result = (
    status: Status,
    moment: number | null = null,
    contact: Vec3 | null = null,
    contactKind: string | null = null,
  ): Evaluation => ({ geometry: g, moment, status, contact, contactKind });
  if (
    [g.hip, g.shoulder, g.elbow, g.hand].some((point) => point[2] < 0) ||
    g.hand[2] < BAR_RADIUS ||
    g.cables.some((cable) => cable.outlet[2] < 0)
  ) {
    return result("invalid");
  }
  if (setup.kind === "bench") {
    for (const cable of g.cables) {
      const contact = backrestContact(
        cable.attachment,
        cable.outlet,
        g,
        setup,
        CABLE_RADIUS,
      );
      if (contact) return result("contact", null, contact, "cable–backrest");
    }
    const contact = backrestContact(
      g.barEnds[0],
      g.barEnds[1],
      g,
      setup,
      BAR_RADIUS,
    );
    if (contact) return result("contact", null, contact, "bar–backrest");
  }
  if (g.cables.some((cable) => cable.force === null)) return result("singular");
  if (setup.tension === 0) return result("no-force", 0);
  const moment = g.cables.reduce(
    (sum, cable) => sum + dot(cable.force!, g.handDerivative),
    0,
  );
  // A visual tolerance, not a biological threshold. The actual signed value stays intact.
  const nearZero =
    0.015 * length(sub(g.hand, g.shoulder)) * setup.tension * setup.cables;
  return result(
    Math.abs(moment) <= nearZero
      ? "near-zero"
      : moment > 0
        ? "resists"
        : "assists",
    moment,
  );
}

/** Full selected ROM. Refines observed validity boundaries and sign changes to <0.02°. */
export function sampleCurve(setup: Setup, profile: Profile): CurvePoint[] {
  const [start, end] = setup.range;
  const point = (angle: number): CurvePoint => {
    const { moment, status } = evaluate(setup, profile, angle);
    return { angle, moment, status };
  };
  const points: CurvePoint[] = [point(start)];
  const subdivisions = Math.max(1, Math.ceil((end - start) / 0.5));
  const refine = (a: CurvePoint, b: CurvePoint, depth = 0): void => {
    const boundary = (a.moment === null) !== (b.moment === null);
    const reversal =
      a.moment !== null && b.moment !== null && a.moment * b.moment < 0;
    if ((boundary || reversal) && b.angle - a.angle > 0.02 && depth < 7) {
      const middle = point((a.angle + b.angle) / 2);
      refine(a, middle, depth + 1);
      refine(middle, b, depth + 1);
    } else points.push(b);
  };
  for (let i = 1; i <= subdivisions; i++)
    refine(
      points[points.length - 1],
      point(start + ((end - start) * i) / subdivisions),
    );
  return points;
}

/** Fictional example, not a population-derived anatomical prediction. */
export const defaultProfile: Profile = {
  height: 1.75,
  upperArm: 0.33,
  forearm: 0.27,
  hand: 0.1,
  torso: 0.59,
  shoulderWidth: 0.42,
};

const base: Setup = {
  preset: "classic",
  name: "Horizontal torso",
  kind: "standing",
  facing: -1,
  tilt: 90,
  hipX: 1.35,
  hipHeight: 1.02,
  pulleyHeight: 2.25,
  outletSpacing: 1.55,
  attachmentSpacing: 0.95,
  cables: 1,
  tension: 100,
  elbow: 0,
  backLength: 0.82,
  backWidth: 0.34,
  backThickness: 0.1,
  range: [40, 190],
};
const variant = (overrides: Partial<Setup>): Setup => ({
  ...base,
  ...overrides,
  range: overrides.range ? [...overrides.range] : [...base.range],
});
export const presets: Setup[] = [
  variant({}),
  variant({
    preset: "bench",
    name: "Bench · 60°",
    kind: "bench",
    facing: 1,
    tilt: 60,
    hipX: 1.145,
    hipHeight: 0.46,
    pulleyHeight: 1.35,
    cables: 2,
    range: [80, 190],
  }),
  variant({
    preset: "classic-far",
    name: "Horizontal torso · farther away",
    hipX: 2.25,
  }),
  variant({
    preset: "outside",
    name: "Facing away · outside",
    facing: 1,
    tilt: 0,
    hipX: 0.85,
    hipHeight: 1,
    pulleyHeight: 1.4,
    cables: 2,
  }),
  variant({
    preset: "inside",
    name: "Inside · leaning 60°",
    facing: 1,
    tilt: 60,
    hipX: -0.38 - 0.59 * Math.sin(60 * RAD),
    hipHeight: 0.8,
    pulleyHeight: 2.15,
    cables: 2,
  }),
  variant({
    preset: "inside-upright",
    name: "Inside · upright",
    facing: 1,
    tilt: 0,
    hipX: -0.35,
    hipHeight: 1,
    pulleyHeight: 2.25,
    cables: 2,
  }),
  variant({
    preset: "bench-flat",
    name: "Bench · flat",
    kind: "bench",
    facing: 1,
    tilt: 0,
    hipX: 1.55,
    hipHeight: 0.46,
    pulleyHeight: 1.35,
    cables: 2,
    range: [100, 190],
  }),
  variant({
    preset: "bench-75",
    name: "Bench · 75°",
    kind: "bench",
    facing: 1,
    tilt: 75,
    hipX: 1.145,
    hipHeight: 0.46,
    pulleyHeight: 1.35,
    cables: 2,
    range: [80, 190],
  }),
];
