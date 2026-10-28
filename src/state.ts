import {
  defaultProfile, presets, MODEL_VERSION, compatible, getDefinition,
  type Profile, type Setup,
} from './engine';

export { MODEL_VERSION } from './engine';
export const STORAGE_KEY = 'exercise-biomechanics-lab.comparison.v1';
export const BACKUP_KEY_PREFIX = `${STORAGE_KEY}.model-backup`;
export const MAX_IMPORT_BYTES = 1_000_000;
// An editable demonstration model, not a population-derived prediction.
export const REFERENCE_MODEL = 'handoff-illustrative-proportions-v1';
export const PROFILE_KEYS = ['height', 'upperArm', 'forearm', 'hand', 'torso', 'shoulderWidth', 'thigh', 'shank', 'foot', 'pelvisWidth', 'headNeck'] as const;
const REQUIRED_PROFILE_KEYS = ['height', 'upperArm', 'forearm', 'hand', 'torso', 'shoulderWidth'] as const;
export type Provenance = 'example' | 'estimated' | 'measured';
export type BodyProfile = {
  values: Required<Profile>;
  provenance: Record<keyof Profile, Provenance>;
  locked: Record<keyof Profile, boolean>;
  referenceModel: string;
};
export type LabState = {
  version: 1;
  modelVersion: string;
  name: string;
  setups: [Setup, Setup];
  profiles: [BodyProfile, BodyProfile];
  angles: [number, number];
  sync: 'angle' | 'progress' | 'independent';
  motionMode?: 'explore' | 'usable';
  clearIntervalAnchors?: [number, number];
  lockBody: boolean;
  lockForce: boolean;
  lockEquipment?: boolean;
  comparisonMode?: 'controlled' | 'practical';
  criterion?: string;
  region?: [number, number];
  notes?: string;
  observation?: string;
};

export const PROFILE_BOUNDS: Record<keyof Profile, [number, number]> = {
  height: [0.8, 2.5], upperArm: [0.1, 0.8], forearm: [0.08, 0.7], hand: [0.02, 0.3],
  torso: [0.2, 1.2], shoulderWidth: [0.15, 1], thigh: [0.15, 0.8], shank: [0.15, 0.8],
  foot: [0.08, 0.5], pelvisWidth: [0.1, 0.7], headNeck: [0.1, 0.5],
};
const exampleValues = (): Required<Profile> => ({ thigh: 0.43, shank: 0.43, foot: 0.24, pelvisWidth: 0.30, headNeck: 0.24, ...defaultProfile });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const EQUIPMENT_KEYS = ['pulleyHeight', 'outletSpacing', 'attachmentSpacing', 'barLength', 'cables', 'backLength', 'backWidth', 'backThickness'] as const;

