import { usableIntervals } from './usableRange';
import { angleAtProgress, movementProgress, setAngle, type LabState } from './state';

export type MotionInterval = [number, number];
type Side = 0 | 1;
type GeometryResult = ReturnType<typeof usableIntervals>;
const geometryCache = new Map<string, GeometryResult>();

function geometry(state: LabState, side: Side): GeometryResult {
  const setup = state.setups[side];
  const profile = state.profiles[side].values;
  const key = JSON.stringify([setup, profile]);
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const result = usableIntervals(setup, profile);
  if (geometryCache.size >= 32) geometryCache.delete(geometryCache.keys().next().value!);
  geometryCache.set(key, result);
  return result;
}

export function intersectIntervals(a: MotionInterval[], b: MotionInterval[]): MotionInterval[] {
  const result: MotionInterval[] = [];
  for (const left of a) for (const right of b) {
    const min = Math.max(left[0], right[0]);
    const max = Math.min(left[1], right[1]);
    if (max - min > 1e-8) result.push([min, max]);
  }
  return result.sort((a, b) => a[0] - b[0]);
}

function choose(intervals: MotionInterval[], anchor: number): MotionInterval | null {
  return intervals.find(([min, max]) => anchor >= min && anchor <= max)
    ?? intervals.reduce<MotionInterval | null>((best, interval) =>
      !best || interval[1] - interval[0] > best[1] - best[0] ? interval : best, null);
}
const ordered = (a: number, b: number): MotionInterval => [Math.min(a, b), Math.max(a, b)];
const clamp = (angle: number, interval: MotionInterval) => Math.max(interval[0], Math.min(interval[1], angle));

/** Keep original ROM and progress coordinates; constrain to one clear connected portion. */
export function motionConstraints(state: LabState) {
  const raw = [geometry(state, 0), geometry(state, 1)] as const;
  const known = [raw[0].known, raw[1].known] as [boolean, boolean];
  const anchors = state.clearIntervalAnchors ?? state.angles;
  let options: [MotionInterval[], MotionInterval[]] = [raw[0].intervals, raw[1].intervals];
  let selected: [MotionInterval | null, MotionInterval | null];
  let progress: MotionInterval | null = null;
  if (state.sync === 'angle') {
    const shared = intersectIntervals(options[0], options[1]);
    const interval = choose(shared, anchors[0]);
    options = [shared, shared];
    selected = [interval, interval];
  } else if (state.sync === 'progress') {
    const mapped = options.map((intervals, side) => intervals.map(([min, max]) =>
      ordered(movementProgress(state.setups[side], min), movementProgress(state.setups[side], max))));
    const shared = intersectIntervals(mapped[0], mapped[1]);
    progress = choose(shared, movementProgress(state.setups[0], anchors[0]));
    options = [0, 1].map(side => shared.map(([min, max]) => ordered(
      angleAtProgress(state.setups[side], min), angleAtProgress(state.setups[side], max),
    ))) as [MotionInterval[], MotionInterval[]];
    selected = [0, 1].map(side => progress ? ordered(
      angleAtProgress(state.setups[side], progress[0]), angleAtProgress(state.setups[side], progress[1]),
    ) : null) as [MotionInterval | null, MotionInterval | null];
  } else {
    selected = [choose(options[0], anchors[0]), choose(options[1], anchors[1])];
  }
  return { known, options, selected, progress };
}

export function constrainMotion(state: LabState): LabState {
  if (state.motionMode !== 'usable') return state;
  const { selected } = motionConstraints(state);
  if (state.sync !== 'independent') {
    return selected[0] ? setAngle(state, 0, clamp(state.angles[0], selected[0])) : state;
  }
  return { ...state, angles: state.angles.map((angle, side) =>
    selected[side] ? clamp(angle, selected[side]!) : angle) as [number, number] };
}

/** A disabled/unmodelled side cannot be moved by the scene, curve, keyboard or playback. */
export function setMotionAngle(state: LabState, side: Side, angle: number): LabState {
  if (state.motionMode !== 'usable') return setAngle(state, side, angle);
  const interval = motionConstraints(state).selected[side];
  return interval ? setAngle(state, side, clamp(angle, interval)) : state;
}
