import { getDefinition, presets, type Model, type Setup } from "./engine";

/** Navigation metadata describes each preset's initial setup, not muscle recruitment. */
export type CatalogMetadata = {
  muscleGroups: readonly string[];
  equipment: readonly string[];
  mainJoint: "Shoulder" | "Elbow" | "Hip" | "Knee" | "Wrist" | "Forearm" | "Shoulder girdle";
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

/** Original reviewed metadata stays explicit; new entries derive from declared mechanics. */
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

type ModelNavigation = {
  muscleGroups: readonly string[];
  mainJoint: CatalogMetadata["mainJoint"];
  movement: string;
  aliases: readonly string[];
};

/** Exhaustive by model: adding a model requires declaring its navigation semantics. */
const modelNavigation: Record<Model, ModelNavigation> = {
  pullover: { muscleGroups: ["Lats / upper back"], mainJoint: "Shoulder", movement: "pullover", aliases: ["shoulder extension", "pullover"] },
  curl: { muscleGroups: ["Biceps / elbow flexors"], mainJoint: "Elbow", movement: "curl", aliases: ["elbow flexion", "biceps curl"] },
  extension: { muscleGroups: ["Triceps"], mainJoint: "Elbow", movement: "triceps extension", aliases: ["elbow extension", "tricep extension"] },
  raise: { muscleGroups: ["Deltoids"], mainJoint: "Shoulder", movement: "raise", aliases: ["shoulder raise", "arm elevation"] },
  fly: { muscleGroups: ["Chest / pectorals"], mainJoint: "Shoulder", movement: "fly", aliases: ["chest fly", "flye", "horizontal adduction"] },
  "reverse-fly": { muscleGroups: ["Deltoids", "Lats / upper back"], mainJoint: "Shoulder", movement: "reverse fly", aliases: ["reverse flye", "rear delt fly", "horizontal abduction"] },
  hip: { muscleGroups: ["Glutes / hip extensors"], mainJoint: "Hip", movement: "hip extension", aliases: ["hip extension", "kickback"] },
  "hip-abduction": { muscleGroups: ["Hip abductors"], mainJoint: "Hip", movement: "hip abduction", aliases: ["hip abduction", "lateral leg raise"] },
  "hip-adduction": { muscleGroups: ["Hip adductors"], mainJoint: "Hip", movement: "hip adduction", aliases: ["hip adduction", "leg adduction"] },
  "knee-extension": { muscleGroups: ["Quadriceps"], mainJoint: "Knee", movement: "leg extension", aliases: ["knee extension", "leg extension"] },
  "knee-flexion": { muscleGroups: ["Hamstrings"], mainJoint: "Knee", movement: "leg curl", aliases: ["knee flexion", "leg curl"] },
  "wrist-flexion": { muscleGroups: ["Forearm flexors"], mainJoint: "Wrist", movement: "wrist curl", aliases: ["wrist flexion", "wrist curl"] },
  "wrist-extension": { muscleGroups: ["Forearm extensors"], mainJoint: "Wrist", movement: "wrist extension", aliases: ["wrist extension", "reverse wrist curl"] },
  "forearm-rotation": { muscleGroups: ["Forearm rotators"], mainJoint: "Forearm", movement: "forearm rotation", aliases: ["forearm rotation", "offset handle rotation"] },
  shrug: { muscleGroups: ["Upper trapezius / shoulder girdle"], mainJoint: "Shoulder girdle", movement: "shrug", aliases: ["shrug", "shoulder girdle elevation"] },
  machine: { muscleGroups: ["Lats / upper back"], mainJoint: "Shoulder", movement: "pullover machine", aliases: ["pullover machine", "unknown mechanism"] },
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** Equipment/pose tags are model declarations; grip tags never change muscle-group labels. */
export function metadataForSetup(setup: Setup): CatalogMetadata {
  const model = setup.model ?? "pullover";
  const base = modelNavigation[model];
  if (!base) throw new Error(`Missing navigation metadata for model ${model}.`);
  const legModel = ["hip", "hip-abduction", "hip-adduction", "knee-extension", "knee-flexion"].includes(model);
  const bilateral = !legModel && (setup.loadedSides === "bilateral"
    || (setup.loadedSides !== "unilateral" && (["pullover", "machine", "fly", "reverse-fly", "shrug"].includes(model)
      || (["curl", "extension", "raise"].includes(model) && setup.cables === 2))));
  const resistance = setup.resistance ?? (model === "machine" ? "unknown" : "cable");
  const equipment: string[] = [];
  let loadName = "";
  if (model === "machine") equipment.push("Dedicated machine");
  else if (resistance === "unknown") equipment.push("Unspecified resistance");
  else if (resistance === "dumbbell") {
    loadName = setup.freeWeightKind === "barbell" ? "barbell" : setup.freeWeightKind === "shared" ? "shared implement" : "dumbbell";
    equipment.push(loadName === "barbell" ? "Barbell" : loadName === "shared implement" ? "Single shared implement" : "Dumbbell");
    if (loadName === "barbell") equipment.push("Bar");
  } else {
    loadName = "cable";
    equipment.push("Cable", legModel ? "Ankle attachment" : model === "pullover" ? "Bar"
      : model === "forearm-rotation" ? "Offset handle" : bilateral ? "Two independent handles" : "Single handle");
  }
  const posture = setup.posture ?? (setup.kind === "bench" ? setup.tilt === 0 ? "supine" : "seated" : "standing");
  const postureLabels: Record<NonNullable<Setup["posture"]>, readonly string[]> = {
    standing: ["Standing"], kneeling: ["Kneeling"], seated: ["Seated"],
    supine: ["Lying", "Supine"], prone: ["Lying", "Prone"], "side-lying": ["Lying", "Side lying"],
  };
  const postures = [...postureLabels[posture]];
  if (setup.kind === "bench") {
    equipment.push("Bench"); postures.push("Bench supported");
    if (setup.tilt > 0 && setup.tilt < 90 && !["prone", "side-lying"].includes(posture)) postures.push("Reclined");
  }
  if (model === "raise" && posture === "standing" && Math.abs(setup.bodyRoll ?? setup.tilt) > 1e-6) {
    postures.push("Supported lean"); equipment.push("External support");
  } else if (["standing", "kneeling"].includes(posture) && Math.abs(setup.tilt) > 1e-6) {
    postures.push(setup.tilt > 0 ? "Forward lean" : "Backward lean");
  }
  let movement = base.movement;
  const aliases = [setup.name, setup.preset, setup.preset.replace(/-/g, " "), ...base.aliases];
  if (model === "raise") {
    const plane = setup.movementPlane ?? 0;
    if (Math.abs(plane) < 1e-6) { movement = "lateral raise"; aliases.push("side raise", "shoulder abduction"); }
    else if (Math.abs(plane - 90) < 1e-6) { movement = "front raise"; aliases.push("shoulder flexion"); }
    else if (plane >= 20 && plane <= 50) { movement = "scaption"; aliases.push("scapular plane raise"); }
    else { movement = "oblique-plane raise"; aliases.push(`shoulder raise plane ${plane} degrees`); }
  }
  if (model === "curl") {
    if ((setup.upperArmAngle ?? 0) < -5) {
      aliases.push("behind-body curl", "upper arm behind torso curl");
      if (resistance === "cable") aliases.push("Bayesian cable curl");
    } else if ((setup.upperArmAngle ?? 0) > 5) aliases.push("upper arm in front curl");
  }
  if (model === "extension" && (setup.upperArmAngle ?? 0) >= 150) aliases.push("overhead triceps extension");
  if (setup.gripStyle) {
    const grips = { neutral: "neutral grip", supinated: "supinated grip", pronated: "pronated grip", ez: "EZ bar grip" };
    aliases.push(grips[setup.gripStyle]);
    if (model === "curl") {
      if (setup.gripStyle === "neutral") aliases.push("hammer curl");
      if (setup.gripStyle === "pronated") aliases.push("reverse curl");
      if (setup.gripStyle === "ez") aliases.push("EZ bar curl");
    }
  }
  if (model === "forearm-rotation" && setup.rotationDirection) aliases.push(`forearm ${setup.rotationDirection}`);
  aliases.push(movement);
  if (loadName) aliases.push(`${loadName} ${movement}`, `${posture} ${loadName} ${movement}`);
  const loadUnknown = resistance === "unknown"
    || (resistance === "dumbbell" && setup.loadMass === undefined)
    || (resistance === "cable" && !setup.slack && (setup.forceKnown === false
      || (setup.loadMode === "mass" && (setup.loadMass === undefined || setup.transmissionFactor === undefined))));
  const requiredSegmentMasses = legModel ? [setup.thighMass, setup.shankMass]
    : ["wrist-flexion", "wrist-extension", "forearm-rotation"].includes(model) ? [setup.handMass]
      : [setup.upperArmMass, setup.forearmMass];
  const segmentMassUnknown = setup.segmentGravity && requiredSegmentMasses.some((mass) => mass === undefined);
  return {
    muscleGroups: [...base.muscleGroups], equipment: unique(equipment), mainJoint: base.mainJoint,
    postures: unique(postures), laterality: bilateral ? "Bilateral" : "Unilateral",
    status: model === "machine" || loadUnknown || segmentMassUnknown ? "Geometry only" : "External mechanics",
    aliases: unique(aliases),
  };
}

for (const setup of presets) {
  const metadata = catalogMetadata[setup.preset] ?? metadataForSetup(setup);
  catalogMetadata[setup.preset] = { ...metadata, aliases: unique([...metadata.aliases, setup.name, setup.preset]) };
}

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
