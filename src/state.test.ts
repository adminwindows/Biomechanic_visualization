import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeHeight,
  createInitialState,
  editMeasurement,
  loadState,
  MODEL_VERSION,
  saveState,
  setAngle,
  sharedRange,
  STORAGE_KEY,
  validateState,
  regenerateEstimates,
  parseComparison,
  forceValue,
} from "./state";

afterEach(() => vi.unstubAllGlobals());

describe("portable comparisons", () => {
  it("round-trips independent setup and profile snapshots, provenance and locks", () => {
    const state = createInitialState();
    state.profiles[0] = editMeasurement(state.profiles[0], "upperArm", 0.37);
    state.profiles[0].locked.torso = true;
    state.lockBody = false;
    state.setups[1].pulleyHeight = 1.73;
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
  it.each([
    (s: ReturnType<typeof createInitialState>) => {
      s.version = 2 as 1;
    },
    (s: ReturnType<typeof createInitialState>) => {
      s.modelVersion = "future-model";
    },
    (s: ReturnType<typeof createInitialState>) => {
      s.setups[0].tension = Infinity;
    },
    (s: ReturnType<typeof createInitialState>) => {
      s.profiles[0].values.upperArm = NaN;
    },
    (s: ReturnType<typeof createInitialState>) => {
      s.setups[0].range = [100, 100];
    },
    (s: ReturnType<typeof createInitialState>) => {
      s.angles[0] = -1;
    },
  ])("rejects malformed, nonfinite or unsupported data", (mutate) => {
    const state = createInitialState();
    mutate(state);
    expect(() => validateState(state)).toThrow();
  });
  it("does not retain unknown imported properties", () => {
    const state = createInitialState();
    const parsed = validateState({ ...state, executable: "alert(1)" });
    expect(parsed).not.toHaveProperty("executable");
    expect(parsed.modelVersion).toBe(MODEL_VERSION);
  });
  it("allows a temporarily empty comparison name without breaking saving or export", () => {
    const state = createInitialState();
    state.name = "";
    expect(validateState(JSON.parse(JSON.stringify(state))).name).toBe("");
    state.name = "x".repeat(121);
    expect(() => validateState(state)).toThrow("Comparison name");
  });
  it("rejects inconsistent body or force synchronization locks", () => {
    const body = createInitialState();
    body.profiles[1].values.upperArm += 0.01;
    expect(() => validateState(body)).toThrow("Same-body");
    body.lockBody = false;
    expect(validateState(body).lockBody).toBe(false);

    const force = createInitialState();
    force.lockForce = true;
    force.setups[1].tension = force.setups[0].tension + 10;
    expect(() => validateState(force)).toThrow("Same-force");
    force.lockForce = false;
    expect(validateState(force).lockForce).toBe(false);
  });
  it("restores local data and handles unavailable storage", () => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    });
    const state = createInitialState();
    expect(saveState(state)).toBe(true);
    expect(loadState()).toEqual({ state, error: null });
    memory.set(STORAGE_KEY, "{bad json");
    expect(loadState().error).toContain("could not be restored");
    expect(memory.get(STORAGE_KEY)).toBe("{bad json");
    const oldSnapshot = JSON.stringify({
      ...state,
      modelVersion: "older-model",
    });
    memory.set(STORAGE_KEY, oldSnapshot);
    expect(loadState().error).toContain("another mechanics model");
    expect(memory.get(STORAGE_KEY)).toBe(oldSnapshot);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Denied");
      },
      setItem: () => {
        throw new Error("Denied");
      },
    });
    expect(saveState(state)).toBe(false);
    expect(loadState().error).toContain("Denied");
  });
});

describe("body measurement provenance", () => {
  it("updates inferred dimensions while preserving measurements, locks and equipment", () => {
    const state = createInitialState();
    let profile = editMeasurement(state.profiles[0], "upperArm", 0.37);
    profile.locked.forearm = true;
    const before = structuredClone(profile);
    const taller = changeHeight(profile, 2);
    expect(taller.values.upperArm).toBe(0.37);
    expect(taller.provenance.upperArm).toBe("measured");
    expect(taller.values.forearm).toBe(before.values.forearm);
    expect(taller.values.torso).toBeCloseTo(
      (before.values.torso * 2) / before.values.height,
    );
    expect(taller.provenance.torso).toBe("estimated");
    expect(profile).toEqual(before);
    expect(state.setups).toEqual(createInitialState().setups);
  });
  it("allows two equal-height profiles with distinct segment measurements", () => {
    const profiles = createInitialState().profiles;
    const a = editMeasurement(profiles[0], "upperArm", 0.32);
    const b = editMeasurement(profiles[1], "upperArm", 0.39);
    expect(a.values.height).toBe(b.values.height);
    expect(a.values.upperArm).not.toBe(b.values.upperArm);
  });
});

