import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTraining } from './training';
import { readSelection, replaceSelectionWithBackup, saveSelection, SelectionProtectionError } from './selectionStorage';

const favorites = 'biomechanics.exercise-favorites';
const mappings = 'biomechanics.training-matches';
let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('protected catalog selections and training mappings', () => {
  it('preserves malformed favorites and mapping originals until explicit recovery', () => {
    for (const key of [favorites, mappings] as const) {
      const original = '{ unreadable original'; memory.set(key, original);
      const read = readSelection(key, []);
      expect(read.blocked).toBe(true);
      expect(read.error).toContain('original is retained');
      expect(read.value).toEqual([]);
      expect(() => saveSelection(key, [])).toThrow(SelectionProtectionError);
      expect(memory.get(key)).toBe(original);
      replaceSelectionWithBackup(key, []);
      expect(memory.get(key)).toBe('[]');
      expect([...memory].some(([savedKey, value]) => savedKey.startsWith(`${key}.recovery.`) && value === original)).toBe(true);
    }
  });
  it('rejects partial-invalid lists rather than silently discarding user records', () => {
    memory.set(favorites, JSON.stringify(['classic', 42]));
    expect(readSelection(favorites, []).blocked).toBe(true);
    const valid = parseTraining('Barbell row');
    memory.set(mappings, JSON.stringify([...valid, { id: 'bad', original: 42 }]));
    expect(readSelection(mappings, []).blocked).toBe(true);
    expect(() => saveSelection(mappings, valid)).toThrow(SelectionProtectionError);
    expect(JSON.parse(memory.get(mappings)!)).toHaveLength(2);
  });
  it('round-trips valid selections and confirmed compound exercise mappings', () => {
    saveSelection(favorites, ['classic', 'compound:row-barbell']);
    expect(readSelection(favorites, []).value).toEqual(['classic', 'compound:row-barbell']);
    const rows = parseTraining('Barbell row');
    saveSelection(mappings, rows);
    expect(readSelection(mappings, []).value).toEqual(rows);
    saveSelection('biomechanics.training-list', 'Barbell row\nCable curl');
    expect(readSelection('biomechanics.training-list', '').value).toBe('Barbell row\nCable curl');
  });
  it('does not replace the original if a recovery copy cannot be written', () => {
    memory.set(favorites, '{original');
    vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => replaceSelectionWithBackup(favorites, ['classic'])).toThrow('Quota exceeded');
    expect(memory.get(favorites)).toBe('{original');
  });
  it('surfaces unavailable storage and failed normal saves without claiming persistence', () => {
    memory.set(favorites, '["classic"]');
    vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => saveSelection(favorites, ['bench'])).toThrow('Quota exceeded');
    expect(memory.get(favorites)).toBe('["classic"]');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Access denied'); } });
    const result = readSelection(favorites, []);
    expect(result.blocked).toBe(true);
    expect(result.error).toContain('Access denied');
  });
});
