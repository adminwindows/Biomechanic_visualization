import { STORAGE_KEY, validateState, type LabState } from './state';
import { LIBRARY_KEY, validateLibrary } from './library';
import { EXERCISE_DRAFTS_KEY, validateExerciseDraftLibrary } from './exerciseDrafts';
import { RESEARCH_KEY, validateResearchNotebook } from './researchNotebook';
import {
  MACHINE_LIBRARY_KEY, MACHINE_WORKSPACE_KEY, validateMachineLibrary, validateMachineWorkspace,
} from './machineLibrary';
import { COMPOUND_KEY, COMPOUND_LIBRARY_KEY, parseCompound, parseCompoundLibrary } from './compoundState';
import { matchExercise, resolveTrainingMatch } from './training';
import { CALIBRATION_KEY, validateCalibrationNotebook } from './calibrationGuide';

export const MAX_WORKSPACE_BYTES = 5_000_000;
export const WORKSPACE_BACKUP_PREFIX = 'exercise-biomechanics-lab.workspace-backup.';
export const WORKSPACE_FLUSH_EVENT = 'biomechanics:flush-workspaces';
const FAVORITES_KEY = 'biomechanics.exercise-favorites';
const TRAINING_TEXT_KEY = 'biomechanics.training-list';
const TRAINING_MATCHES_KEY = 'biomechanics.training-matches';

type StoreDefinition = { key: string; label: string; validate: (value: unknown) => unknown; rawText?: boolean };
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function boundedString(value: unknown, label: string, maximum: number, required = false): string {
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim()))
    throw new Error(`${label} must contain ${required ? '1' : '0'}–${maximum} characters.`);
  return value;
}
function favorites(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Exercise favorites must contain no more than 1,000 identifiers.');
  const ids = value.map(item => boundedString(item, 'Favorite exercise identifier', 200, true));
  if (new Set(ids).size !== ids.length) throw new Error('Exercise favorites contain duplicate identifiers.');
  return ids;
}
function trainingMatches(value: unknown) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Training matches must contain no more than 1,000 exercises.');
  const results = value.map(item => {
    const row = object(item, 'Training match');
    const id = boundedString(row.id, 'Training match identifier', 200, true);
    const original = boundedString(row.original, 'Original exercise label', 10000, true);
    if (!['matched', 'ambiguous', 'unrecognized'].includes(String(row.status))) throw new Error('A training match has an unsupported status.');
    const fresh = matchExercise(original);
    const resolved = row.selectedPreset === undefined ? fresh : resolveTrainingMatch(fresh, boundedString(row.selectedPreset, 'Selected exercise identifier', 200, true));
    return { ...resolved, id };
  });
  if (new Set(results.map(item => item.id)).size !== results.length) throw new Error('Training matches contain duplicate identifiers.');
  return results;
}
function trainingText(value: unknown): string {
  const text = boundedString(value, 'Training source text', 1_000_000);
  if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new Error('Training source text exceeds 1 MB.');
  return text;
}

/** No arbitrary localStorage names or backup keys are accepted from an import. */
const stores: readonly StoreDefinition[] = [
  { key: STORAGE_KEY, label: 'Current comparison', validate: validateState },
  { key: LIBRARY_KEY, label: 'Saved comparisons, bodies and equipment', validate: validateLibrary },
  { key: EXERCISE_DRAFTS_KEY, label: 'Per-exercise drafts', validate: validateExerciseDraftLibrary },
  { key: RESEARCH_KEY, label: 'Saved research notes', validate: validateResearchNotebook },
  { key: CALIBRATION_KEY, label: 'Measurement drafts and recorded calibration', validate: validateCalibrationNotebook },
  { key: MACHINE_WORKSPACE_KEY, label: 'Machine comparison', validate: validateMachineWorkspace },
  { key: MACHINE_LIBRARY_KEY, label: 'Machine profiles', validate: validateMachineLibrary },
  { key: COMPOUND_KEY, label: 'Compound comparison', validate: value => parseCompound(JSON.stringify(value)) },
  { key: COMPOUND_LIBRARY_KEY, label: 'Saved compound comparisons', validate: value => parseCompoundLibrary(JSON.stringify(value)) },
  { key: FAVORITES_KEY, label: 'Exercise favorites', validate: favorites },
  { key: TRAINING_TEXT_KEY, label: 'Training source text', rawText: true, validate: trainingText },
  { key: TRAINING_MATCHES_KEY, label: 'Confirmed exercise mappings', validate: trainingMatches },
];
export const WORKSPACE_STORAGE_KEYS: readonly string[] = stores.map(store => store.key);
export type WorkspaceBackupEntry = { key: string; value: unknown | null };
export type WorkspaceBackup = {
  format: 'biomechanics-workspace'; version: 1; exportedAt: string; entries: WorkspaceBackupEntry[];
  /** Derived from the file's snapshots, never trusted from imported metadata. */
  modelUpdates?: string[];
};
export type WorkspaceSectionSummary = { label: string; present: boolean; records: number };
export type WorkspaceRestoreResult = { stores: number; records: number; backupKey: string; modelUpdates: string[] };
type RecoveryEntry = { key: string; raw: string | null };
type WorkspaceRecovery = {
  format: 'biomechanics-workspace-recovery'; version: 1; exportedAt: string;
  entries: RecoveryEntry[]; currentComparison?: LabState;
};

