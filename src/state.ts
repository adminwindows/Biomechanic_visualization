import {
  defaultProfile, presets, MODEL_VERSION, compatible, getDefinition, actualForce,
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
  viewFraming?: { view: 'side' | 'front' | 'top'; zoom: number; pan: [number, number] };
};

export const PROFILE_BOUNDS: Record<keyof Profile, [number, number]> = {
  height: [0.8, 2.5], upperArm: [0.1, 0.8], forearm: [0.08, 0.7], hand: [0.02, 0.3],
  torso: [0.2, 1.2], shoulderWidth: [0.15, 1], thigh: [0.15, 0.8], shank: [0.15, 0.8],
  foot: [0.08, 0.5], pelvisWidth: [0.1, 0.7], headNeck: [0.1, 0.5],
};
const exampleValues = (): Required<Profile> => ({ thigh: 0.43, shank: 0.43, foot: 0.24, pelvisWidth: 0.30, headNeck: 0.24, ...defaultProfile });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const EQUIPMENT_KEYS = ['pulleyHeight', 'outletSpacing', 'attachmentSpacing', 'barLength', 'cables', 'backLength', 'backWidth', 'backThickness', 'planeOffset', 'outletPositions', 'cableRadius', 'barRadius', 'cableTravelMin', 'cableTravelMax', 'stackArrangement', 'obstacles', 'equipmentLimits'] as const;

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
    version: 1, modelVersion: MODEL_VERSION, name: 'Pullover · installation comparison',
    setups: [a, b], profiles: [createBodyProfile(), createBodyProfile()], angles: [angle, angle],
    sync: 'angle', lockBody: true, lockForce: false, comparisonMode: 'practical',
    criterion: 'Compare two complete installations with different postures and cable counts. Differences cannot be attributed to one setup variable alone.',
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
export function forceValue(setup: Setup): number | null { return actualForce(setup); }

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
    hipX: boundedNumber(s.hipX, `${label} pelvis horizontal position`, -10, 10),
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
  if (s.model !== undefined) result.model = enumValue(s.model, `${label} model`, ['pullover', 'curl', 'extension', 'raise', 'fly', 'hip', 'machine', 'reverse-fly', 'hip-abduction', 'hip-adduction', 'knee-extension', 'knee-flexion', 'wrist-flexion', 'wrist-extension', 'forearm-rotation', 'shrug'] as const);
  if (s.resistance !== undefined) result.resistance = enumValue(s.resistance, `${label} resistance`, ['cable', 'dumbbell', 'unknown'] as const);
  if (s.posture !== undefined) result.posture = enumValue(s.posture, `${label} posture`, ['standing', 'kneeling', 'seated', 'supine', 'prone', 'side-lying'] as const);
  if (s.loadMode !== undefined) result.loadMode = enumValue(s.loadMode, `${label} load convention`, ['force', 'mass'] as const);
  const numericOptions = { loadMass: [0, 500], upperArmAngle: [-90, 200], planeOffset: [-2, 2], gripWidth: [0.05, 1.5], barLength: [0.1, 3], transmissionFactor: [0, 10], upperArmMass: [0, 50], forearmMass: [0, 50], thighMass: [0, 50], shankMass: [0, 50], handMass: [0, 5], hipY: [-5, 5], movementPlane: [-180, 180], jointPlacement: [-180, 200], bodyRoll: [-180, 180], forearmRotation: [-180, 180], rotationLever: [0.005, 1], cableRadius: [0.0001, 0.05], barRadius: [0.001, 0.1], cableTravelMin: [0, 20], cableTravelMax: [0, 20], bodyRadius: [0.005, 0.3], collisionAttachmentClearance: [0.02, 0.3] } as const;
  for (const key of Object.keys(numericOptions) as (keyof typeof numericOptions)[]) {
    if (s[key] !== undefined) result[key] = boundedNumber(s[key], `${label} ${key}`, numericOptions[key][0], numericOptions[key][1]);
  }
  if (s.loadedSides !== undefined) result.loadedSides = enumValue(s.loadedSides, `${label} loaded sides`, ['unilateral', 'bilateral'] as const);
  if (s.gripStyle !== undefined) result.gripStyle = enumValue(s.gripStyle, `${label} grip annotation`, ['supinated', 'neutral', 'pronated', 'ez'] as const);
  if (s.freeWeightKind !== undefined) result.freeWeightKind = enumValue(s.freeWeightKind, `${label} free-weight convention`, ['dumbbell', 'barbell', 'shared'] as const);
  if (s.rotationDirection !== undefined) result.rotationDirection = enumValue(s.rotationDirection, `${label} rotation direction`, ['pronation', 'supination'] as const);
  if (s.stackArrangement !== undefined) result.stackArrangement = enumValue(s.stackArrangement, `${label} stack arrangement`, ['independent', 'shared'] as const);
  if (s.outletPositions !== undefined) {
    if (!Array.isArray(s.outletPositions) || s.outletPositions.length < 1 || s.outletPositions.length > 2) throw new Error(`${label} requires one or two explicit cable outlet positions.`);
    result.outletPositions = s.outletPositions.map((point, i) => {
      if (!Array.isArray(point) || point.length !== 3) throw new Error(`${label} outlet ${i + 1} needs X, Y, and Z coordinates.`);
      return [boundedNumber(point[0], `${label} outlet X`, -10, 10), boundedNumber(point[1], `${label} outlet Y`, -10, 10), boundedNumber(point[2], `${label} outlet Z`, 0, 10)];
    });
  }
  if (s.obstacles !== undefined) {
    if (!Array.isArray(s.obstacles) || s.obstacles.length > 20) throw new Error(`${label} supports at most 20 obstacle shapes.`);
    const ids = new Set<string>();
    const vector = (value: unknown, name: string, min: number, max: number): [number, number, number] => {
      if (!Array.isArray(value) || value.length !== 3) throw new Error(`${name} requires three coordinates.`);
      return value.map(component => boundedNumber(component, name, min, max)) as [number, number, number];
    };
    result.obstacles = s.obstacles.map((value, i) => {
      const obstacle = object(value, `${label} obstacle ${i + 1}`), id = string(obstacle.id, 'Obstacle ID');
      if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) throw new Error('Obstacle IDs must be unique and use letters, digits, underscores or hyphens.');
      ids.add(id);
      const name = string(obstacle.name, 'Obstacle name', 120, 0), type = enumValue(obstacle.type, 'Obstacle type', ['box', 'capsule'] as const);
      const support = obstacle.allowBodyContact === undefined ? {} : { allowBodyContact: bool(obstacle.allowBodyContact, 'Intended body support contact') };
      return type === 'box'
        ? { id, name, type, ...support, center: vector(obstacle.center, 'Obstacle center', -10, 10), size: vector(obstacle.size, 'Obstacle size', .001, 20) }
        : { id, name, type, ...support, a: vector(obstacle.a, 'Obstacle endpoint A', -10, 10), b: vector(obstacle.b, 'Obstacle endpoint B', -10, 10), radius: boundedNumber(obstacle.radius, 'Obstacle radius', .001, 5) };
    });
  }
  if (s.equipmentLimits !== undefined) {
    const limits = object(s.equipmentLimits, `${label} equipment limits`);
    result.equipmentLimits = { pulleyMin: boundedNumber(limits.pulleyMin, 'Minimum pulley height', .01, 5), pulleyMax: boundedNumber(limits.pulleyMax, 'Maximum pulley height', .01, 5), distanceMin: boundedNumber(limits.distanceMin, 'Minimum equipment distance', -10, 10), distanceMax: boundedNumber(limits.distanceMax, 'Maximum equipment distance', -10, 10) };
    if (result.equipmentLimits.pulleyMin > result.equipmentLimits.pulleyMax || result.equipmentLimits.distanceMin > result.equipmentLimits.distanceMax) throw new Error('Equipment limit minima must not exceed their maxima.');
  }
  if (result.cableTravelMin !== undefined && result.cableTravelMax !== undefined && result.cableTravelMin > result.cableTravelMax) throw new Error(`${label} minimum cable travel must not exceed maximum travel.`);
  for (const key of ['slack', 'forceKnown', 'segmentGravity', 'bodyCollision', 'exploration'] as const) {
    if (s[key] !== undefined) result[key] = bool(s[key], `${label} ${key}`);
  }
  if ((result.resistance === 'dumbbell' || result.loadMode === 'mass') && result.loadMass === undefined) throw new Error(`${label} requires a selected load mass.`);
  // A selected stack mass without an explicit transmission remains a valid unknown force.
  if (result.segmentGravity) {
    if (['hip', 'hip-abduction', 'hip-adduction', 'knee-extension', 'knee-flexion'].includes(result.model ?? 'pullover')) {
      if (result.thighMass === undefined || result.shankMass === undefined) throw new Error(`${label} requires declared thigh and lower-leg masses for segment gravity.`);
    } else if (['wrist-flexion', 'wrist-extension', 'forearm-rotation'].includes(result.model ?? 'pullover')) {
      if (result.handMass === undefined) throw new Error(`${label} requires a declared moving hand mass for segment gravity.`);
    } else if (result.upperArmMass === undefined || result.forearmMass === undefined) throw new Error(`${label} requires declared upper-arm and forearm masses for segment gravity.`);
  }
  const definition = getDefinition(result);
  if (min < definition.minAngle || max > definition.maxAngle) throw new Error(`${label} movement range must remain within ${definition.minAngle}–${definition.maxAngle}${definition.angleUnit} for ${definition.label}.`);
  return result;
}

