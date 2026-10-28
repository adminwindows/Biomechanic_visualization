import { describe, expect, it } from "vitest";
import { definitions, presets, type Model, type Setup } from "./engine";
import { catalogEntries, catalogMetadata, emptyCatalogFilters, matchesCatalog, metadataForSetup } from "./catalog";
import { allExerciseEntries, matchesExercise } from './allExercises';

const base = presets.find((preset) => preset.preset === "curl-low")!;
const setupFor = (model: Model, patch: Partial<Setup> = {}): Setup => ({ ...base, preset: `test-${model}`, name: "A declared example", model, ...patch });

describe("catalog metadata derived from declared models", () => {
  it("provides metadata and searchable actual name/id for every registered preset", () => {
    expect(catalogEntries).toHaveLength(presets.length);
    for (const setup of presets) {
      const metadata = catalogMetadata[setup.preset];
      expect(metadata).toBeDefined();
      expect(metadata.aliases).toContain(setup.name);
      expect(metadata.aliases).toContain(setup.preset);
      expect(metadata.mainJoint).toBeTruthy();
      expect(metadata.equipment.length).toBeGreaterThan(0);
      expect(metadata.postures.length).toBeGreaterThan(0);
    }
  });

  it("retains the original reviewed preset metadata and aliases", () => {
    expect(catalogMetadata.classic).toMatchObject({ equipment: ["Cable", "Bar"], laterality: "Bilateral", postures: ["Standing", "Forward lean"] });
    expect(catalogMetadata.classic.aliases).toContain("lat prayer");
    expect(catalogMetadata.bench.aliases).toContain("60 degree pullover");
    expect(catalogMetadata["machine-unknown"].status).toBe("Geometry only");
  });

  it("has explicit navigation semantics for every model including distal joints", () => {
    for (const definition of definitions) expect(metadataForSetup(setupFor(definition.id)).mainJoint).toBeTruthy();
    expect(metadataForSetup(setupFor("knee-extension")).mainJoint).toBe("Knee");
    expect(metadataForSetup(setupFor("wrist-extension")).mainJoint).toBe("Wrist");
    expect(metadataForSetup(setupFor("forearm-rotation")).mainJoint).toBe("Forearm");
    expect(metadataForSetup(setupFor("shrug")).mainJoint).toBe("Shoulder girdle");
  });

  it("uses declared equipment and loading instead of guessing from a name", () => {
    const namedIncorrectly = setupFor("curl", { name: "Cable machine bench curl", resistance: "dumbbell", freeWeightKind: "barbell", loadMass: 20, loadedSides: "bilateral", kind: "standing", posture: "standing" });
    const metadata = metadataForSetup(namedIncorrectly);
    expect(metadata.equipment).toEqual(["Barbell", "Bar"]);
    expect(metadata.equipment).not.toContain("Cable");
    expect(metadata.equipment).not.toContain("Bench");
    expect(metadata.laterality).toBe("Bilateral");
    expect(metadata.aliases).toContain("barbell curl");
    const shared = metadataForSetup({ ...namedIncorrectly, freeWeightKind: "shared" });
    expect(shared.equipment).toEqual(["Single shared implement"]);
    expect(shared.equipment).not.toContain("Dumbbell");
  });

  it("distinguishes lateral, front and scapular-plane raises from the actual plane", () => {
    const lateral = metadataForSetup(setupFor("raise", { movementPlane: 0 }));
    const front = metadataForSetup(setupFor("raise", { movementPlane: 90 }));
    const scaption = metadataForSetup(setupFor("raise", { movementPlane: 30 }));
    expect(lateral.aliases).toContain("cable lateral raise");
    expect(lateral.aliases).toContain("shoulder abduction");
    expect(front.aliases).toContain("cable front raise");
    expect(front.aliases).not.toContain("shoulder abduction");
    expect(scaption.aliases).toContain("cable scaption");
    expect(scaption.aliases).toContain("scapular plane raise");
    expect(metadataForSetup(setupFor("raise", { movementPlane: -90 })).aliases).not.toContain("cable front raise");
  });

  it("treats grip style as an annotation without inventing muscle recruitment changes", () => {
    const neutral = metadataForSetup(setupFor("curl", { gripStyle: "neutral" }));
    const pronated = metadataForSetup(setupFor("curl", { gripStyle: "pronated" }));
    const supinated = metadataForSetup(setupFor("curl", { gripStyle: "supinated" }));
    expect(neutral.aliases).toContain("hammer curl");
    expect(pronated.aliases).toContain("reverse curl");
    expect(supinated.aliases).toContain("supinated grip");
    expect(neutral.muscleGroups).toEqual(supinated.muscleGroups);
    expect(pronated.muscleGroups).toEqual(supinated.muscleGroups);
  });

  it("uses actual posture and humeral placement for supported variation tags", () => {
    const prone = metadataForSetup(setupFor("curl", { kind: "bench", posture: "prone", tilt: 30, upperArmAngle: 60 }));
    expect(prone.postures).toEqual(["Lying", "Prone", "Bench supported"]);
    expect(prone.aliases).toContain("upper arm in front curl");
    const behind = metadataForSetup(setupFor("curl", { upperArmAngle: -35 }));
    expect(behind.aliases).toContain("Bayesian cable curl");
    expect(metadataForSetup(setupFor("curl", { upperArmAngle: -35, resistance: "dumbbell", loadMass: 5 })).aliases).not.toContain("Bayesian cable curl");
    expect(metadataForSetup(setupFor("extension", { upperArmAngle: 180 })).aliases).toContain("overhead triceps extension");
    expect(metadataForSetup(setupFor("raise", { posture: "side-lying", kind: "bench" })).postures).toContain("Side lying");
  });

  it("describes independent handles and unilateral leg attachments accurately", () => {
    expect(metadataForSetup(setupFor("fly", { loadedSides: "unilateral" }))).toMatchObject({ laterality: "Unilateral", equipment: ["Cable", "Single handle"] });
    expect(metadataForSetup(setupFor("reverse-fly", { loadedSides: "bilateral" }))).toMatchObject({ laterality: "Bilateral", equipment: ["Cable", "Two independent handles"] });
    expect(metadataForSetup(setupFor("hip-abduction", { loadedSides: "bilateral" }))).toMatchObject({ laterality: "Unilateral", equipment: ["Cable", "Ankle attachment"] });
    expect(metadataForSetup(setupFor("forearm-rotation"))).toMatchObject({ mainJoint: "Forearm", equipment: ["Cable", "Offset handle"] });
  });

  it("keeps pronation and supination aliases tied to the declared direction", () => {
    const pronation = metadataForSetup(setupFor("forearm-rotation", { rotationDirection: "pronation" }));
    const supination = metadataForSetup(setupFor("forearm-rotation", { rotationDirection: "supination" }));
    expect(pronation.aliases).toContain("forearm pronation");
    expect(pronation.aliases).not.toContain("forearm supination");
    expect(supination.aliases).toContain("forearm supination");
  });

  it("marks missing load information as geometric without discarding known dumbbell loading", () => {
    expect(metadataForSetup(setupFor("curl", { forceKnown: false })).status).toBe("Geometry only");
    expect(metadataForSetup(setupFor("curl", { loadMode: "mass", loadMass: 20, transmissionFactor: undefined })).status).toBe("Geometry only");
    expect(metadataForSetup(setupFor("curl", { resistance: "dumbbell", loadMass: 5, forceKnown: false })).status).toBe("External mechanics");
    expect(metadataForSetup(setupFor("curl", { resistance: "dumbbell", loadMass: undefined })).status).toBe("Geometry only");
    expect(metadataForSetup(setupFor("wrist-flexion", { segmentGravity: true, handMass: undefined })).status).toBe("Geometry only");
    expect(metadataForSetup(setupFor("wrist-flexion", { segmentGravity: true, handMass: 0.4 })).status).toBe("External mechanics");
  });

  it("supports joint filtering and exact preset search for derived entries", () => {
    const setup = setupFor("wrist-flexion", { preset: "custom-wrist-example", name: "Custom wrist example" });
    const entry = { ...metadataForSetup(setup), setup, family: "Wrist flexion" };
    expect(matchesCatalog(entry, "custom-wrist-example", { ...emptyCatalogFilters, mainJoint: "Wrist" })).toBe(true);
    expect(matchesCatalog(entry, "custom-wrist-example", { ...emptyCatalogFilters, mainJoint: "Elbow" })).toBe(false);
  });
  it('finds compound exercises by their declared posture and support', () => {
    const entry = (id: string) => allExerciseEntries.find(item => item.id === `compound:${id}`)!;
    expect(matchesExercise(entry('row-standing'), 'row', { ...emptyCatalogFilters, posture: 'Standing' })).toBe(true);
    expect(matchesExercise(entry('row-seated'), 'row', { ...emptyCatalogFilters, posture: 'Standing' })).toBe(false);
    expect(matchesExercise(entry('row-seated'), 'row', { ...emptyCatalogFilters, posture: 'Seated' })).toBe(true);
    expect(entry('bench-barbell').postures).toEqual(['Lying', 'Supine', 'Bench supported']);
    expect(entry('row-supported').postures).toContain('Prone');
    expect(entry('pulldown-unilateral').postures).toContain('Kneeling');
    expect(entry('nordic').postures).toContain('Kneeling');
    expect(entry('pullup-neutral').postures).toContain('Hanging');
    expect(entry('calf-legpress').postures).toContain('Reclined');
    expect(allExerciseEntries.filter(item => item.source === 'compound').every(item => !item.postures.includes('Prescribed movement'))).toBe(true);
  });
});