export function createBodyProfile(): BodyProfile {
  return {
    values: exampleValues(),
    provenance: Object.fromEntries(PROFILE_KEYS.map(key => [key, 'example'])) as BodyProfile['provenance'],
    locked: Object.fromEntries(PROFILE_KEYS.map(key => [key, false])) as BodyProfile['locked'],
    referenceModel: REFERENCE_MODEL,
  };
}
export function createInitialState(): LabState {
  const a = structuredClone(presets.find(p => p.preset === 'classic') ?? presets[0]);
  const b = structuredClone(presets.find(p => p.preset === 'bench') ?? presets[1]);
  const angle = clamp(160, Math.max(a.range[0], b.range[0]), Math.min(a.range[1], b.range[1]));
  return {
    version: 1, modelVersion: MODEL_VERSION, name: 'Pullover · first comparison',
    setups: [a, b], profiles: [createBodyProfile(), createBodyProfile()], angles: [angle, angle],
    sync: 'angle', lockBody: true, lockForce: false,
  };
}
export function sharedRange(state: LabState): [number, number] | null {
  if (!compatible(state.setups[0], state.setups[1])) return null;
  const min = Math.max(state.setups[0].range[0], state.setups[1].range[0]);
  const max = Math.min(state.setups[0].range[1], state.setups[1].range[1]);
  return min <= max ? [min, max] : null;
}
/** Progress always runs in the exercise's declared reference-action direction. */
export function movementProgress(setup: Setup, angle: number): number {
  const [min, max] = setup.range;
  const forward = getDefinition(setup).actionDirection === 1;
  return forward ? (angle - min) / (max - min) : (max - angle) / (max - min);
}
export function angleAtProgress(setup: Setup, progress: number): number {
  const [min, max] = setup.range;
  return getDefinition(setup).actionDirection === 1 ? min + progress * (max - min) : max - progress * (max - min);
}
export function setAngle(state: LabState, index: 0 | 1, angle: number): LabState {
  if (!Number.isFinite(angle)) throw new Error('Enter a finite movement angle.');
  const angles: [number, number] = [...state.angles];
  const range = state.setups[index].range;
  if (state.sync === 'angle') {
    const shared = sharedRange(state);
    if (!shared) throw new Error('These movement ranges do not overlap or their coordinates differ. Choose independent positions or equal progress.');
    const q = clamp(angle, shared[0], shared[1]);
    return { ...state, angles: [q, q] };
  }
  const q = clamp(angle, range[0], range[1]);
  angles[index] = q;
  if (state.sync === 'progress') {
    const other: 0 | 1 = index === 0 ? 1 : 0;
    angles[other] = angleAtProgress(state.setups[other], movementProgress(state.setups[index], q));
  }
  return { ...state, angles };
}
export function regenerateEstimates(profile: BodyProfile): BodyProfile {
  const next = structuredClone(profile);
  const example = exampleValues();
  for (const key of PROFILE_KEYS) {
    if (key === 'height' || next.provenance[key] === 'measured' || next.locked[key]) continue;
    next.values[key] = example[key] * next.values.height / example.height;
    next.provenance[key] = 'estimated';
  }
  return next;
}
export function changeHeight(profile: BodyProfile, height: number): BodyProfile {
  boundedNumber(height, 'Height', ...PROFILE_BOUNDS.height);
  const next = structuredClone(profile);
  next.values.height = height;
  next.provenance.height = 'measured';
  return regenerateEstimates(next);
}
export function editMeasurement(profile: BodyProfile, key: keyof Profile, value: number): BodyProfile {
  if (key === 'height') return changeHeight(profile, value);
  boundedNumber(value, key, ...PROFILE_BOUNDS[key]);
  return { ...profile, values: { ...profile.values, [key]: value }, provenance: { ...profile.provenance, [key]: 'measured' } };
}
export function forceValue(setup: Setup): number | null {
  if (setup.forceKnown === false || setup.resistance === 'unknown' || setup.model === 'machine') return null;
  if (setup.resistance === 'dumbbell') return setup.loadMass === undefined ? null : setup.loadMass * 9.81;
  if (setup.slack) return 0;
  if (setup.loadMode === 'mass') return setup.loadMass === undefined || setup.transmissionFactor === undefined ? null : setup.loadMass * setup.transmissionFactor * 9.81;
  return setup.tension;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function boundedNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a finite number between ${min} and ${max}.`);
  return value;
}
function string(value: unknown, label: string, max = 120, min = 1): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
  return value;
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
}
function pair(value: unknown, label: string): [unknown, unknown] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${label} must contain exactly two entries.`);
  return value as [unknown, unknown];
}
function enumValue<T extends string | number>(value: unknown, label: string, options: readonly T[]): T {
  if (!options.includes(value as T)) throw new Error(`${label} is not supported.`);
  return value as T;
}
export function validateProfile(input: unknown, label = 'Body profile'): BodyProfile {
  const p = object(input, label);
  const values = object(p.values, `${label} dimensions`);
  const provenance = object(p.provenance, `${label} provenance`);
  const locked = object(p.locked, `${label} locks`);
  const result = createBodyProfile();
  result.referenceModel = enumValue(p.referenceModel, `${label} reference model`, [REFERENCE_MODEL]);
  const height = boundedNumber(values.height, `${label} height`, ...PROFILE_BOUNDS.height);
  for (const key of PROFILE_KEYS) {
    if (values[key] === undefined && !(REQUIRED_PROFILE_KEYS as readonly string[]).includes(key)) {
      if (provenance[key] !== undefined || locked[key] !== undefined) throw new Error(`${label} ${key} requires its dimension, provenance, and lock together.`);
      result.values[key] = exampleValues()[key] * height / defaultProfile.height;
      result.provenance[key] = 'estimated';
      result.locked[key] = false;
      continue;
    }
    result.values[key] = boundedNumber(values[key], `${label} ${key}`, ...PROFILE_BOUNDS[key]);
    result.provenance[key] = enumValue(provenance[key], `${label} ${key} provenance`, ['example', 'estimated', 'measured']);
    result.locked[key] = bool(locked[key], `${label} ${key} lock`);
  }
  return result;
}
export function validateSetup(input: unknown, label = 'Equipment setup'): Setup {
  const s = object(input, label);
  const range = pair(s.range, `${label} movement range`);
  const min = boundedNumber(range[0], `${label} minimum angle`, -180, 200);
  const max = boundedNumber(range[1], `${label} maximum angle`, -180, 200);
  if (min >= max) throw new Error(`${label} movement range must have its minimum below its maximum.`);
  const kind = enumValue(s.kind, `${label} posture`, ['standing', 'bench']);
  const result: Setup = {
    preset: string(s.preset, `${label} preset`), name: string(s.name, `${label} name`), kind,
    facing: enumValue(s.facing, `${label} facing direction`, [-1, 1]),
    tilt: boundedNumber(s.tilt, `${label} inclination`, kind === 'bench' ? 0 : -30, 90),
    hipX: boundedNumber(s.hipX, `${label} pelvis horizontal position`, -5, 5),
    hipHeight: boundedNumber(s.hipHeight, `${label} pelvis height`, 0.1, 2.5),
    pulleyHeight: boundedNumber(s.pulleyHeight, `${label} pulley height`, 0.01, 5),
    outletSpacing: boundedNumber(s.outletSpacing, `${label} outlet spacing`, 0, 5),
    attachmentSpacing: boundedNumber(s.attachmentSpacing, `${label} attachment spacing`, 0, 3),
    cables: enumValue(s.cables, `${label} cable count`, [1, 2]),
    tension: boundedNumber(s.tension, `${label} force per cable`, 0, 2000),
    elbow: boundedNumber(s.elbow, `${label} elbow flexion`, 0, 160),
    backLength: boundedNumber(s.backLength, `${label} backrest length`, 0.1, 2),
    backWidth: boundedNumber(s.backWidth, `${label} backrest width`, 0.1, 1.5),
    backThickness: boundedNumber(s.backThickness, `${label} backrest thickness`, 0.01, 0.5),
    range: [min, max],
  };
  if (s.model !== undefined) result.model = enumValue(s.model, `${label} model`, ['pullover', 'curl', 'extension', 'raise', 'fly', 'hip', 'machine'] as const);
  if (s.resistance !== undefined) result.resistance = enumValue(s.resistance, `${label} resistance`, ['cable', 'dumbbell', 'unknown'] as const);
  if (s.posture !== undefined) result.posture = enumValue(s.posture, `${label} posture`, ['standing', 'kneeling', 'seated'] as const);
  if (s.loadMode !== undefined) result.loadMode = enumValue(s.loadMode, `${label} load convention`, ['force', 'mass'] as const);
  const numericOptions = { loadMass: [0, 500], upperArmAngle: [-90, 200], planeOffset: [-2, 2], gripWidth: [0.05, 1.5], barLength: [0.1, 3], transmissionFactor: [0, 10], upperArmMass: [0, 50], forearmMass: [0, 50], thighMass: [0, 50], shankMass: [0, 50] } as const;
  for (const key of Object.keys(numericOptions) as (keyof typeof numericOptions)[]) {
    if (s[key] !== undefined) result[key] = boundedNumber(s[key], `${label} ${key}`, numericOptions[key][0], numericOptions[key][1]);
  }
  for (const key of ['slack', 'forceKnown', 'segmentGravity'] as const) {
    if (s[key] !== undefined) result[key] = bool(s[key], `${label} ${key}`);
  }
  if ((result.resistance === 'dumbbell' || result.loadMode === 'mass') && result.loadMass === undefined) throw new Error(`${label} requires a selected load mass.`);
  if (result.loadMode === 'mass' && result.resistance !== 'dumbbell' && result.transmissionFactor === undefined) throw new Error(`${label} requires an explicit transmission factor for selected cable mass.`);
  if (result.segmentGravity) {
    if (result.model === 'hip') {
      if (result.thighMass === undefined || result.shankMass === undefined) throw new Error(`${label} requires declared thigh and lower-leg masses for segment gravity.`);
    } else if (result.upperArmMass === undefined || result.forearmMass === undefined) throw new Error(`${label} requires declared upper-arm and forearm masses for segment gravity.`);
  }
  const definition = getDefinition(result);
  if (min < definition.minAngle || max > definition.maxAngle) throw new Error(`${label} movement range must remain within ${definition.minAngle}–${definition.maxAngle}° for ${definition.label}.`);
  return result;
}

