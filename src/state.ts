import {
  defaultProfile,
  presets,
  MODEL_VERSION,
  type Profile,
  type Setup,
} from "./engine";

export { MODEL_VERSION } from "./engine";
export const STORAGE_KEY = "exercise-biomechanics-lab.comparison.v1";
// Demonstration proportions, not a population-derived anthropometric prediction.
// Height scales the handoff's example; every inferred segment stays editable.
export const REFERENCE_MODEL = "handoff-illustrative-proportions-v1";
export const PROFILE_KEYS = [
  "height",
  "upperArm",
  "forearm",
  "hand",
  "torso",
  "shoulderWidth",
] as const;
export type Provenance = "example" | "estimated" | "measured";
export type BodyProfile = {
  values: Profile;
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
  sync: "angle" | "progress" | "independent";
  lockBody: boolean;
  lockForce: boolean;
};

export function createBodyProfile(): BodyProfile {
  return {
    values: { ...defaultProfile },
    provenance: Object.fromEntries(
      PROFILE_KEYS.map((key) => [key, "example"]),
    ) as BodyProfile["provenance"],
    locked: Object.fromEntries(
      PROFILE_KEYS.map((key) => [key, false]),
    ) as BodyProfile["locked"],
    referenceModel: REFERENCE_MODEL,
  };
}

