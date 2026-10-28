import { getDefinition, presets, type Setup } from "./engine";

/** Navigation metadata describes each preset's initial setup, not muscle recruitment. */
export type CatalogMetadata = {
  muscleGroups: readonly string[];
  equipment: readonly string[];
  mainJoint: "Shoulder" | "Elbow" | "Hip";
  postures: readonly string[];
  laterality: "Unilateral" | "Bilateral";
  status: "External mechanics" | "Geometry only";
  aliases: readonly string[];
};
export type CatalogEntry = CatalogMetadata & { setup: Setup; family: string };
export type CatalogFilters = {
  muscleGroup: string;
  equipment: string;
  mainJoint: string;
  posture: string;
  laterality: string;
  status: string;
};
export const emptyCatalogFilters: CatalogFilters = {
  muscleGroup: "all",
  equipment: "all",
  mainJoint: "all",
  posture: "all",
  laterality: "all",
  status: "all",
};

const pullover: Omit<CatalogMetadata, "aliases"> = {
  muscleGroups: ["Lats / upper back"],
  equipment: ["Cable", "Bar"],
  mainJoint: "Shoulder",
  postures: ["Standing"],
  laterality: "Bilateral",
  status: "External mechanics",
};
const curl: Omit<CatalogMetadata, "aliases"> = {
  muscleGroups: ["Biceps / elbow flexors"],
  equipment: ["Cable", "Single handle"],
  mainJoint: "Elbow",
  postures: ["Standing"],
  laterality: "Unilateral",
  status: "External mechanics",
};
const extension: Omit<CatalogMetadata, "aliases"> = {
  ...curl,
  muscleGroups: ["Triceps"],
};
const raise: Omit<CatalogMetadata, "aliases"> = {
  muscleGroups: ["Deltoids"],
  equipment: ["Cable", "Single handle"],
  mainJoint: "Shoulder",
  postures: ["Standing"],
  laterality: "Unilateral",
  status: "External mechanics",
};

/** Explicit per-preset metadata: new presets must declare their catalog behavior. */
export const catalogMetadata: Record<string, CatalogMetadata> = {
  classic: {
    ...pullover,
    postures: ["Standing", "Forward lean"],
    aliases: ["lat prayer", "straight-arm pulldown", "standing cable pullover", "horizontal torso pullover"],
  },
  bench: {
    ...pullover,
    equipment: ["Cable", "Bar", "Bench"],
    postures: ["Seated", "Bench supported", "Reclined"],
    aliases: ["incline pullover", "bench supported pullover", "60 degree pullover", "incline lat prayer"],
  },
  "classic-far": {
    ...pullover,
    postures: ["Standing", "Forward lean"],
    aliases: ["lat prayer", "straight-arm pulldown", "distant pulley pullover", "far standing pullover"],
  },
  outside: {
    ...pullover,
    aliases: ["outside cable pullover", "standing pullover facing away", "dual cable pullover", "back to pulleys"],
  },
  inside: {
    ...pullover,
    postures: ["Standing", "Forward lean"],
    aliases: ["inside cable pullover", "leaning lat prayer", "shoulders behind pulley plane", "60 degree torso"],
  },
  "inside-upright": {
    ...pullover,
    aliases: ["inside cable pullover", "upright pullover", "bar behind pulleys", "mechanical assistance example"],
  },
  "bench-flat": {
    ...pullover,
    equipment: ["Cable", "Bar", "Bench"],
    postures: ["Lying", "Bench supported"],
    aliases: ["lying cable pullover", "supine pullover", "flat bench pullover"],
  },
  "bench-75": {
    ...pullover,
    equipment: ["Cable", "Bar", "Bench"],
    postures: ["Seated", "Bench supported", "Reclined"],
    aliases: ["incline pullover", "75 degree pullover", "high incline bench pullover"],
  },
  "classic-kneeling": {
    ...pullover,
    postures: ["Kneeling", "Forward lean"],
    aliases: ["kneeling lat prayer", "kneeling straight-arm pulldown", "kneeling cable pullover"],
  },
  "curl-low": {
    ...curl,
    aliases: ["biceps curl", "standing cable curl", "low pulley curl", "single-arm cable curl"],
  },
  "curl-bayesian": {
    ...curl,
    aliases: ["Bayesian cable curl", "behind-body curl", "behind the back curl", "biceps curl", "shoulder extended curl"],
  },
  "extension-pushdown": {
    ...extension,
    aliases: ["triceps pressdown", "cable press-down", "tricep pushdown", "high pulley extension", "single-arm pushdown"],
  },
  "extension-overhead": {
    ...extension,
    aliases: ["overhead triceps extension", "overhead cable extension", "French press", "tricep overhead extension"],
  },
  "raise-cable": {
    ...raise,
    aliases: ["cable side raise", "single-arm lateral raise", "shoulder abduction", "side delt raise"],
  },
  "raise-dumbbell": {
    ...raise,
    equipment: ["Dumbbell", "External support"],
    postures: ["Standing", "Supported lean"],
    aliases: ["lean-away lateral raise", "dumbbell side raise", "supported shoulder abduction", "side delt raise"],
  },
  "fly-cable": {
    muscleGroups: ["Chest / pectorals"],
    equipment: ["Cable", "Two independent handles"],
    mainJoint: "Shoulder",
    postures: ["Standing"],
    laterality: "Bilateral",
    status: "External mechanics",
    aliases: ["cable chest fly", "cable flye", "cable crossover", "pec fly", "horizontal adduction"],
  },
  "hip-extension": {
    muscleGroups: ["Glutes / hip extensors"],
    equipment: ["Cable", "Ankle attachment"],
    mainJoint: "Hip",
    postures: ["Standing"],
    laterality: "Unilateral",
    status: "External mechanics",
    aliases: ["cable kickback", "glute kickback", "standing hip extension", "ankle cuff kickback"],
  },
  "machine-unknown": {
    ...pullover,
    equipment: ["Dedicated machine"],
    postures: ["Seated", "Bench supported"],
    status: "Geometry only",
    aliases: ["pullover machine", "lat machine pullover", "unknown cam mechanism", "machine illustration"],
  },
};

export const catalogEntries: CatalogEntry[] = presets.map((setup) => {
  const metadata = catalogMetadata[setup.preset];
  if (!metadata) throw new Error(`Missing catalog metadata for preset ${setup.preset}.`);
  return { ...metadata, setup, family: getDefinition(setup).family };
});

function normalize(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesCatalog(entry: CatalogEntry, query: string, filters: CatalogFilters): boolean {
  if (filters.muscleGroup !== "all" && !entry.muscleGroups.includes(filters.muscleGroup)) return false;
  if (filters.equipment !== "all" && !entry.equipment.includes(filters.equipment)) return false;
  if (filters.mainJoint !== "all" && entry.mainJoint !== filters.mainJoint) return false;
  if (filters.posture !== "all" && !entry.postures.includes(filters.posture)) return false;
  if (filters.laterality !== "all" && entry.laterality !== filters.laterality) return false;
  if (filters.status !== "all" && entry.status !== filters.status) return false;
  const terms = normalize(query).split(" ").filter(Boolean);
  const text = normalize([entry.setup.name, entry.family, getDefinition(entry.setup).angleLabel, ...entry.aliases, ...entry.muscleGroups, ...entry.equipment, entry.mainJoint, ...entry.postures, entry.laterality, entry.status].join(" "));
  return terms.every((term) => text.includes(term));
}
