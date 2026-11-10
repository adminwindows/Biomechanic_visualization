import type { Geometry, Profile, Setup, Vec3 } from "./engine";

export type CollisionObstacle =
  | { id: string; name: string; type: "box"; center: Vec3; size: Vec3; allowBodyContact?: boolean }
  | { id: string; name: string; type: "capsule"; a: Vec3; b: Vec3; radius: number; allowBodyContact?: boolean };
type CollisionSetup = Setup & {
  bodyCollision?: boolean; bodyRadius?: number; obstacles?: CollisionObstacle[];
  collisionAttachmentClearance?: number;
};
export type BodyCapsule = { id: string; name: string; a: Vec3; b: Vec3; radius: number };
export type Collision = { point: Vec3; kind: string; label: string; clearance: number };
export type CollisionBands = { unsafe: [number, number][]; unresolved: [number, number][] };
export type GeometryBuilder = (setup: Setup, profile: Profile, q: number) => Geometry;
export const DEFAULT_BODY_RADIUS = 0.06;
export const COLLISION_INTERVAL_TOLERANCE = 1e-3;
const EPS = 1e-9;
const DEFAULT_ATTACHMENT_CLEARANCE = 0.10;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: Vec3): number => Math.hypot(...v);
const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const same = (a: Vec3, b: Vec3) => norm(sub(a, b)) <= 1e-7;
const interpolate = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));

export type SegmentDistance = { distance: number; a: Vec3; b: Vec3 };

/** Exact closest points between two closed segments, including points and parallels. */
export function segmentSegmentDistance(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): SegmentDistance {
  const d1 = sub(a1, a0), d2 = sub(b1, b0), r = sub(a0, b0);
  const aa = dot(d1, d1), ee = dot(d2, d2), ff = dot(d2, r);
  let s = 0, t = 0;
  if (aa <= EPS * EPS && ee <= EPS * EPS) return { distance: norm(r), a: [...a0], b: [...b0] };
  if (aa <= EPS * EPS) t = clamp(ff / ee);
  else {
    const cc = dot(d1, r);
    if (ee <= EPS * EPS) s = clamp(-cc / aa);
    else {
      const bb = dot(d1, d2), normal = cross(d1, d2), determinant = dot(normal, normal);
      // Cross products avoid cancellation in aa*ee-bb² for nearly parallel lines.
      // Do not discard a small but nonzero angle: it can still contain a crossing.
      if (determinant > 0) s = clamp(dot(cross(d2, r), normal) / determinant);
      t = (bb * s + ff) / ee;
      if (t < 0) { t = 0; s = clamp(-cc / aa); }
      else if (t > 1) { t = 1; s = clamp((bb - cc) / aa); }
    }
  }
  const a = interpolate(a0, a1, s), b = interpolate(b0, b1, t);
  return { distance: norm(sub(a, b)), a, b };
}

/** Exact Euclidean segment/AABB distance: minimize each piecewise quadratic interval. */
export function segmentBoxDistance(a: Vec3, b: Vec3, center: Vec3, size: Vec3): SegmentDistance {
  const low: Vec3 = center.map((value, i) => value - size[i] / 2) as Vec3;
  const high: Vec3 = center.map((value, i) => value + size[i] / 2) as Vec3;
  const delta = sub(b, a), breaks = [0, 1];
  for (let i = 0; i < 3; i++) if (Math.abs(delta[i]) > 1e-14) {
    for (const edge of [low[i], high[i]]) {
      const t = (edge - a[i]) / delta[i];
      if (t > 0 && t < 1) breaks.push(t);
    }
  }
  const knots = [...new Set(breaks)].sort((x, y) => x - y);
  let best: SegmentDistance = { distance: Infinity, a, b: center };
  const inspect = (t: number) => {
    const point = interpolate(a, b, t);
    const box: Vec3 = point.map((value, i) => clamp(value, low[i], high[i])) as Vec3;
    const distance = norm(sub(point, box));
    if (distance < best.distance) best = { distance, a: point, b: box };
  };
  for (let interval = 0; interval < knots.length - 1; interval++) {
    const left = knots[interval], right = knots[interval + 1], middle = (left + right) / 2;
    let quadratic = 0, linear = 0;
    for (let axis = 0; axis < 3; axis++) {
      const value = a[axis] + delta[axis] * middle;
      const edge = value < low[axis] ? low[axis] : value > high[axis] ? high[axis] : null;
      if (edge !== null) { quadratic += delta[axis] ** 2; linear += delta[axis] * (a[axis] - edge); }
    }
    inspect(left); inspect(right);
    if (quadratic > 0) inspect(clamp(-linear / quadratic, left, right));
  }
  return best;
}