/** Known migrations only. The original is retained by loadState before any save. */
export function validateState(input: unknown): LabState {
  const s = object(input, 'Comparison');
  if (s.version !== 1) throw new Error('This comparison format is not supported (expected version 1).');
  if (s.modelVersion !== MODEL_VERSION && s.modelVersion !== 'pullover-1' && s.modelVersion !== 'biomechanics-2') throw new Error('This comparison uses another mechanics model. It has not been changed or migrated.');
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
  if (s.viewFraming !== undefined) {
    const frame = object(s.viewFraming, 'View framing');
    const pan = pair(frame.pan, 'View pan');
    result.viewFraming = { view: enumValue(frame.view, 'Drawing view', ['side', 'front', 'top'] as const), zoom: boundedNumber(frame.zoom, 'Drawing zoom', 0.5, 4), pan: [boundedNumber(pan[0], 'Horizontal drawing pan', -100, 100), boundedNumber(pan[1], 'Vertical drawing pan', -100, 100)] };
  }
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
    if (!EQUIPMENT_KEYS.every(key => JSON.stringify(equipmentValue(a, key)) === JSON.stringify(equipmentValue(b, key))) || a.transmissionFactor !== b.transmissionFactor) throw new Error('Same-equipment comparisons require matching pulley, attachment, bar, and backrest dimensions and transmission factors.');
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