/** Known migrations only. The original is retained by loadState before any save. */
export function validateState(input: unknown): LabState {
  const s = object(input, 'Comparison');
  if (s.version !== 1) throw new Error('This comparison format is not supported (expected version 1).');
  if (s.modelVersion !== MODEL_VERSION && s.modelVersion !== 'pullover-1') throw new Error('This comparison uses another mechanics model. It has not been changed or migrated.');
  const setups = pair(s.setups, 'Setups');
  const profiles = pair(s.profiles, 'Body profiles');
  const angles = pair(s.angles, 'Movement angles');
  const result: LabState = {
    version: 1, modelVersion: MODEL_VERSION, name: string(s.name, 'Comparison name', 120, 0),
    setups: [validateSetup(setups[0], 'A'), validateSetup(setups[1], 'B')],
    profiles: [validateProfile(profiles[0], 'A'), validateProfile(profiles[1], 'B')],
    angles: [boundedNumber(angles[0], 'A angle', -180, 200), boundedNumber(angles[1], 'B angle', -180, 200)],
    sync: enumValue(s.sync, 'Movement synchronization', ['angle', 'progress', 'independent']),
    lockBody: bool(s.lockBody, 'Body synchronization'), lockForce: bool(s.lockForce, 'Force synchronization'),
  };
  if (s.lockEquipment !== undefined) result.lockEquipment = bool(s.lockEquipment, 'Equipment synchronization');
  if (s.motionMode !== undefined) result.motionMode = enumValue(s.motionMode, 'Motion mode', ['explore', 'usable'] as const);
  if (s.clearIntervalAnchors !== undefined) {
    const anchors = pair(s.clearIntervalAnchors, 'Clear-interval anchors');
    result.clearIntervalAnchors = [
      boundedNumber(anchors[0], 'A clear-interval anchor', -180, 200),
      boundedNumber(anchors[1], 'B clear-interval anchor', -180, 200),
    ];
  }
  if (s.comparisonMode !== undefined) result.comparisonMode = enumValue(s.comparisonMode, 'Comparison mode', ['controlled', 'practical'] as const);
  if (s.criterion !== undefined) result.criterion = string(s.criterion, 'Comparison criterion', 1000, 0);
  if (s.notes !== undefined) result.notes = string(s.notes, 'Study notes', 10000, 0);
  if (s.observation !== undefined) result.observation = string(s.observation, 'Study observation', 10000, 0);
  if (s.region !== undefined) {
    const region = pair(s.region, 'Analysis region');
    const lo = boundedNumber(region[0], 'Analysis region start', -180, 200);
    const hi = boundedNumber(region[1], 'Analysis region end', -180, 200);
    if (lo >= hi) throw new Error('Analysis region start must be below its end.');
    result.region = [lo, hi];
  }
  for (const i of [0, 1] as const) {
    const range = result.setups[i].range;
    if (result.angles[i] < range[0] - 1e-8 || result.angles[i] > range[1] + 1e-8) throw new Error(`${i === 0 ? 'A' : 'B'} angle is outside its movement range.`);
  }
  if (result.sync === 'angle' && (!sharedRange(result) || Math.abs(result.angles[0] - result.angles[1]) > 1e-6)) throw new Error('Same-angle comparisons require compatible exercise coordinates, overlapping ranges, and equal angles.');
  if (result.sync === 'progress' && Math.abs(movementProgress(result.setups[0], result.angles[0]) - movementProgress(result.setups[1], result.angles[1])) > 1e-6) throw new Error('Equal-progress comparisons require matching movement progress.');
  if (result.lockForce) {
    const [a, b] = result.setups.map(forceValue);
    if (a === null || b === null || Math.abs(a - b) > 1e-6) throw new Error('Same-force comparisons require known, equal actual force per attachment in A and B.');
  }
  if (result.lockBody) {
    const [a, b] = result.profiles;
    const matching = a.referenceModel === b.referenceModel && PROFILE_KEYS.every(key => a.values[key] === b.values[key] && a.provenance[key] === b.provenance[key] && a.locked[key] === b.locked[key]);
    if (!matching) throw new Error('Same-body comparisons require matching dimensions, provenance, and locks in A and B.');
  }
  if (result.lockEquipment) {
    const [a, b] = result.setups;
    const equipmentValue = (setup: Setup, key: typeof EQUIPMENT_KEYS[number]) => key === 'barLength' ? setup.barLength ?? Math.max(0.6, setup.attachmentSpacing + 0.08) : setup[key];
    if (!EQUIPMENT_KEYS.every(key => equipmentValue(a, key) === equipmentValue(b, key)) || (a.transmissionFactor ?? 1) !== (b.transmissionFactor ?? 1)) throw new Error('Same-equipment comparisons require matching pulley, attachment, bar, and backrest dimensions and transmission factors.');
  }
  return result;
}
export function parseComparison(text: string): LabState {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('Choose a comparison file smaller than 1 MB.');
  try { return validateState(JSON.parse(text)); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('The comparison file is not valid JSON.'); throw error; }
}

