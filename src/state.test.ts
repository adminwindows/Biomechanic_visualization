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