function boundedFile(raw: string): void {
  if (new TextEncoder().encode(raw).byteLength > MAX_WORKSPACE_BYTES) throw new Error('Workspace files must be smaller than 5 MB. Export individual libraries if your workspace is larger.');
}
function storeFor(key: unknown): StoreDefinition {
  const store = stores.find(item => item.key === key);
  if (!store) throw new Error('The workspace file contains an unrecognized storage section. No browser data has been changed.');
  return store;
}
function timestamp(value: unknown): string {
  const date = boundedString(value, 'Workspace export date', 40, true);
  if (!Number.isFinite(Date.parse(date))) throw new Error('The workspace export date is invalid.');
  return date;
}
function collectModelUpdates(before: unknown, after: unknown, updates: Set<string>): void {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return;
  if (Array.isArray(before) && Array.isArray(after)) {
    before.forEach((value, index) => collectModelUpdates(value, after[index], updates)); return;
  }
  if (Array.isArray(before) || Array.isArray(after)) return;
  const old = before as Record<string, unknown>, next = after as Record<string, unknown>;
  if (typeof old.modelVersion === 'string' && typeof next.modelVersion === 'string' && old.modelVersion !== next.modelVersion)
    updates.add(`${old.modelVersion} → ${next.modelVersion}`);
  for (const key of Object.keys(old)) collectModelUpdates(old[key], next[key], updates);
}
export function validateWorkspaceBackup(value: unknown): WorkspaceBackup {
  const input = object(value, 'Workspace backup');
  if (input.format === 'biomechanics-workspace-recovery') throw new Error('This is a raw recovery file. Its original contents are preserved for inspection; it cannot be restored automatically as a validated workspace.');
  if (input.format !== 'biomechanics-workspace' || input.version !== 1) throw new Error('This workspace format or version is not supported.');
  if (!Array.isArray(input.entries) || input.entries.length === 0 || input.entries.length > stores.length) throw new Error('The workspace file has no sections or too many sections.');
  const keys = new Set<string>();
  const updates = new Set<string>();
  const entries = input.entries.map(value => {
    const entry = object(value, 'Workspace section');
    const store = storeFor(entry.key);
    if (keys.has(store.key)) throw new Error('The workspace file contains duplicate sections.');
    keys.add(store.key);
    try {
      const validated = entry.value === null ? null : store.validate(entry.value);
      collectModelUpdates(entry.value, validated, updates);
      return { key: store.key, value: validated };
    }
    catch (error) { throw new Error(`${store.label}: ${error instanceof Error ? error.message : 'Invalid data.'}`); }
  });
  return { format: 'biomechanics-workspace', version: 1, exportedAt: timestamp(input.exportedAt), entries, ...(updates.size ? { modelUpdates: [...updates] } : {}) };
}
export function parseWorkspaceBackup(raw: string): WorkspaceBackup {
  if (typeof raw !== 'string') throw new Error('Choose a workspace JSON file.');
  boundedFile(raw);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('The workspace file is not valid JSON.'); }
  return validateWorkspaceBackup(value);
}
function readEntries(): RecoveryEntry[] {
  try { return stores.map(store => ({ key: store.key, raw: localStorage.getItem(store.key) })); }
  catch (error) { throw new Error(`Workspace storage is unavailable. ${error instanceof Error ? error.message : 'Browser access was denied.'}`); }
}