type RawBody = BodyCapsule & { source: number | "head" };
type TrimPlan = Map<number, { excluded: boolean; fraction: number }>;
type SpeedMap = Map<string, number>;
type Capsule = BodyCapsule & { speed: number };
type Assessment = Collision & { speed: number };
const enabled = (setup: CollisionSetup) => setup.bodyCollision === true || (setup.obstacles?.length ?? 0) > 0;

function checkSettings(setup: CollisionSetup) {
  for (const radius of [setup.bodyRadius ?? DEFAULT_BODY_RADIUS, setup.cableRadius ?? 0.003, setup.barRadius ?? 0.015, setup.collisionAttachmentClearance ?? DEFAULT_ATTACHMENT_CLEARANCE]) {
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError("Collision dimensions must be finite and non-negative.");
  }
  for (const obstacle of setup.obstacles ?? []) {
    const values = obstacle.type === "box" ? [...obstacle.center, ...obstacle.size] : [...obstacle.a, ...obstacle.b, obstacle.radius];
    if (!values.every(Number.isFinite) || (obstacle.type === "box" ? obstacle.size.some((size) => size <= 0) : obstacle.radius < 0)) {
      throw new RangeError("Obstacle dimensions and coordinates must be finite and valid.");
    }
  }
}

function handleLink(g: Geometry, limbIndex: number, setup: CollisionSetup): boolean {
  const limb = g.limbs![limbIndex];
  return setup.model === "forearm-rotation" && limb.kind === "body" && g.grips.some((grip) => same(grip, limb.to));
}

function rawBodies(g: Geometry, setup: CollisionSetup): RawBody[] {
  if (!setup.bodyCollision) return [];
  const radius = setup.bodyRadius ?? DEFAULT_BODY_RADIUS;
  const names: Record<string, string> = { body: "Torso / shoulder girdle", upperArm: "Upper arm", forearm: "Forearm / hand", thigh: "Thigh", shank: "Lower leg" };
  const bodies: RawBody[] = (g.limbs ?? []).flatMap((limb, index) => limb.kind === "foot" || handleLink(g, index, setup) ? [] : [{
    id: `body-${index}`, name: names[limb.kind] ?? "Body segment", a: limb.from, b: limb.to, radius, source: index,
  }]);
  bodies.push({ id: "body-head", name: "Head", a: g.head, b: g.head, radius, source: "head" });
  return bodies;
}

/** Shared display/calculation proxies. Feet and the explicit rotation-handle lever are excluded.
 * All radii, including the head sphere, use bodyRadius (illustrative; not anatomical estimates).
 * Bar/hand terminal exemptions are applied separately and do not remove the visible body.
 */
export function bodyCapsules(g: Geometry, setup: Setup): BodyCapsule[] {
  const settings = setup as CollisionSetup;
  checkSettings(settings);
  return rawBodies(g, settings).map(({ source: _source, ...capsule }) => capsule);
}

function forearmTrimPlan(g: Geometry, setup: CollisionSetup): TrimPlan {
  const margin = setup.collisionAttachmentClearance ?? DEFAULT_ATTACHMENT_CLEARANCE;
  const limbs = g.limbs ?? [], plan: TrimPlan = new Map();
  const toGrip = (point: Vec3, visited: Set<number>): number => {
    if (g.grips.some((grip) => same(point, grip))) return 0;
    let best = Infinity;
    for (let i = 0; i < limbs.length; i++) if (!visited.has(i) && (limbs[i].kind === "forearm" || handleLink(g, i, setup)) && same(limbs[i].from, point)) {
      best = Math.min(best, norm(sub(limbs[i].to, limbs[i].from)) + toGrip(limbs[i].to, new Set([...visited, i])));
    }
    return best;
  };
  limbs.forEach((limb, index) => {
    if (limb.kind !== "forearm") return;
    const trim = margin - toGrip(limb.to, new Set([index]));
    const length = norm(sub(limb.to, limb.from));
    plan.set(index, { excluded: trim > 0 && trim >= length - EPS, fraction: trim > 0 && length > EPS ? clamp(trim / length) : 0 });
  });
  return plan;
}