describe("movement comparison modes", () => {
  it("uses the overlap for equal anatomical angles", () => {
    const state = createInitialState();
    state.setups[0].range = [10, 190];
    state.setups[1].range = [70, 160];
    expect(sharedRange(state)).toEqual([70, 160]);
    expect(setAngle(state, 0, 180).angles).toEqual([160, 160]);
    expect(setAngle(state, 1, 20).angles).toEqual([70, 70]);
  });
  it("requires independent positions when there is no common angle domain", () => {
    const state = createInitialState();
    state.setups[0].range = [0, 60];
    state.setups[1].range = [90, 180];
    expect(sharedRange(state)).toBeNull();
    expect(() => setAngle(state, 0, 40)).toThrow(
      "Choose independent positions",
    );
  });
  it("synchronizes progress from raised arms toward the torso across different ranges", () => {
    const state = createInitialState();
    state.sync = "progress";
    state.setups[0].range = [20, 180];
    state.setups[1].range = [80, 160];
    expect(setAngle(state, 0, 140).angles).toEqual([140, 140]);
    expect(setAngle(state, 1, 80).angles).toEqual([20, 80]);
    expect(setAngle(state, 0, 180).angles).toEqual([180, 160]);
    expect(validateState(setAngle(state, 0, 100)).sync).toBe("progress");
  });
  it("changes only the selected angle in independent mode", () => {
    const state = createInitialState();
    state.sync = "independent";
    const next = setAngle(state, 0, 90);
    expect(next.angles[0]).toBe(90);
    expect(next.angles[1]).toBe(state.angles[1]);
    expect(state.angles[0]).not.toBe(90);
  });
});