/** A synchronous event lets mounted workbenches flush their own pending edits. */
export function flushWorkspaceEdits(): void {
  if (typeof window === 'undefined') return;
  const detail: { errors: string[] } = { errors: [] };
  window.dispatchEvent(new CustomEvent(WORKSPACE_FLUSH_EVENT, { detail }));
  if (detail.errors.length) throw new Error(`Some current edits could not be saved: ${detail.errors.join(' ')}`);
}
export function createWorkspaceBackup(state: LabState): WorkspaceBackup {
  const current = validateState(state);
  const entries = readEntries().map(({ key, raw }) => {
    if (key === STORAGE_KEY) return { key, value: current };
    const store = storeFor(key);
    if (raw === null) return { key, value: null };
    try { return { key, value: store.validate(store.rawText ? raw : JSON.parse(raw)) }; }
    catch (error) { throw new Error(`${store.label} could not be exported. Its original stored data is unchanged. Use Download raw recovery to preserve it. ${error instanceof Error ? error.message : ''}`); }
  });
  const result: WorkspaceBackup = { format: 'biomechanics-workspace', version: 1, exportedAt: new Date().toISOString(), entries };
  boundedFile(JSON.stringify(result));
  return result;
}
export function exportWorkspace(state: LabState): string {
  const raw = JSON.stringify(createWorkspaceBackup(state), null, 2); boundedFile(raw); return raw;
}
function recoveryFile(entries: RecoveryEntry[], currentState?: LabState): string {
  const recovery: WorkspaceRecovery = {
    format: 'biomechanics-workspace-recovery', version: 1, exportedAt: new Date().toISOString(), entries,
    ...(currentState ? { currentComparison: validateState(currentState) } : {}),
  };
  const raw = JSON.stringify(recovery, null, 2);
  boundedFile(raw);
  return raw;
}
/** Exact strings survive unknown versions and corrupt JSON. This never flushes or rewrites stores. */
export function exportRawWorkspaceRecovery(currentState?: LabState): string { return recoveryFile(readEntries(), currentState); }
function records(value: unknown): number {
  if (value === null) return 0;
  if (typeof value === 'string') return value.trim() ? value.split(/\r?\n/).filter(line => line.trim()).length : 0;
  if (Array.isArray(value)) return value.length;
  const row = value as Record<string, unknown>;
  if (Array.isArray(row.comparisons)) return row.comparisons.length + (row.bodies as unknown[]).length + (row.equipment as unknown[]).length;
  for (const key of ['drafts', 'entries', 'records'] as const) if (Array.isArray(row[key])) return row[key].length;
  if (row.format === 'biomechanics-machine-library' && Array.isArray(row.profiles)) return row.profiles.length;
  return 1;
}
export function workspaceSummary(backup: WorkspaceBackup): WorkspaceSectionSummary[] {
  return validateWorkspaceBackup(backup).entries.map(entry => ({ label: storeFor(entry.key).label, present: entry.value !== null, records: records(entry.value) }));
}

export class WorkspaceRestoreError extends Error {
  readonly recovery: string;
  readonly backupKey?: string;
  readonly rollbackComplete: boolean;
  constructor(message: string, recovery: string, rollbackComplete: boolean, backupKey?: string) {
    super(message); this.name = 'WorkspaceRestoreError'; this.recovery = recovery;
    this.rollbackComplete = rollbackComplete; this.backupKey = backupKey;
  }
}
function newBackupKey(): string {
  const base = `${WORKSPACE_BACKUP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let key = base, index = 0;
  while (localStorage.getItem(key) !== null) key = `${base}-${++index}`;
  return key;
}

/** Validate every section before the first mutation; retain exact originals and roll back partial writes. */
export function restoreWorkspaceBackup(raw: string, currentState?: LabState): WorkspaceRestoreResult {
  const backup = parseWorkspaceBackup(raw);
  const before = readEntries();
  const recovery = recoveryFile(before, currentState);
  const originals = new Map(before.map(entry => [entry.key, entry.raw]));
  const writes = backup.entries.map(entry => ({
    key: entry.key,
    raw: entry.value === null ? null : storeFor(entry.key).rawText ? entry.value as string : JSON.stringify(entry.value),
  }));
  let backupKey: string;
  try {
    backupKey = newBackupKey();
    localStorage.setItem(backupKey, recovery);
  } catch (error) {
    throw new WorkspaceRestoreError(`A recovery copy could not be saved; nothing was imported. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Download raw recovery before freeing storage.`, recovery, true);
  }
  const changed: typeof writes = [];
  try {
    for (const entry of writes) {
      if (entry.raw === originals.get(entry.key)) continue;
      if (entry.raw === null) localStorage.removeItem(entry.key);
      else localStorage.setItem(entry.key, entry.raw);
      changed.push(entry);
    }
  } catch (error) {
    let rollbackComplete = true;
    // Free newly added data and restore shrinking values first, leaving room for larger originals.
    const ordered = [...changed].sort((a, b) => {
      const delta = (entry: typeof writes[number]) => (originals.get(entry.key)?.length ?? 0) - (entry.raw?.length ?? 0);
      return delta(a) - delta(b);
    });
    for (const entry of ordered) {
      try {
        const old = originals.get(entry.key) ?? null;
        if (old === null) localStorage.removeItem(entry.key);
        else localStorage.setItem(entry.key, old);
      } catch { rollbackComplete = false; }
    }
    throw new WorkspaceRestoreError(
      rollbackComplete
        ? `Import failed and the previous workspace was restored. ${error instanceof Error ? error.message : 'Storage is unavailable.'}`
        : `Import failed and some sections could not be restored. Download the recovery file; the original data is also preserved at ${backupKey}.`,
      recovery, rollbackComplete, backupKey,
    );
  }
  return { stores: writes.length, records: backup.entries.reduce((total, entry) => total + records(entry.value), 0), backupKey, modelUpdates: backup.modelUpdates ?? [] };
}