function rawPoints(g: Geometry): Map<string, Vec3> {
  const points = new Map<string, Vec3>([["head", g.head], ["bar-a", g.barEnds[0]], ["bar-b", g.barEnds[1]]]);
  (g.limbs ?? []).forEach((limb, index) => { points.set(`limb-${index}-a`, limb.from); points.set(`limb-${index}-b`, limb.to); });
  g.cables.forEach((cable, index) => { points.set(`cable-${index}-a`, cable.attachment); points.set(`cable-${index}-b`, cable.outlet); });
  return points;
}

function assessments(setup: CollisionSetup, g: Geometry, speeds?: SpeedMap, fixedTrim?: TrimPlan): Assessment[] {
  const speed = (key: string) => {
    if (!speeds) return 0;
    const value = speeds.get(key);
    if (value === undefined) throw new Error("Collision geometry changed topology along its motion.");
    return value;
  };
  const body = rawBodies(g, setup).map((capsule): Capsule & { source: number | "head" } => ({ ...capsule,
    speed: capsule.source === "head" ? speed("head") : Math.max(speed(`limb-${capsule.source}-a`), speed(`limb-${capsule.source}-b`)),
  }));
  const trimPlan = fixedTrim ?? forearmTrimPlan(g, setup);
  const barBody: Capsule[] = body.flatMap((capsule) => {
    const trim = capsule.source === "head" ? undefined : trimPlan.get(capsule.source);
    if (trim?.excluded) return [];
    return [{ ...capsule, b: trim ? interpolate(capsule.b, capsule.a, trim.fraction) : capsule.b,
      speed: trim?.fraction ? 3 * capsule.speed : capsule.speed }];
  });
  const fullCables: Capsule[] = setup.slack ? [] : g.cables.map((cable, index) => ({
    id: `cable-${index}`, name: `Cable ${index + 1}`, a: cable.attachment, b: cable.outlet, radius: setup.cableRadius ?? 0.003,
    speed: Math.max(speed(`cable-${index}-a`), speed(`cable-${index}-b`)),
  }));
  const cables: Capsule[] = fullCables.map((cable) => {
    const margin = setup.collisionAttachmentClearance ?? DEFAULT_ATTACHMENT_CLEARANCE;
    const length = norm(sub(cable.b, cable.a));
    // A shorter cable collapses continuously to its outlet point; omitting it
    // entirely would break the clearance continuity needed by the interval proof.
    const a = length <= margin || length <= EPS ? cable.b : interpolate(cable.a, cable.b, margin / length);
    return { ...cable, a, speed: 3 * cable.speed };
  });
  const bar: Capsule | null = g.hasBar ? { id: "bar", name: "Bar", a: g.barEnds[0], b: g.barEnds[1], radius: setup.barRadius ?? 0.015,
    speed: Math.max(speed("bar-a"), speed("bar-b")) } : null;
  const result: Assessment[] = [];
  const capsulePair = (a: Capsule, b: Capsule, kind: string, label: string) => {
    const closest = segmentSegmentDistance(a.a, a.b, b.a, b.b);
    result.push({ point: interpolate(closest.a, closest.b, 0.5), clearance: closest.distance - a.radius - b.radius,
      kind, label, speed: a.speed + b.speed });
  };
  for (const cable of cables) for (const capsule of body) capsulePair(cable, capsule, "cable–body", `${cable.name} meets ${capsule.name.toLowerCase()}`);
  if (bar) for (const capsule of barBody) capsulePair(bar, capsule, "bar–body", `Bar meets ${capsule.name.toLowerCase()}`);
  const obstaclePair = (capsule: Capsule, obstacle: CollisionObstacle, kind: string) => {
    if (obstacle.type === "capsule") capsulePair(capsule, { ...obstacle, speed: 0 }, kind, `${capsule.name} meets ${obstacle.name}`);
    else {
      const closest = segmentBoxDistance(capsule.a, capsule.b, obstacle.center, obstacle.size);
      result.push({ point: interpolate(closest.a, closest.b, 0.5), clearance: closest.distance - capsule.radius,
        kind, label: `${capsule.name} meets ${obstacle.name}`, speed: capsule.speed });
    }
  };
  for (const obstacle of setup.obstacles ?? []) {
    // Terminal clearance exempts intentional body contact, never an external obstacle.
    for (const cable of fullCables) obstaclePair(cable, obstacle, "cable–obstacle");
    if (bar) obstaclePair(bar, obstacle, "bar–obstacle");
    if (!obstacle.allowBodyContact) for (const capsule of body) obstaclePair(capsule, obstacle, "body–obstacle");
  }
  return result;
}

