import type { AppliedLoad, Geometry, Limb, Profile, Setup, Vec3 } from "./engine";

export type IsolatedJointModel =
  | "hip-abduction" | "hip-adduction" | "knee-extension" | "knee-flexion"
  | "wrist-flexion" | "wrist-extension" | "forearm-rotation" | "shrug";

type DistalSetup = Omit<Setup, "model"> & {
  model?: string;
  loadedSides?: "unilateral" | "bilateral";
  jointPlacement?: number;
  rotationLever?: number;
  outletPositions?: Vec3[];
  freeWeightKind?: "dumbbell" | "barbell" | "shared";
  handMass?: number;
};
type MotionLoad = { point: Vec3; derivative: Vec3; side: -1 | 1 };
const models: string[] = ["hip-abduction", "hip-adduction", "knee-extension", "knee-flexion", "wrist-flexion", "wrist-extension", "forearm-rotation", "shrug"];
const RAD = Math.PI / 180;
const ANKLE_HEIGHT = 0.06;
const EPS = 1e-9;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: Vec3): number => Math.hypot(...v);
const unit = (v: Vec3): Vec3 => {
  const magnitude = norm(v);
  if (magnitude < EPS) throw new RangeError("An isolated-joint axis must have a defined direction.");
  return mul(v, 1 / magnitude);
};
const midpoint = (a: Vec3, b: Vec3): Vec3 => mul(add(a, b), 0.5);
const zero = (): Vec3 => [0, 0, 0];
const samePoint = (a: Vec3, b: Vec3): boolean => norm(sub(a, b)) < EPS;

/** Rodrigues rotation; axis is a unit vector in world coordinates. */
const rotate = (v: Vec3, axis: Vec3, angle: number): Vec3 => add(
  add(mul(v, Math.cos(angle)), mul(cross(axis, v), Math.sin(angle))),
  mul(axis, dot(axis, v) * (1 - Math.cos(angle))),
);

/**
 * Builds isolated distal-joint motions on an already supported body. Mutates and
 * returns g for supported models; returns null without mutation for other models.
 * Angles are degrees except shrug (cm). Derivatives are per radian, or per metre
 * of shoulder-girdle elevation for shrug; the latter is a force in N, not a torque.
 */
