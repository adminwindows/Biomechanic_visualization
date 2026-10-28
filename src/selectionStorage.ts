import { validateWorkspaceBackup } from './workspaceBackup';

export type SelectionKey = 'biomechanics.exercise-favorites' | 'biomechanics.training-list' | 'biomechanics.training-matches';
export class SelectionProtectionError extends Error {}
const label = (key: SelectionKey) => key.endsWith('exercise-favorites') ? 'Favorites' : key.endsWith('training-list') ? 'Exercise-list text' : 'Exercise mappings';
function validated<T>(key: SelectionKey, value: T): T {
  // Reuse the same bounded validators as portable workspace imports.
  return validateWorkspaceBackup({ format: 'biomechanics-workspace', version: 1, exportedAt: new Date().toISOString(), entries: [{ key, value }] }).entries[0].value as T;
}
const parse = <T,>(key: SelectionKey, raw: string) => validated<T>(key, (key === 'biomechanics.training-list' ? raw : JSON.parse(raw)) as T);
const serialize = <T,>(key: SelectionKey, value: T) => key === 'biomechanics.training-list' ? value as string : JSON.stringify(value);

export function readSelection<T>(key: SelectionKey, fallback: T): { value: T; blocked: boolean; error: string } {
  try {
    const raw = localStorage.getItem(key);
    return { value: raw === null ? fallback : parse<T>(key, raw), blocked: false, error: '' };
  } catch (error) {
    return { value: fallback, blocked: true, error: `${label(key)} could not be restored. The original is retained; edits stay in memory until saving is enabled. ${error instanceof Error ? error.message : 'Browser storage is unavailable.'}` };
  }
}

export function saveSelection<T>(key: SelectionKey, value: T): void {
  const next = serialize(key, validated(key, value));
  const previous = localStorage.getItem(key);
  if (previous !== null) {
    try { parse(key, previous); }
    catch { throw new SelectionProtectionError(`${label(key)} contains unreadable saved data. Its original is retained; preserve it before enabling saving.`); }
  }
  localStorage.setItem(key, next);
}

/** Explicit replacement preserves the exact original before any active-data write. */
export function replaceSelectionWithBackup<T>(key: SelectionKey, value: T): void {
  const next = serialize(key, validated(key, value));
  const previous = localStorage.getItem(key);
  if (previous !== null) {
    const base = `${key}.recovery.${Date.now()}`;
    let backup = base, suffix = 0;
    while (localStorage.getItem(backup) !== null) backup = `${base}.${++suffix}`;
    localStorage.setItem(backup, previous);
  }
  localStorage.setItem(key, next);
}