/** Contact with enabled illustrative body proxies or explicitly represented obstacles.
 * Ground/foot support, body/body self-contact and the existing backrest are not duplicated.
 * The cable's terminal margin and the forearm chain's terminal margin at a bar grip
 * are deliberately excluded. allowBodyContact exempts only that support's body contact.
 */
export function collisionAt(setup: Setup, g: Geometry): Collision | null {
  const settings = setup as CollisionSetup;
  if (!enabled(settings)) return null;
  checkSettings(settings);
  const contact = assessments(settings, g).filter((item) => item.clearance <= EPS).sort((a, b) => a.clearance - b.clearance)[0];
  if (!contact) return null;
  const { speed: _speed, ...result } = contact;
  return result;
}

function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const result: [number, number][] = [];
  for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
    const previous = result.at(-1);
    if (previous && interval[0] <= previous[1] + 1e-10) previous[1] = Math.max(previous[1], interval[1]);
    else result.push([...interval]);
  }
  return result;
}

/**
 * Conservative continuous classification for the engine's harmonic point paths
 * (or affine shrug in cm). A segment/capsule's Hausdorff speed is bounded by its
 * endpoint speeds; pair distance is Lipschitz with the sum. Terminal trimming is
 * bounded by three times raw endpoint speed, avoiding a false harmonic assumption.
 * Clear cells are certified; unresolved <=0.001-display-unit cells must also be
 * treated as unavailable. A work budget may return broader unresolved cells.
 */
export function collisionBands(setup: Setup, profile: Profile, geometryFn: GeometryBuilder, coordinateScale: number): CollisionBands {
  const settings = setup as CollisionSetup;
  if (!enabled(settings)) return { unsafe: [], unresolved: [] };
  checkSettings(settings);
  const [start, end] = setup.range;
  if (![start, end, coordinateScale].every(Number.isFinite) || start > end || coordinateScale <= 0) throw new RangeError("Invalid collision interval or coordinate scale.");
  if (start === end) return { unsafe: [], unresolved: [] };
  const linear = setup.model === "shrug";
  const samples = (linear ? [0, 1, 2] : [0, 90, 180]).map((q) => geometryFn(setup, profile, q));
  const points = samples.map(rawPoints), speeds: SpeedMap = new Map();
  const trim = forearmTrimPlan(samples[0], settings);
  for (const sample of samples.slice(1)) {
    const next = forearmTrimPlan(sample, settings);
    if (next.size !== trim.size || [...trim].some(([index, value]) => next.get(index)?.excluded !== value.excluded || Math.abs((next.get(index)?.fraction ?? 0) - value.fraction) > 1e-7)) {
      return { unsafe: [], unresolved: [[start, end]] };
    }
  }
  for (const [key, zero] of points[0]) {
    const middle = points[1].get(key), last = points[2].get(key);
    if (!middle || !last || points.some((map) => map.size !== points[0].size)) return { unsafe: [], unresolved: [[start, end]] };
    let bound: number;
    if (linear) bound = norm(scale(sub(last, zero), 0.5));
    else {
      const center = scale(add(zero, last), 0.5), cosine = scale(sub(zero, last), 0.5), sine = sub(middle, center);
      bound = (norm(cosine) + norm(sine)) * coordinateScale;
    }
    if (!Number.isFinite(bound)) return { unsafe: [], unresolved: [[start, end]] };
    speeds.set(key, bound + 1e-12);
  }
  const unsafe: [number, number][] = [], unresolved: [number, number][] = [];
  let evaluations = 0;
  const visit = (left: number, right: number) => {
    if (++evaluations > 16384) { unresolved.push([left, right]); return; }
    const middle = (left + right) / 2, half = (right - left) / 2;
    let checks: Assessment[];
    try { checks = assessments(settings, geometryFn(setup, profile, middle), speeds, trim); }
    catch { unresolved.push([left, right]); return; }
    if (checks.every((item) => item.clearance > item.speed * half + EPS)) return;
    if (checks.some((item) => item.clearance < -item.speed * half - EPS
      || (item.speed < 1e-10 && item.clearance <= EPS))) { unsafe.push([left, right]); return; }
    if (right - left <= COLLISION_INTERVAL_TOLERANCE) { unresolved.push([left, right]); return; }
    visit(left, middle); visit(middle, right);
  };
  visit(start, end);
  return { unsafe: mergeIntervals(unsafe), unresolved: mergeIntervals(unresolved) };
}