/** Keep exact original source text; never overwrite a previous distinct backup. */
export function preserveModelBackup(raw: string, namespace = STORAGE_KEY): string {
  let key = `${namespace}.model-backup`;
  const existing = localStorage.getItem(key);
  if (existing === raw) return key;
  if (existing !== null) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    key = `${key}.${suffix}`;
  }
  localStorage.setItem(key, raw);
  return key;
}
export function loadState(): { state: LabState; error: string | null; backupKey?: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { state: createInitialState(), error: null };
    if (new TextEncoder().encode(saved).byteLength > MAX_IMPORT_BYTES) throw new Error('The saved comparison exceeds the 1 MB size limit.');
    const input = JSON.parse(saved);
    const state = validateState(input);
    if (input.modelVersion !== MODEL_VERSION) {
      try {
        const backupKey = preserveModelBackup(saved);
        return { state, backupKey, error: `Updated the saved comparison from ${input.modelVersion} to ${MODEL_VERSION}. The original snapshot is preserved in browser storage at ${backupKey}. Review the recalculated results before saving.` };
      } catch {
        return { state, error: `Updated the comparison to ${MODEL_VERSION} for review. A backup could not be written; the original remains in browser storage. Export it before replacing the saved comparison.` };
      }
    }
    return { state, error: null };
  } catch (error) {
    return { state: createInitialState(), error: `The saved comparison could not be restored. ${error instanceof Error ? error.message : 'Storage is unavailable.'}` };
  }
}
export function saveState(state: LabState): boolean {
  try {
    const next = validateState(state);
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      let needsBackup = false;
      try {
        const original = JSON.parse(previous);
        validateState(original);
        needsBackup = original.modelVersion !== MODEL_VERSION;
      } catch { needsBackup = true; }
      if (needsBackup) preserveModelBackup(previous);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch { return false; }
}
