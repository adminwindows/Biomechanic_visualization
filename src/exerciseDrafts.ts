import { MODEL_VERSION, type Setup } from './engine';
import {
  MAX_IMPORT_BYTES, preserveModelBackup, validateState,
  type BodyProfile,
} from './state';

/** Separate from named comparisons: switching exercises keeps one working draft per panel. */
export const EXERCISE_DRAFTS_KEY = 'exercise-biomechanics-lab.exercise-drafts.v1';
export type DraftSide = 0 | 1;
export type ExerciseDraft = {
  side: DraftSide;
  preset: string;
  setup: Setup;
  profile: BodyProfile;
  angle: number;
  modelVersion: string;
  updatedAt: string;
  /** Original mechanics version, retained when the shared state migration recalculates a draft. */
  sourceModelVersion?: string;
};
export type ExerciseDraftLibrary = {
  format: 'biomechanics-exercise-drafts';
  version: 1;
  drafts: ExerciseDraft[];
};
const MAX_DRAFTS = 500;
const clone = <T>(value: T): T => structuredClone(value);
const emptyLibrary = (): ExerciseDraftLibrary => ({ format: 'biomechanics-exercise-drafts', version: 1, drafts: [] });
const identity = (side: DraftSide, preset: string) => JSON.stringify([side, preset]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error(`${label} must contain 1–120 characters.`);
  return value;
}
function sideValue(value: unknown): DraftSide {
  if (value !== 0 && value !== 1) throw new Error('An exercise draft must belong to panel A (0) or B (1).');
  return value;
}
function boundedText(value: string): void {
  if (new TextEncoder().encode(value).byteLength > MAX_IMPORT_BYTES) throw new Error('Exercise drafts exceed the 1 MB limit. Export and remove unused drafts before saving more.');
}

/** Reuse the comparison validator so fields and known model migrations cannot drift. */
function validateSnapshot(row: Record<string, unknown>, modelVersion: unknown) {
  return validateState({
    version: 1, modelVersion, name: 'Exercise working draft',
    setups: [row.setup, row.setup], profiles: [row.profile, row.profile],
    angles: [row.angle, row.angle], sync: 'independent', lockBody: false, lockForce: false,
  });
}
function validateDraft(value: unknown): ExerciseDraft {
  const row = object(value, 'Exercise draft');
  const side = sideValue(row.side);
  const preset = text(row.preset, 'Exercise draft preset');
  const inputModel = text(row.modelVersion, 'Exercise draft mechanics version');
  const state = validateSnapshot(row, inputModel);
  if (state.setups[0].preset !== preset) throw new Error('An exercise draft identifier must match its setup preset.');
  if (typeof row.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt)
    || !Number.isFinite(Date.parse(row.updatedAt)) || new Date(row.updatedAt).toISOString() !== row.updatedAt)
    throw new Error('An exercise draft has an invalid update date.');
  const source = inputModel !== MODEL_VERSION ? inputModel : row.sourceModelVersion;
  if (source !== undefined) {
    text(source, 'Exercise draft source mechanics version');
    // Only provenance versions supported by the shared migration path are accepted.
    validateSnapshot(row, source);
  }
  return {
    side, preset, setup: state.setups[0], profile: state.profiles[0], angle: state.angles[0],
    modelVersion: MODEL_VERSION, updatedAt: row.updatedAt,
    ...(source && source !== MODEL_VERSION ? { sourceModelVersion: source as string } : {}),
  };
}

export function validateExerciseDraftLibrary(input: unknown): ExerciseDraftLibrary {
  const row = object(input, 'Exercise draft library');
  if (row.format !== 'biomechanics-exercise-drafts' || row.version !== 1) throw new Error('This exercise draft format or version is not supported.');
  if (!Array.isArray(row.drafts) || row.drafts.length > MAX_DRAFTS) throw new Error(`An exercise draft library may contain no more than ${MAX_DRAFTS} drafts.`);
  const drafts = row.drafts.map(validateDraft);
  if (new Set(drafts.map(draft => identity(draft.side, draft.preset))).size !== drafts.length)
    throw new Error('The exercise draft library has duplicate panel/preset entries.');
  return { format: 'biomechanics-exercise-drafts', version: 1, drafts };
}

