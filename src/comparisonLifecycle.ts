import { STORAGE_KEY } from './state';

export type ComparisonWriteResult = 'saved' | 'changed' | 'unavailable' | 'failed' | 'suspended';
/**
 * Prevent an old tab from replacing a removal, restore or other-tab write it has
 * observed. localStorage has no atomic compare-and-swap; this is an ownership
 * check immediately before a synchronous write, not cross-tab transaction locking.
 */
export function createComparisonLifecycle(read: () => string | null = () => localStorage.getItem(STORAGE_KEY)) {
  let expected: string | null = null, known = false, suspended = false;
  function rebase(): boolean {
    try { expected = read(); known = true; suspended = false; return true; }
    catch { known = false; return false; }
  }
  rebase();
  return {
    /** Call only after an explicit replacement decision and preservation of the old data. */
    rebase,
    /** Restoration deliberately wins even if its bytes equal a previous own save. */
    suspend() { suspended = true; },
    write(save: () => boolean): ComparisonWriteResult {
      if (suspended) return 'suspended';
      if (!known) return 'unavailable';
      try { if (read() !== expected) return 'changed'; }
      catch { known = false; return 'unavailable'; }
      try { if (!save()) return 'failed'; }
      catch { return 'failed'; }
      try { expected = read(); known = true; return 'saved'; }
      catch { known = false; return 'unavailable'; }
    },
  };
}
