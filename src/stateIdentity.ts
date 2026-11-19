import type { BodyProfile, LabState } from './state';

/** Value equality for validated JSON-like state, independent of object key order. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]));
  }
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  // Absent and explicitly undefined optional values have the same model meaning.
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  return keys.length === Object.keys(b).filter(key => b[key] !== undefined).length
    && keys.every(key => sameValue(a[key], b[key]));
}
function reuseTuple<T>(previous: [T, T], next: [T, T], values: [T, T]): [T, T] {
  if (values[0] === previous[0] && values[1] === previous[1]) return previous;
  if (values[0] === next[0] && values[1] === next[1]) return next;
  return values;
}
function reuseProfile(previous: BodyProfile, next: BodyProfile): BodyProfile {
  if (sameValue(previous, next)) return previous;
  const values = sameValue(previous.values, next.values) ? previous.values : next.values;
  const provenance = sameValue(previous.provenance, next.provenance) ? previous.provenance : next.provenance;
  const locked = sameValue(previous.locked, next.locked) ? previous.locked : next.locked;
  return values === next.values && provenance === next.provenance && locked === next.locked
    ? next : { ...next, values, provenance, locked };
}

/**
 * Call after validation/normalization. Reuse unchanged model inputs so editing a
 * name, note, angle or display setting does not resample unchanged geometry.
 * Neither input is mutated; validation and mechanics remain the caller's job.
 */
export function reuseModelReferences(previous: LabState, validatedNext: LabState): LabState {
  const setups = reuseTuple(previous.setups, validatedNext.setups, [
    sameValue(previous.setups[0], validatedNext.setups[0]) ? previous.setups[0] : validatedNext.setups[0],
    sameValue(previous.setups[1], validatedNext.setups[1]) ? previous.setups[1] : validatedNext.setups[1],
  ]);
  const profiles = reuseTuple(previous.profiles, validatedNext.profiles, [
    reuseProfile(previous.profiles[0], validatedNext.profiles[0]),
    reuseProfile(previous.profiles[1], validatedNext.profiles[1]),
  ]);
  return setups === validatedNext.setups && profiles === validatedNext.profiles
    ? validatedNext : { ...validatedNext, setups, profiles };
}