function readRaw(): string | null {
  try { return localStorage.getItem(EXERCISE_DRAFTS_KEY); }
  catch (error) { throw new Error(`Exercise draft storage is unavailable. ${error instanceof Error ? error.message : 'This browser denied access.'}`); }
}
function parseLibrary(raw: string): ExerciseDraftLibrary {
  boundedText(raw);
  try { return validateExerciseDraftLibrary(JSON.parse(raw)); }
  catch (error) { throw new Error(`The exercise drafts could not be restored; the original data has been kept. ${error instanceof Error ? error.message : 'Invalid draft data.'}`); }
}

/** Reads do not rewrite data. Migrated drafts retain sourceModelVersion for a visible notice. */
export function loadExerciseDraftLibrary(): ExerciseDraftLibrary {
  const raw = readRaw();
  return raw === null ? emptyLibrary() : parseLibrary(raw);
}
function writeLibrary(library: ExerciseDraftLibrary, explicitReplacement = false): void {
  const next = JSON.stringify(validateExerciseDraftLibrary(library));
  boundedText(next);
  const previous = readRaw();
  if (previous !== null) {
    // Refuse to clobber unreadable originals, including when importing a valid replacement.
    parseLibrary(previous);
    if (previous === next) return;
  }
  try {
    if (previous !== null) {
      const original = JSON.parse(previous) as ExerciseDraftLibrary;
      if (explicitReplacement || original.drafts.some(draft => draft.modelVersion !== MODEL_VERSION))
        preserveModelBackup(previous, EXERCISE_DRAFTS_KEY);
    }
    localStorage.setItem(EXERCISE_DRAFTS_KEY, next);
  } catch (error) {
    throw new Error(`Exercise drafts could not be saved. ${error instanceof Error ? error.message : 'Browser storage is unavailable.'} Your existing stored drafts have not been replaced.`);
  }
}

/** Bulk replacement is backed up; malformed existing data requires explicit recovery first. */
export function saveExerciseDraftLibrary(library: ExerciseDraftLibrary): void {
  writeLibrary(library, true);
}
export function saveExerciseDraft(side: DraftSide, setup: Setup, profile: BodyProfile, angle: number): ExerciseDraft {
  const draft = validateDraft({ side, preset: setup.preset, setup, profile, angle, modelVersion: MODEL_VERSION, updatedAt: new Date().toISOString() });
  const library = loadExerciseDraftLibrary();
  library.drafts = [draft, ...library.drafts.filter(item => identity(item.side, item.preset) !== identity(draft.side, draft.preset))];
  writeLibrary(library);
  return clone(draft);
}
export function loadExerciseDraft(side: DraftSide, preset: string): ExerciseDraft | null {
  sideValue(side); text(preset, 'Exercise draft preset');
  const draft = loadExerciseDraftLibrary().drafts.find(item => item.side === side && item.preset === preset);
  return draft ? clone(draft) : null;
}
export function deleteExerciseDraft(side: DraftSide, preset: string): void {
  sideValue(side); text(preset, 'Exercise draft preset');
  const library = loadExerciseDraftLibrary();
  library.drafts = library.drafts.filter(item => item.side !== side || item.preset !== preset);
  writeLibrary(library);
}
export function exportExerciseDrafts(): string { return JSON.stringify(loadExerciseDraftLibrary(), null, 2); }

/** Merge keeps existing drafts on key collisions; replace backs up the previous full store. */
export function importExerciseDrafts(raw: string, mode: 'merge' | 'replace' = 'merge'): { imported: number; kept: number } {
  if (typeof raw !== 'string') throw new Error('Choose an exercise draft JSON file.');
  boundedText(raw);
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Choose merge or replace for exercise drafts.');
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new Error('The exercise draft file is not valid JSON.'); }
  const incoming = validateExerciseDraftLibrary(input);
  const existing = loadExerciseDraftLibrary();
  if (mode === 'replace') {
    writeLibrary(incoming, true);
    return { imported: incoming.drafts.length, kept: 0 };
  }
  const known = new Set(existing.drafts.map(draft => identity(draft.side, draft.preset)));
  const additions = incoming.drafts.filter(draft => !known.has(identity(draft.side, draft.preset)));
  writeLibrary({ ...existing, drafts: [...existing.drafts, ...additions] });
  return { imported: additions.length, kept: incoming.drafts.length - additions.length };
}