export function buildIsolatedJoint(setup: Setup, profile: Profile, q: number, g: Geometry, tension: number | null): Geometry | null {
  const s = setup as DistalSetup;
  if (!s.model || !models.includes(s.model)) return null;
  const model = s.model as IsolatedJointModel;
  const angle = q * RAD;
  if (![q, s.jointPlacement ?? 0, s.rotationLever ?? 0.08, s.upperArmAngle ?? 0, s.elbow].every(Number.isFinite)
    || (tension !== null && (!Number.isFinite(tension) || tension < 0))) throw new RangeError("Joint and load inputs must be finite.");
  if ((s.rotationLever ?? 0.08) <= 0) throw new RangeError("The schematic rotation lever must be positive.");
  g.cables = []; g.loads = []; g.gravityKnown = true; g.hasBar = false; g.gripCompatible = true;
  g.limbs ??= [];
  const t = unit(g.torsoDirection), n = unit(g.normal);
  const direction = (a: number): Vec3 => add(mul(t, -Math.cos(a)), mul(n, Math.sin(a)));
  const derivative = (a: number): Vec3 => add(mul(t, Math.sin(a)), mul(n, Math.cos(a)));
  const bilateral = s.loadedSides === "bilateral" || (model === "shrug" && s.loadedSides === undefined);
  const sides: (-1 | 1)[] = bilateral ? [-1, 1] : [1];
  const forcePoints: MotionLoad[] = [];
  const segmentLoads: AppliedLoad[] = [];
  const gravity = (point: Vec3, motion: Vec3, mass: number | undefined) => {
    if (mass === undefined || !Number.isFinite(mass) || mass < 0) { g.gravityKnown = false; return; }
    segmentLoads.push({ point, derivative: motion, force: [0, 0, -9.81 * mass], kind: "gravity" });
  };
  const setJoint = (origin: Vec3, axis: Vec3, point: Vec3, motion: Vec3) => {
    g.jointOrigin = origin; g.axis = unit(axis); g.jointAxis = g.axis;
    g.hand = point; g.handDerivative = motion;
  };

  if (model.startsWith("hip-") || model.startsWith("knee-")) {
    const thigh = profile.thigh ?? 0.43, shank = profile.shank ?? 0.43;
    const lateral = s.posture==='side-lying'?unit(sub(g.shoulders[1],g.shoulders[0])):[0,1,0] as Vec3;
    const hip = add(g.hip, mul(lateral,(profile.pelvisWidth ?? 0.30) / 2));
    let knee: Vec3, ankle: Vec3, kneeMotion: Vec3, ankleMotion: Vec3, axis: Vec3;
    if (model.startsWith("hip-")) {
      const u = add(mul(t, -Math.cos(angle)), mul(lateral, Math.sin(angle)));
      const du = add(mul(t, Math.sin(angle)), mul(lateral, Math.cos(angle)));
      axis = unit(cross(lateral, t));
      knee = add(hip, mul(u, thigh)); ankle = add(knee, mul(u, shank));
      kneeMotion = mul(du, thigh); ankleMotion = mul(du, thigh + shank);
      setJoint(hip, axis, ankle, ankleMotion);
      if (s.segmentGravity) {
        gravity(midpoint(hip, knee), mul(kneeMotion, 0.5), s.thighMass);
        gravity(midpoint(knee, ankle), mul(add(kneeMotion, ankleMotion), 0.5), s.shankMass);
      }
    } else {
      const placement = (s.jointPlacement ?? (model === "knee-extension" ? 90 : 0)) * RAD;
      const upper = direction(placement), distal = direction(placement - angle);
      axis = unit(cross(t, n));
      knee = add(hip, mul(upper, thigh)); ankle = add(knee, mul(distal, shank));
      kneeMotion = zero(); ankleMotion = mul(derivative(placement - angle), -shank);
      setJoint(knee, axis, ankle, ankleMotion);
      if (s.segmentGravity) {
        gravity(midpoint(hip, knee), zero(), s.thighMass);
        gravity(midpoint(knee, ankle), mul(ankleMotion, 0.5), s.shankMass);
      }
    }
    g.elbow = knee; g.wrist = ankle;
    const originalLegs=g.limbs.filter(limb=>["thigh","shank","foot"].includes(limb.kind));
    const activeLeg=new Set(originalLegs.slice(originalLegs.length/2));
    g.limbs = g.limbs.filter(limb=>!activeLeg.has(limb));
    const heel = add(ankle, [0, 0, -ANKLE_HEIGHT]);
    g.limbs.push({ from: hip, to: knee, kind: "thigh" }, { from: knee, to: ankle, kind: "shank" },
      { from: ankle, to: heel, kind: "foot" },
      { from: heel, to: add(heel, [s.facing * (profile.foot ?? 0.24), 0, 0]), kind: "foot" });
    g.supportPoints = g.supportPoints?.slice(0,1);
    if (ankle[2] < ANKLE_HEIGHT - EPS) {
      g.supportValid = false;
      g.validityReason = "The active foot crosses the floor; adjust placement or range without stretching the leg.";
    }
    forcePoints.push({ point: ankle, derivative: ankleMotion, side: 1 });
  } else if (model === "shrug") {
    const offset: Vec3 = [0, 0, q / 100], motion: Vec3 = [0, 0, 1];
    const oldShoulders: [Vec3, Vec3] = [[...g.shoulders[0]], [...g.shoulders[1]]];
    const oldElbows: [Vec3, Vec3] = [[...g.elbows[0]], [...g.elbows[1]]];
    const oldGrips: [Vec3, Vec3] = [[...g.grips[0]], [...g.grips[1]]];
    const oldWrists = g.wrists ?? oldElbows.map((elbow, index) => add(elbow, mul(sub(oldGrips[index], elbow), profile.forearm / (profile.forearm + profile.hand)))) as [Vec3, Vec3];
    g.shoulders = oldShoulders.map((point) => add(point, offset)) as [Vec3, Vec3];
    g.elbows = oldElbows.map((point) => add(point, offset)) as [Vec3, Vec3];
    g.grips = oldGrips.map((point) => add(point, offset)) as [Vec3, Vec3];
    g.wrists = oldWrists.map((point) => add(point, offset)) as [Vec3, Vec3];
    g.limbs = g.limbs.filter((limb) => limb.kind !== "upperArm" && limb.kind !== "forearm"
      && !(limb.kind === "body" && samePoint(limb.from, oldShoulders[0]) && samePoint(limb.to, oldShoulders[1])));
    g.limbs.push({ from: g.shoulders[0], to: g.shoulders[1], kind: "body" });
    for (let index = 0; index < 2; index++) {
      g.limbs.push({ from: g.shoulders[index], to: g.elbows[index], kind: "upperArm" },
        { from: g.elbows[index], to: g.wrists[index], kind: "forearm" },
        { from: g.wrists[index], to: g.grips[index], kind: "forearm" });
      if (s.segmentGravity) {
        gravity(midpoint(g.shoulders[index], g.elbows[index]), motion, s.upperArmMass);
        gravity(midpoint(g.elbows[index], g.grips[index]), motion, s.forearmMass);
      }
    }
    for (const side of sides) forcePoints.push({ point: g.grips[side === 1 ? 1 : 0], derivative: motion, side });
    g.elbow = g.elbows[1]; g.wrist = g.wrists[1];
    // The central torso/head stay fixed; these points describe shoulder-girdle translation.
    setJoint(g.shoulder, motion, g.grips[1], motion);
  } else {
    const upperAngle = (s.upperArmAngle ?? 0) * RAD;
    const distalAngle = upperAngle + s.elbow * RAD;
    const upper = direction(upperAngle), forearm = direction(distalAngle);
    const wristAxis = rotate(unit(cross(n, t)),unit(forearm),(s.forearmRotation??0)*RAD);
    g.wrists = [[0, 0, 0], [0, 0, 0]];
    g.limbs = g.limbs.filter((limb) => limb.kind !== "upperArm" && limb.kind !== "forearm");
    for (let index = 0; index < 2; index++) {
      const side: -1 | 1 = index === 0 ? -1 : 1;
      const active = sides.includes(side);
      const S = g.shoulders[index], E = add(S, mul(upper, profile.upperArm));
      const W = add(E, mul(forearm, profile.forearm));
      const jointAngle = active ? angle : 0;
      let H: Vec3, motion: Vec3, axis: Vec3, handCenter: Vec3, handMotion: Vec3;
      if (model === "forearm-rotation") {
        axis = unit(forearm);
        const anatomicalHand = add(W, mul(forearm, profile.hand));
        const radial = rotate(mul(wristAxis, s.rotationLever ?? 0.08), axis, jointAngle);
        H = add(anatomicalHand, radial); motion = active ? cross(axis, radial) : zero();
        handCenter = add(W, mul(forearm, profile.hand / 2)); handMotion = zero();
        g.limbs.push({ from: W, to: anatomicalHand, kind: "forearm" }, { from: anatomicalHand, to: H, kind: "body" });
      } else {
        axis = wristAxis;
        const handVector = rotate(mul(forearm, profile.hand), axis, jointAngle);
        H = add(W, handVector); motion = active ? cross(axis, handVector) : zero();
        handCenter = midpoint(W, H); handMotion = mul(motion, 0.5);
        g.limbs.push({ from: W, to: H, kind: "forearm" });
      }
      g.elbows[index] = E; g.wrists[index] = W; g.grips[index] = H;
      g.limbs.push({ from: S, to: E, kind: "upperArm" }, { from: E, to: W, kind: "forearm" });
      if (active) {
        forcePoints.push({ point: H, derivative: motion, side });
        if (s.segmentGravity) gravity(handCenter, handMotion, s.handMass);
      }
      if (side === 1) { g.elbow = E; g.wrist = W; setJoint(W, axis, H, motion); }
    }
  }

  const resistance = s.resistance ?? "cable";
  for (let index = 0; index < forcePoints.length; index++) {
    const point = forcePoints[index];
    if (resistance === "cable") {
      const outlet: Vec3 = s.outletPositions?.[index] ? [...s.outletPositions[index]]
        : [s.planeOffset ?? 0, point.side * s.outletSpacing / 2, s.pulleyHeight];
      const delta = sub(outlet, point.point), distance = norm(delta);
      const force: Vec3 | null = tension === null || distance <= EPS ? null : mul(delta, tension / distance);
      g.cables.push({ attachment: point.point, outlet, length: distance, force, derivative: point.derivative });
      if (force) g.loads.push({ point: point.point, force, derivative: point.derivative, kind: "cable" });
    } else if (resistance === "dumbbell") {
      const totalImplementMass = s.freeWeightKind === "barbell" || s.freeWeightKind === "shared";
      const mass = s.loadMass === undefined ? undefined : s.loadMass / (totalImplementMass ? forcePoints.length : 1);
      gravity(point.point, point.derivative, mass);
    }
  }
  g.loads.push(...segmentLoads);
  g.hasBar = resistance === "dumbbell" && (s.freeWeightKind === "barbell" || s.freeWeightKind === "shared") && forcePoints.length === 2;
  g.barEnds = [[...g.grips[0]], [...g.grips[1]]];
  if (g.hasBar) {
    const span = norm(sub(g.grips[1], g.grips[0]));
    const requested = s.barLength ?? span + 0.08;
    if (requested < span - EPS || (s.gripWidth !== undefined && Math.abs(s.gripWidth - span) > 1e-6)) {
      g.gripCompatible = false;
      g.validityReason = "The fixed arm positions and rigid bar dimensions cannot share these grips without changing the pose.";
    } else {
      const half = mul(unit(sub(g.grips[1], g.grips[0])), requested / 2), center = midpoint(g.grips[0], g.grips[1]);
      g.barEnds = [sub(center, half), add(center, half)];
    }
  }
  return g;
}