export function createInitialState(): LabState {
  const a = structuredClone(
    presets.find((p) => p.preset === "classic") ?? presets[0],
  );
  const b = structuredClone(
    presets.find((p) => p.preset === "bench") ?? presets[1],
  );
  const angle = clamp(
    160,
    Math.max(a.range[0], b.range[0]),
    Math.min(a.range[1], b.range[1]),
  );
  return {
    version: 1,
    modelVersion: MODEL_VERSION,
    name: "Pullover · first comparison",
    setups: [a, b],
    profiles: [createBodyProfile(), createBodyProfile()],
    angles: [angle, angle],
    sync: "angle",
    lockBody: true,
    lockForce: false,
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function sharedRange(state: LabState): [number, number] | null {
  const min = Math.max(state.setups[0].range[0], state.setups[1].range[0]);
  const max = Math.min(state.setups[0].range[1], state.setups[1].range[1]);
  return min <= max ? [min, max] : null;
}

export function setAngle(
  state: LabState,
  index: 0 | 1,
  angle: number,
): LabState {
  if (!Number.isFinite(angle))
    throw new Error("Enter a finite movement angle.");
  const angles: [number, number] = [...state.angles];
  const range = state.setups[index].range;
  if (state.sync === "angle") {
    const shared = sharedRange(state);
    if (!shared)
      throw new Error(
        "These movement ranges do not overlap. Choose independent positions.",
      );
    const q = clamp(angle, shared[0], shared[1]);
    return { ...state, angles: [q, q] };
  }
  const q = clamp(angle, range[0], range[1]);
  angles[index] = q;
  if (state.sync === "progress") {
    // Reference action lowers elevation: progress 0 = range maximum.
    const progress = (range[1] - q) / (range[1] - range[0]);
    const other: 0 | 1 = index === 0 ? 1 : 0;
    const otherRange = state.setups[other].range;
    angles[other] = otherRange[1] - progress * (otherRange[1] - otherRange[0]);
  }
  return { ...state, angles };
}

export function changeHeight(
  profile: BodyProfile,
  height: number,
): BodyProfile {
  boundedNumber(height, "Height", ...PROFILE_BOUNDS.height);
  const next = structuredClone(profile);
  next.values.height = height;
  next.provenance.height = "measured";
  for (const key of PROFILE_KEYS) {
    if (
      key === "height" ||
      next.provenance[key] === "measured" ||
      next.locked[key]
    )
      continue;
    next.values[key] = (defaultProfile[key] * height) / defaultProfile.height;
    next.provenance[key] = "estimated";
  }
  return next;
}

export function editMeasurement(
  profile: BodyProfile,
  key: keyof Profile,
  value: number,
): BodyProfile {
  if (key === "height") return changeHeight(profile, value);
  boundedNumber(value, key, ...PROFILE_BOUNDS[key]);
  return {
    ...profile,
    values: { ...profile.values, [key]: value },
    provenance: { ...profile.provenance, [key]: "measured" },
  };
}

const PROFILE_BOUNDS: Record<keyof Profile, [number, number]> = {
  height: [0.8, 2.5],
  upperArm: [0.1, 0.8],
  forearm: [0.08, 0.7],
  hand: [0.02, 0.3],
  torso: [0.2, 1.2],
  shoulderWidth: [0.15, 1],
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function boundedNumber(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(
      `${label} must be a finite number between ${min} and ${max}.`,
    );
  return value;
}
function string(value: unknown, label: string, max = 120, min = 1): string {
  if (typeof value !== "string" || value.length < min || value.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return value;
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`${label} must be true or false.`);
  return value;
}
function pair(value: unknown, label: string): [unknown, unknown] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new Error(`${label} must contain exactly two entries.`);
  return value as [unknown, unknown];
}
function enumValue<T extends string | number>(
  value: unknown,
  label: string,
  options: readonly T[],
): T {
  if (!options.includes(value as T))
    throw new Error(`${label} is not supported.`);
  return value as T;
}

function validateProfile(input: unknown, label: string): BodyProfile {
  const p = object(input, label);
  const values = object(p.values, `${label} dimensions`);
  const provenance = object(p.provenance, `${label} provenance`);
  const locked = object(p.locked, `${label} locks`);
  const result = createBodyProfile();
  result.referenceModel = enumValue(
    p.referenceModel,
    `${label} reference model`,
    [REFERENCE_MODEL],
  );
  for (const key of PROFILE_KEYS) {
    result.values[key] = boundedNumber(
      values[key],
      `${label} ${key}`,
      ...PROFILE_BOUNDS[key],
    );
    result.provenance[key] = enumValue(
      provenance[key],
      `${label} ${key} provenance`,
      ["example", "estimated", "measured"],
    );
    result.locked[key] = bool(locked[key], `${label} ${key} lock`);
  }
  return result;
}

function validateSetup(input: unknown, label: string): Setup {
  const s = object(input, label);
  const range = pair(s.range, `${label} movement range`);
  const min = boundedNumber(range[0], `${label} minimum elevation`, 0, 200);
  const max = boundedNumber(range[1], `${label} maximum elevation`, 0, 200);
  if (min >= max)
    throw new Error(
      `${label} movement range must have its minimum below its maximum.`,
    );
  const kind = enumValue(s.kind, `${label} posture`, ["standing", "bench"]);
  return {
    preset: string(s.preset, `${label} preset`),
    name: string(s.name, `${label} name`),
    kind,
    facing: enumValue(s.facing, `${label} facing direction`, [-1, 1]),
    tilt: boundedNumber(
      s.tilt,
      `${label} inclination`,
      kind === "bench" ? 0 : -30,
      90,
    ),
    hipX: boundedNumber(s.hipX, `${label} pelvis horizontal position`, -5, 5),
    hipHeight: boundedNumber(s.hipHeight, `${label} pelvis height`, 0.1, 2.5),
    pulleyHeight: boundedNumber(
      s.pulleyHeight,
      `${label} pulley height`,
      0.01,
      5,
    ),
    outletSpacing: boundedNumber(
      s.outletSpacing,
      `${label} outlet spacing`,
      0,
      5,
    ),
    attachmentSpacing: boundedNumber(
      s.attachmentSpacing,
      `${label} attachment spacing`,
      0,
      3,
    ),
    cables: enumValue(s.cables, `${label} cable count`, [1, 2]),
    tension: boundedNumber(s.tension, `${label} force per cable`, 0, 2000),
    elbow: boundedNumber(s.elbow, `${label} elbow flexion`, 0, 120),
    backLength: boundedNumber(s.backLength, `${label} backrest length`, 0.1, 2),
    backWidth: boundedNumber(s.backWidth, `${label} backrest width`, 0.1, 1.5),
    backThickness: boundedNumber(
      s.backThickness,
      `${label} backrest thickness`,
      0.01,
      0.5,
    ),
    range: [min, max],
  };
}

/** Parse a portable snapshot without evaluating imported content or retaining unknown fields. */
export function validateState(input: unknown): LabState {
  const s = object(input, "Comparison");
  if (s.version !== 1)
    throw new Error(
      "This comparison format is not supported (expected version 1).",
    );
  if (s.modelVersion !== MODEL_VERSION)
    throw new Error(
      "This comparison uses another mechanics model. It has not been changed or migrated.",
    );
  const setups = pair(s.setups, "Setups");
  const profiles = pair(s.profiles, "Body profiles");
  const angles = pair(s.angles, "Movement angles");
  const result: LabState = {
    // A temporarily empty draft name must remain saveable while the user types.
    version: 1,
    modelVersion: MODEL_VERSION,
    name: string(s.name, "Comparison name", 120, 0),
    setups: [validateSetup(setups[0], "A"), validateSetup(setups[1], "B")],
    profiles: [
      validateProfile(profiles[0], "A"),
      validateProfile(profiles[1], "B"),
    ],
    angles: [
      boundedNumber(angles[0], "A elevation", 0, 200),
      boundedNumber(angles[1], "B elevation", 0, 200),
    ],
    sync: enumValue(s.sync, "Movement synchronization", [
      "angle",
      "progress",
      "independent",
    ]),
    lockBody: bool(s.lockBody, "Body synchronization"),
    lockForce: bool(s.lockForce, "Force synchronization"),
  };
  for (const i of [0, 1] as const) {
    const range = result.setups[i].range;
    if (result.angles[i] < range[0] || result.angles[i] > range[1])
      throw new Error(
        `${i === 0 ? "A" : "B"} elevation is outside its movement range.`,
      );
  }
  if (
    result.sync === "angle" &&
    (!sharedRange(result) ||
      Math.abs(result.angles[0] - result.angles[1]) > 1e-6)
  )
    throw new Error(
      "Same-angle comparisons require overlapping ranges and equal elevations.",
    );
  if (result.sync === "progress") {
    const progress = result.setups.map(
      (setup, i) =>
        (setup.range[1] - result.angles[i]) / (setup.range[1] - setup.range[0]),
    );
    if (Math.abs(progress[0] - progress[1]) > 1e-6)
      throw new Error(
        "Equal-progress comparisons require matching movement progress.",
      );
  }
  if (
    result.lockForce &&
    Math.abs(result.setups[0].tension - result.setups[1].tension) > 1e-9
  )
    throw new Error(
      "Same-force comparisons require equal tension per cable in A and B.",
    );
  if (result.lockBody) {
    const [a, b] = result.profiles;
    const matching =
      a.referenceModel === b.referenceModel &&
      PROFILE_KEYS.every(
        (key) =>
          a.values[key] === b.values[key] &&
          a.provenance[key] === b.provenance[key] &&
          a.locked[key] === b.locked[key],
      );
    if (!matching)
      throw new Error(
        "Same-body comparisons require matching dimensions, provenance, and locks in A and B.",
      );
  }
  return result;
}

export function loadState(): { state: LabState; error: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { state: createInitialState(), error: null };
    if (saved.length > 1_000_000)
      throw new Error("The saved comparison exceeds the 1 MB size limit.");
    return { state: validateState(JSON.parse(saved)), error: null };
  } catch (error) {
    return {
      state: createInitialState(),
      error: `The saved comparison could not be restored. ${error instanceof Error ? error.message : "Storage is unavailable."}`,
    };
  }
}

export function saveState(state: LabState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validateState(state)));
    return true;
  } catch {
    return false;
  }
}
