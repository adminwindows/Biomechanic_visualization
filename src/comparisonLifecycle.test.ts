import { describe, expect, it, vi } from 'vitest';
import { createComparisonLifecycle } from './comparisonLifecycle';

describe('comparison persistence ownership', () => {
  it('saves initial and rapid live edits while advancing only after successful own writes', () => {
    let stored: string | null = null;
    const guard = createComparisonLifecycle(() => stored);
    expect(guard.write(() => { stored = 'first'; return true; })).toBe('saved');
    expect(guard.write(() => { stored = 'latest live state before reload'; return true; })).toBe('saved');
    expect(stored).toBe('latest live state before reload');
  });
  it('never recreates a cleared value or overwrites a restored/other-tab value', () => {
    for (const external of [null, 'restored comparison', '{malformed future original']) {
      let stored: string | null = 'own saved snapshot';
      const guard = createComparisonLifecycle(() => stored), save = vi.fn(() => true);
      stored = external;
      expect(guard.write(save)).toBe('changed'); expect(save).not.toHaveBeenCalled(); expect(stored).toBe(external);
    }
  });
  it('suspends on explicit restore even when restored bytes equal the old autosave', () => {
    let stored = 'old snapshot', live = 'new unsaved edits';
    const guard = createComparisonLifecycle(() => stored);
    guard.suspend();
    expect(guard.write(() => { stored = live; return true; })).toBe('suspended');
    expect(stored).toBe('old snapshot');
    expect(guard.rebase()).toBe(true);
    live = 'explicitly accepted replacement';
    expect(guard.write(() => { stored = live; return true; })).toBe('saved');
  });
  it('does not accept external replacement as a new baseline after a failed save', () => {
    let stored = 'own'; const guard = createComparisonLifecycle(() => stored);
    expect(guard.write(() => false)).toBe('failed'); stored = 'external';
    expect(guard.write(() => { stored = 'stale'; return true; })).toBe('changed'); expect(stored).toBe('external');
  });
  it('requires explicit recapture after unavailable storage instead of assuming an empty store', () => {
    let blocked = true, stored: string | null = 'real original';
    const guard = createComparisonLifecycle(() => { if (blocked) throw new Error('Denied'); return stored; });
    const save = vi.fn(() => { stored = 'new'; return true; });
    blocked = false; expect(guard.write(save)).toBe('unavailable'); expect(save).not.toHaveBeenCalled();
    expect(guard.rebase()).toBe(true); expect(guard.write(save)).toBe('saved');
  });
});
