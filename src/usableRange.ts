import {
  ANKLE_HEIGHT, BAR_RADIUS, NUMERIC_EPSILON, RAD,
  contactAngles, constraintAngles, evaluate, geometry, getDefinition,
  type Geometry, type Profile, type Setup,
} from "./engine";

/** Clearance is limited to the engine's represented ground/support/backrest geometry. */
export type UsableRange = { intervals: [number, number][]; known: boolean };
export const USABLE_BOUNDARY_INSET = 1e-4;

/** Roots of a scalar harmonic reconstructed from 0°, 90°, 180° poses. */
function crossingAngles(values: [number, number, number], level: number, range: [number, number]): number[] {
  const center = (values[0] + values[2]) / 2;
  const cosine = (values[0] - values[2]) / 2;
  const sine = values[1] - center;
  const amplitude = Math.hypot(cosine, sine);
  if (amplitude < 1e-12 || Math.abs(level - center) > amplitude + 1e-10) return [];
  const phase = Math.atan2(sine, cosine);
  const offset = Math.acos(Math.max(-1, Math.min(1, (level - center) / amplitude)));
  const result: number[] = [];
  for (const root of [phase - offset, phase + offset]) {
    const degrees = root / RAD;
    const first = Math.floor((range[0] - degrees) / 360);
    const last = Math.ceil((range[1] - degrees) / 360);
    for (let turn = first; turn <= last; turn++) {
      const angle = degrees + 360 * turn;
      if (angle >= range[0] - 1e-8 && angle <= range[1] + 1e-8) {
        result.push(Math.max(range[0], Math.min(range[1], angle)));
      }
    }
  }
  return result;
}

/**
 * Geometry-clear portions of the ORIGINAL range, not a cumulative ROM clamp.
 * Unknown force with a defined cable route remains assessable. Unknown mechanisms,
 * unknown resistance routing, and slack cables with unknown hanging paths do not.
 * Coincident cable endpoints are excluded even when an unknown-force status masks
 * that geometric singularity. This is not a whole-machine clearance guarantee.
 */
export function usableIntervals(setup: Setup, profile: Profile): UsableRange {
  if (setup.model === "machine" || setup.resistance === "unknown"
    || (setup.slack && setup.resistance !== "dumbbell")) return { intervals: [], known: false };
  const [start, end] = setup.range;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return { intervals: [], known: false };
  if (start === end) return { intervals: [], known: true };
  try {
    const linear = getDefinition(setup).angleUnit === "cm";
    const poses = (linear ? [0, 1, 2] : [0, 90, 180]).map((angle) => geometry(setup, profile, angle));
    const candidates = [start, end, ...contactAngles(setup, profile), ...constraintAngles(setup, profile)];
    const roots = (read: (pose: Geometry) => number, level: number) => {
      const values = poses.map(read) as [number, number, number];
      if (linear) {
        const slope = values[1] - values[0];
        if (Math.abs(slope) > 1e-12) {
          const coordinate = (level - values[0]) / slope;
          if (coordinate >= start && coordinate <= end) candidates.push(coordinate);
        }
      } else candidates.push(...crossingAngles(values, level, setup.range));
    };
    // Moving points in rotation models are harmonic; shrug translation is affine. Fixed support conflicts
    // are classified by evaluate; the moving hip-extension foot uses the hand point.
    for (const key of ["hip", "shoulder", "elbow", "hand"] as const) roots((pose) => pose[key][2], 0);
    roots((pose) => pose.hand[2], ["hip", "hip-abduction", "hip-adduction", "knee-extension", "knee-flexion"].includes(setup.model ?? "pullover") ? ANKLE_HEIGHT : BAR_RADIUS);
    for (let cable = 0; cable < poses[0].cables.length; cable++) {
      for (let coordinate = 0; coordinate < 3; coordinate++) {
        roots((pose) => pose.cables[cable].attachment[coordinate] - pose.cables[cable].outlet[coordinate], 0);
      }
    }
    // Do not collapse distinct near-coincident events: they may bound a very short
    // collision interval. Exact duplicates are sufficient to remove repeated roots.
    const events = [...new Set(candidates)].sort((a, b) => a - b);
    const clear = (angle: number): boolean => {
      const result = evaluate(setup, profile, angle);
      return result.geometry.travelValid !== false && result.status !== "contact" && result.status !== "invalid" && result.status !== "singular"
        && result.geometry.cables.every((cable) => cable.length > NUMERIC_EPSILON);
    };
    const eventClear = events.map(clear);
    const cellClear = events.slice(0, -1).map((angle, index) => clear((angle + events[index + 1]) / 2));
    const intervals: [number, number][] = [];
    const inset = (boundary: number, toward: number): number | null => {
      const direction = Math.sign(toward - boundary);
      let candidate = boundary + direction * USABLE_BOUNDARY_INSET;
      if (Math.abs(candidate - boundary) >= Math.abs(toward - boundary)) return null;
      if (clear(candidate)) return candidate;
      // Numerical contact tolerance can surround an exact tangency. Find the safe
      // side of that tolerance band before applying the final conservative inset.
      if (!clear(toward)) return null;
      let low = 0, high = 1;
      for (let iteration = 0; iteration < 48; iteration++) {
        const middle = (low + high) / 2;
        if (clear(boundary + (toward - boundary) * middle)) high = middle;
        else low = middle;
      }
      candidate = boundary + (toward - boundary) * high + direction * USABLE_BOUNDARY_INSET;
      return Math.abs(candidate - boundary) < Math.abs(toward - boundary) && clear(candidate) ? candidate : null;
    };
    for (let first = 0; first < cellClear.length;) {
      if (!cellClear[first]) { first++; continue; }
      let last = first;
      while (last + 1 < cellClear.length && cellClear[last + 1] && eventClear[last + 1]) last++;
      const middle = (events[first] + events[last + 1]) / 2;
      const left = first === 0 && eventClear[first] ? start : inset(events[first], middle);
      const right = last === cellClear.length - 1 && eventClear[last + 1] ? end : inset(events[last + 1], middle);
      if (left !== null && right !== null && left < right && clear(left) && clear(right)) intervals.push([left, right]);
      first = last + 1;
    }
    return { intervals, known: true };
  } catch {
    // Malformed or unsupported geometry cannot be certified by returning its ROM.
    return { intervals: [], known: false };
  }
}
