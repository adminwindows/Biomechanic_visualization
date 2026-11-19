import { compatible, forceToSetup, getDefinition, type Setup } from './engine';
import { catalogEntries } from './catalog';
import { compoundPresets, getCompoundPreset, type CompoundConfig, type CompoundPreset } from './compoundEngine';
import { switchCompoundExercise, type CompoundSnapshot } from './compoundState';
import { loadExerciseDraftLibrary, saveExerciseDraft, type ExerciseDraft } from './exerciseDrafts';
import { forceValue, setAngle, sharedRange, type LabState } from './state';

type Side = 0 | 1;

export const jointExercises = catalogEntries.filter(entry => entry.status === 'External mechanics');
export const compoundExercises = compoundPresets.filter(entry => entry.mechanics !== 'unknown');

export function jointPairFits(a: Setup, b: Setup) {
  return compatible(a, b) && Math.max(a.range[0], b.range[0]) < Math.min(a.range[1], b.range[1]);
}

// Compound results use joules per unit of progress along a prescribed movement.
// Match the action and the number of loaded sides before comparing totals.
export function compoundPairFits(a: CompoundConfig, b: CompoundConfig | CompoundPreset) {
  const first = getCompoundPreset(a);
  const second = 'defaults' in b ? b : getCompoundPreset(b);
  const unilateral = 'defaults' in b ? !!b.defaults.unilateral : b.unilateral;
  return first.mechanics !== 'unknown' && second.mechanics !== 'unknown'
    && first.movement === second.movement && a.unilateral === unilateral
    && (first.movement !== 'squat' || first.family === second.family)
    && (first.id === 'shoulder-press') === (second.id === 'shoulder-press');
}

export function chooseCompoundPair(state: CompoundSnapshot, side: Side, id: string) {
  const preset = compoundExercises.find(item => item.id === id);
  if (!preset) return;
  if (side === 1 && !compoundPairFits(state.configs[0], preset) && id !== state.configs[0].preset) return;
  switchCompoundExercise(state, side, id);
  const [a, b] = state.configs;
  if (compoundPairFits(a, b)) return;
  if (side === 1 && compoundPairFits(a, preset)) {
    // A remembered edit may have changed the number of loaded limbs.
    state.configs[1].unilateral = a.unilateral;
    return;
  }
  const currentA = getCompoundPreset(a);
  const options = compoundExercises.filter(item => item.id !== a.preset && compoundPairFits(a, state.drafts?.[1][item.id]?.config ?? item));
  const nextB = side === 0 ? options.find(item => item.family === currentA.family) ?? options[0] : undefined;
  switchCompoundExercise(state, 1, nextB?.id ?? a.preset);
  // The only compatible choice can be A's edited one-arm/two-arm variant.
  if (!compoundPairFits(a, state.configs[1])) state.configs[1] = structuredClone(a);
}

type RememberedDraft = Pick<ExerciseDraft, 'setup' | 'profile' | 'angle'>;

/** Keep switching available in memory even when this browser cannot store drafts. */
export function createJointPairChooser() {
  const unsaved: [Map<string, RememberedDraft>, Map<string, RememberedDraft>] = [new Map(), new Map()];
  let storageReported = false;
  return (state: LabState, side: Side, id: string): { state: LabState; notice: string } => {
    const originalA = state.setups[0];
    const lockedForce = state.lockForce ? forceValue(originalA) : null;
    const requested = jointExercises.find(entry => entry.setup.preset === id)?.setup;
    if (!requested && id !== originalA.preset) return { state, notice: 'Choose an exercise from the list.' };
    let notice = '';
    const storageNotice = 'Exercise settings are kept in this tab. Browser storage is unavailable.';
    let stored: ExerciseDraft[] = [];
    try { stored = loadExerciseDraftLibrary().drafts; } catch { notice = storageNotice; }
    const draftFor = (panel: Side, preset: string) => unsaved[panel].get(preset)
      ?? stored.find(draft => draft.side === panel && draft.preset === preset);
    function remember(panel: Side) {
      const setup = state.setups[panel];
      const snapshot = { setup: structuredClone(setup), profile: structuredClone(state.profiles[panel]), angle: state.angles[panel] };
      try {
        saveExerciseDraft(panel, snapshot.setup, snapshot.profile, snapshot.angle);
        unsaved[panel].delete(setup.preset);
      } catch {
        unsaved[panel].set(setup.preset, snapshot);
        notice = storageNotice;
      }
    }
    function replace(panel: Side, setup: Setup, saved?: RememberedDraft) {
      remember(panel);
      const previous = state.setups[panel];
      state.setups[panel] = structuredClone(setup);
      const midpoint = (setup.range[0] + setup.range[1]) / 2;
      const angle = saved?.angle ?? (compatible(previous, setup) ? state.angles[panel] : midpoint);
      state.angles[panel] = Math.max(setup.range[0], Math.min(setup.range[1], angle));
      if (saved && (panel === 0 || !state.lockBody)) state.profiles[panel] = structuredClone(saved.profile);
      if (panel === 0 && state.lockBody) state.profiles[1] = structuredClone(state.profiles[0]);
      state.lockEquipment = false;
    }

    const selectedDraft = draftFor(side, id);
    if (side === 0 && requested && id !== originalA.preset) {
      replace(0, selectedDraft?.setup ?? requested, selectedDraft);
    }
    const a = state.setups[0];
    const b = state.setups[1];
    if (side === 1 && (id !== b.preset || !jointPairFits(a, b))) {
      if (selectedDraft && jointPairFits(a, selectedDraft.setup)) replace(1, selectedDraft.setup, selectedDraft);
      else if (id === a.preset) replace(1, a);
      else if (requested && jointPairFits(a, requested)) replace(1, requested);
      else return { state, notice: 'These setups use different movements or ranges.' };
    }
    if (side === 0 && !jointPairFits(a, b)) {
      const choices = jointExercises.filter(entry => entry.setup.preset !== a.preset && jointPairFits(a, draftFor(1, entry.setup.preset)?.setup ?? entry.setup));
      const alternative = choices.find(entry => entry.setup.resistance !== a.resistance) ?? choices[0];
      const savedB = alternative && draftFor(1, alternative.setup.preset);
      replace(1, savedB?.setup ?? alternative?.setup ?? a, savedB);
    }
    if (state.lockForce) {
      const matchedA = lockedForce === null ? null : forceToSetup(state.setups[0], lockedForce);
      const matchedB = lockedForce === null ? null : forceToSetup(state.setups[1], lockedForce);
      if (matchedA && matchedB) state.setups = [matchedA, matchedB];
      else { state.lockForce = false; notice ||= 'The selected setups cannot match the locked force. The force lock was released.'; }
    }
    if (!compatible(originalA, a)) {
      delete state.region;
      delete state.clearIntervalAnchors;
      state.viewFraming = { view: getDefinition(a).plane, zoom: 1, pan: [0, 0] };
    }
    // Retain alternative viewing modes when possible. Jumping between families
    // starts at an angle within both ranges, including for translational models.
    if (state.sync === 'angle' && !sharedRange(state)) state.sync = 'progress';
    if (notice === storageNotice) {
      if (storageReported) notice = '';
      storageReported = true;
    }
    return { state: setAngle(state, side, state.angles[side]), notice };
  };
}
