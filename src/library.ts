import { MODEL_VERSION, type Setup } from './engine';
import {
  MAX_IMPORT_BYTES, preserveModelBackup, validateProfile, validateSetup, validateState,
  type BodyProfile, type LabState,
} from './state';

export const LIBRARY_KEY = 'exercise-biomechanics-lab.library.v1';
type NamedRecord = { id: string; name: string; createdAt: string; updatedAt: string };
export type SavedComparison = NamedRecord & { state: LabState; favorite: boolean; sourceModelVersion?: string };
export type SavedBodyProfile = NamedRecord & { profile: BodyProfile };
/** A complete setup snapshot retains the equipment's positions and load convention. */
export type SavedEquipmentProfile = NamedRecord & { setup: Setup };
export type Library = {
  format: 'biomechanics-library'; version: 1;
  comparisons: SavedComparison[]; bodies: SavedBodyProfile[]; equipment: SavedEquipmentProfile[];
};
const emptyLibrary = (): Library => ({ format: 'biomechanics-library', version: 1, comparisons: [], bodies: [], equipment: [] });
const clone = <T>(value: T): T => structuredClone(value);
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error('Choose a name containing 1–120 characters.');
  return value.trim();
}
function identity(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(value)) throw new Error('A saved item has an invalid identifier.');
  return value;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('A saved item has an invalid date.');
  return value;
}
function base(input: Record<string, unknown>): NamedRecord {
  return { id: identity(input.id), name: name(input.name), createdAt: date(input.createdAt), updatedAt: date(input.updatedAt) };
}
function items(input: unknown, label: string): unknown[] {
  if (!Array.isArray(input) || input.length > 500) throw new Error(`${label} must contain no more than 500 items.`);
  return input;
}
function uniqueIds(entries: NamedRecord[], label: string): void {
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error(`${label} contains duplicate identifiers.`);
}
export function validateLibrary(input: unknown): Library {
  const raw = object(input, 'Library');
  if (raw.format !== 'biomechanics-library' || raw.version !== 1) throw new Error('This library format or version is not supported.');
  const comparisons = items(raw.comparisons, 'Comparisons').map(item => {
    const row = object(item, 'Saved comparison');
    if (typeof row.favorite !== 'boolean') throw new Error('A comparison favorite flag must be true or false.');
    const snapshot = object(row.state, 'Saved comparison snapshot');
    const state = validateState(snapshot);
    const source = snapshot.modelVersion !== MODEL_VERSION ? snapshot.modelVersion : row.sourceModelVersion;
    if (source !== undefined && source !== 'pullover-1' && source !== 'biomechanics-2') throw new Error('A comparison has an unsupported source model version.');
    return { ...base(row), state, favorite: row.favorite, ...(source ? { sourceModelVersion: source as string } : {}) };
  });
  const bodies = items(raw.bodies, 'Body profiles').map(item => {
    const row = object(item, 'Saved body profile');
    return { ...base(row), profile: validateProfile(row.profile) };
  });
  const equipment = items(raw.equipment, 'Equipment profiles').map(item => {
    const row = object(item, 'Saved equipment profile');
    return { ...base(row), setup: validateSetup(row.setup) };
  });
  uniqueIds(comparisons, 'Comparisons'); uniqueIds(bodies, 'Body profiles'); uniqueIds(equipment, 'Equipment profiles');
  return { format: 'biomechanics-library', version: 1, comparisons, bodies, equipment };
}
function boundedText(text: string): void {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('The library exceeds the 1 MB size limit. Export fewer items or remove unused saved items.');
}
function storageError(error: unknown): Error {
  return new Error(`The library could not be saved in this browser. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Export your current comparison to keep a copy.`);
}
function readLibrary(): Library {
  let raw: string | null;
  try { raw = localStorage.getItem(LIBRARY_KEY); }
  catch { throw new Error('Browser storage is unavailable; the saved library cannot be opened.'); }
  if (!raw) return emptyLibrary();
  boundedText(raw);
  try { return validateLibrary(JSON.parse(raw)); }
  catch (error) { throw new Error(`The saved library could not be restored; its original data has been kept. ${error instanceof Error ? error.message : 'Invalid data.'}`); }
}
function writeLibrary(library: Library): void {
  const validated = validateLibrary(library);
  const next = JSON.stringify(validated);
  boundedText(next);
  try {
    const previous = localStorage.getItem(LIBRARY_KEY);
    if (previous) {
      let needsBackup = false;
      try {
        const old = JSON.parse(previous);
        needsBackup = !Array.isArray(old.comparisons) || old.comparisons.some((item: { state?: { modelVersion?: string } }) => item.state?.modelVersion !== MODEL_VERSION);
      } catch { needsBackup = true; }
      if (needsBackup) preserveModelBackup(previous, LIBRARY_KEY);
    }
    localStorage.setItem(LIBRARY_KEY, next);
  } catch (error) { throw storageError(error); }
}
function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `saved-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function recordBase(label: string, previous?: NamedRecord): NamedRecord {
  const now = new Date().toISOString();
  return { id: previous?.id ?? newId(), name: name(label), createdAt: previous?.createdAt ?? now, updatedAt: now };
}
function replace<T extends NamedRecord>(entries: T[], entry: T): T[] {
  return [entry, ...entries.filter(item => item.id !== entry.id)];
}
function find<T extends NamedRecord>(entries: T[], id: string): T {
  const found = entries.find(item => item.id === id);
  if (!found) throw new Error('This saved item no longer exists. Refresh the library.');
  return found;
}
export function listSavedComparisons(): SavedComparison[] { return readLibrary().comparisons; }
export function saveComparison(state: LabState, label?: string, id?: string): SavedComparison {
  const library = readLibrary();
  const previous = id ? find(library.comparisons, id) : undefined;
  const entry = { ...recordBase(label ?? (state.name.trim() || 'Untitled comparison'), previous), state: validateState(state), favorite: previous?.favorite ?? false };
  library.comparisons = replace(library.comparisons, entry);
  writeLibrary(library); return clone(entry);
}
export function loadComparison(id: string): LabState { return clone(find(readLibrary().comparisons, id).state); }
export function deleteComparison(id: string): void {
  const library = readLibrary(); find(library.comparisons, id);
  library.comparisons = library.comparisons.filter(item => item.id !== id); writeLibrary(library);
}
export function setComparisonFavorite(id: string, favorite: boolean): SavedComparison {
  if (typeof favorite !== 'boolean') throw new Error('Favorite must be true or false.');
  const library = readLibrary(); const entry = find(library.comparisons, id);
  entry.favorite = favorite; entry.updatedAt = new Date().toISOString(); writeLibrary(library); return clone(entry);
}
export function listBodyProfiles(): SavedBodyProfile[] { return readLibrary().bodies; }
export function saveBodyProfile(profile: BodyProfile, label: string, id?: string): SavedBodyProfile {
  const library = readLibrary(); const previous = id ? find(library.bodies, id) : undefined;
  const entry = { ...recordBase(label, previous), profile: validateProfile(profile) };
  library.bodies = replace(library.bodies, entry); writeLibrary(library); return clone(entry);
}
export function loadBodyProfile(id: string): BodyProfile { return clone(find(readLibrary().bodies, id).profile); }
export function deleteBodyProfile(id: string): void {
  const library = readLibrary(); find(library.bodies, id);
  library.bodies = library.bodies.filter(item => item.id !== id); writeLibrary(library);
}
export function listEquipmentProfiles(): SavedEquipmentProfile[] { return readLibrary().equipment; }
export function saveEquipmentProfile(setup: Setup, label: string, id?: string): SavedEquipmentProfile {
  const library = readLibrary(); const previous = id ? find(library.equipment, id) : undefined;
  const entry = { ...recordBase(label, previous), setup: validateSetup(setup) };
  library.equipment = replace(library.equipment, entry); writeLibrary(library); return clone(entry);
}
export function loadEquipmentProfile(id: string): Setup { return clone(find(readLibrary().equipment, id).setup); }
export function deleteEquipmentProfile(id: string): void {
  const library = readLibrary(); find(library.equipment, id);
  library.equipment = library.equipment.filter(item => item.id !== id); writeLibrary(library);
}
export function exportLibrary(): string { return JSON.stringify(readLibrary(), null, 2); }
/** Imported ID collisions receive new IDs; an import never silently overwrites a saved item. */
function merge<T extends NamedRecord>(existing: T[], incoming: T[]): T[] {
  const known = new Set(existing.map(item => item.id));
  const added = incoming.map(item => {
    const id = known.has(item.id) ? newId() : item.id;
    known.add(id); return { ...item, id };
  });
  return [...added, ...existing];
}
export function importLibrary(text: string, mode: 'merge' | 'replace' = 'merge'): { comparisons: number; bodies: number; equipment: number } {
  boundedText(text);
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error('The library file is not valid JSON.'); }
  const imported = validateLibrary(input);
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Choose merge or replace when importing a library.');
  if (mode === 'merge') {
    const existing = readLibrary();
    writeLibrary({ ...imported, comparisons: merge(existing.comparisons, imported.comparisons), bodies: merge(existing.bodies, imported.bodies), equipment: merge(existing.equipment, imported.equipment) });
  } else {
    // Replacement is explicit, and the complete previous library is recoverable.
    try {
      const previous = localStorage.getItem(LIBRARY_KEY);
      if (previous) preserveModelBackup(previous, LIBRARY_KEY);
    } catch (error) { throw storageError(error); }
    writeLibrary(imported);
  }
  return { comparisons: imported.comparisons.length, bodies: imported.bodies.length, equipment: imported.equipment.length };
}