describe('expanded exercise state and migrations', () => {
  it('preserves optional motion mode and separate interval anchors without changing older snapshots', () => {
    const state = createInitialState();
    const older = parseComparison(JSON.stringify(state));
    expect(older).not.toHaveProperty('motionMode');
    expect(older).not.toHaveProperty('clearIntervalAnchors');
    state.motionMode = 'usable';
    state.clearIntervalAnchors = [170, 95]; // Separate panel anchors, not an ordered range.
    expect(parseComparison(JSON.stringify(state))).toEqual(state);
    state.motionMode = 'explore';
    expect(parseComparison(JSON.stringify(state))).toEqual(state);
    expect(() => validateState({ ...state, motionMode: 'unrestricted' })).toThrow('Motion mode');
    for (const anchors of [[Infinity, 95], [170, NaN], [-181, 95], [170, 201], [170], [170, 95, 40]]) {
      expect(() => validateState({ ...state, clearIntervalAnchors: anchors })).toThrow();
    }
  });
  it('preserves explicit bar length and compares implicit defaults by physical equipment span', () => {
    const state = createInitialState();
    state.setups[1] = structuredClone(state.setups[0]);
    state.lockEquipment = true;
    state.setups[1].barLength = Math.max(0.6, state.setups[0].attachmentSpacing + 0.08);
    expect(parseComparison(JSON.stringify(state))).toEqual(state);
    state.setups[1].barLength += 0.05;
    expect(() => validateState(state)).toThrow('Same-equipment');
    state.lockEquipment = false;
    state.setups[1].barLength = 3.01;
    expect(() => validateState(state)).toThrow('barLength');
    state.setups[1].barLength = Infinity;
    expect(() => validateState(state)).toThrow('barLength');
  });
  it('uses explicitly supplied leg masses for hip segment gravity and retains them through export', () => {
    const state = createInitialState();
    state.sync = 'independent';
    state.setups[0] = { ...state.setups[0], model: 'hip', range: [-20, 60], segmentGravity: true, thighMass: 4.5, shankMass: 2.1 };
    state.angles[0] = 20;
    expect(parseComparison(JSON.stringify(state))).toEqual(state);
    state.setups[0].thighMass = undefined;
    state.setups[0].upperArmMass = 4.5;
    state.setups[0].forearmMass = 2.1;
    expect(() => validateState(state)).toThrow('thigh and lower-leg masses');
    state.setups[0].thighMass = 4.5;
    state.setups[0].shankMass = undefined;
    expect(() => validateState(state)).toThrow('thigh and lower-leg masses');
    for (const invalid of [-1, 51, NaN, Infinity]) {
      state.setups[0].shankMass = invalid;
      expect(() => validateState(state)).toThrow('shankMass');
    }
    state.setups[0].shankMass = 0;
    state.setups[0].thighMass = 0;
    expect(validateState(state).setups[0].thighMass).toBe(0);
  });
  it('keeps undefined load mass or transmission distinct from a known zero force', () => {
    const setup = createInitialState().setups[0];
    expect(forceValue({ ...setup, resistance: 'dumbbell', loadMass: undefined })).toBeNull();
    expect(forceValue({ ...setup, loadMode: 'mass', loadMass: undefined, transmissionFactor: 1 })).toBeNull();
    expect(forceValue({ ...setup, loadMode: 'mass', loadMass: 20, transmissionFactor: undefined })).toBeNull();
    expect(forceValue({ ...setup, loadMode: 'mass', loadMass: 20, transmissionFactor: 0 })).toBe(0);
    expect(forceValue({ ...setup, resistance: 'dumbbell', loadMass: 0 })).toBe(0);
  });
  it('preserves all declared model, load, comparison and profile fields on export', () => {
    const state = createInitialState();
    state.sync = 'independent';
    state.setups[0] = { ...state.setups[0], range: [0, 140], model: 'curl', resistance: 'cable', loadMode: 'mass', loadMass: 20, transmissionFactor: 0.5, upperArmAngle: 15, planeOffset: 0.2, posture: 'standing', gripWidth: 0.42, slack: false, forceKnown: true, segmentGravity: true, upperArmMass: 2, forearmMass: 1.5 };
    state.angles[0] = 90;
    state.comparisonMode = 'controlled'; state.criterion = 'Resistance above 90°'; state.region = [90, 130];
    state.notes = 'Measured cable force'; state.observation = 'Supported pose felt more repeatable.';
    state.profiles[0] = editMeasurement(state.profiles[0], 'shank', 0.46);
    state.lockBody = false;
    expect(parseComparison(JSON.stringify(state))).toEqual(state);
    expect(forceValue(state.setups[0])).toBeCloseTo(98.1);
    state.setups[0].transmissionFactor = NaN;
    expect(() => validateState(state)).toThrow('transmissionFactor');
  });
  it('does not compare incompatible coordinates at the same angle, but synchronizes their action progress', () => {
    let state = createInitialState();
    state.setups[0].range = [20, 180];
    state.setups[1] = { ...state.setups[1], model: 'curl', range: [0, 140] };
    expect(sharedRange(state)).toBeNull();
    expect(() => setAngle(state, 0, 100)).toThrow('coordinates differ');
    state.sync = 'progress';
    state = setAngle(state, 0, 140); // 25% through decreasing pullover elevation.
    expect(state.angles).toEqual([140, 35]); // 25% through increasing elbow flexion.
    expect(validateState(state).sync).toBe('progress');
  });
  it('regenerates only unmeasured, unlocked estimates, including lower-body dimensions', () => {
    let profile = createInitialState().profiles[0];
    profile = editMeasurement(profile, 'thigh', 0.48);
    profile.locked.foot = true;
    const foot = profile.values.foot;
    profile.values.height = 2;
    const regenerated = regenerateEstimates(profile);
    expect(regenerated.values.thigh).toBe(0.48);
    expect(regenerated.values.foot).toBe(foot);
    expect(regenerated.values.shank).toBeCloseTo(0.43 * 2 / 1.75);
    expect(regenerated.provenance.shank).toBe('estimated');
    expect(profile.provenance.shank).toBe('example');
  });
  it('migrates an original pullover snapshot while preserving its exact source before saving', () => {
    const old = JSON.parse(JSON.stringify(createInitialState()));
    old.modelVersion = 'pullover-1';
    for (const profile of old.profiles) for (const key of ['thigh', 'shank', 'foot', 'pelvisWidth', 'headNeck']) {
      delete profile.values[key]; delete profile.provenance[key]; delete profile.locked[key];
    }
    const original = JSON.stringify(old);
    const memory = new Map([[STORAGE_KEY, original]]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) });
    const migrated = loadState();
    expect(migrated.state.modelVersion).toBe(MODEL_VERSION);
    expect(migrated.state.profiles[0].provenance.thigh).toBe('estimated');
    expect(migrated.error).toContain('Review the recalculated results');
    expect(memory.get(STORAGE_KEY)).toBe(original);
    expect(memory.get(migrated.backupKey!)).toBe(original);
    expect(saveState(migrated.state)).toBe(true);
    expect(memory.get(migrated.backupKey!)).toBe(original);
    expect(JSON.parse(memory.get(STORAGE_KEY)!).modelVersion).toBe(MODEL_VERSION);
  });
  it('refuses an overwrite if preserving the old-model backup fails', () => {
    const original = JSON.stringify({ ...createInitialState(), modelVersion: 'pullover-1' });
    const written: string[] = [];
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === STORAGE_KEY ? original : null, setItem: (key: string) => { written.push(key); throw new Error('Quota'); } });
    expect(saveState(createInitialState())).toBe(false);
    expect(written).not.toContain(STORAGE_KEY);
  });
  it('preserves malformed existing data before an explicit replacement save', () => {
    for (const original of ['null', '{broken', JSON.stringify({ modelVersion: MODEL_VERSION, version: 1 })]) {
      const memory = new Map([[STORAGE_KEY, original]]);
      vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) });
      expect(saveState(createInitialState())).toBe(true);
      expect(memory.get(`${STORAGE_KEY}.model-backup`)).toBe(original);
    }
  });
  it('does not replace a partially supplied measured segment with an estimate', () => {
    const state = JSON.parse(JSON.stringify(createInitialState()));
    delete state.profiles[0].values.thigh;
    state.profiles[0].provenance.thigh = 'measured';
    expect(() => validateState(state)).toThrow('dimension, provenance, and lock together');
  });
});
