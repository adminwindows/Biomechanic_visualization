import { describe, expect, it } from 'vitest';
import { MAX_TRAINING_BYTES, MAX_TRAINING_ROWS, matchExercise, parseTraining, resolveTrainingMatch } from './training';

describe('training exercise matching', () => {
  it('recognizes specific aliases without changing the original label', () => {
    const match = matchExercise('  LOW CABLE CURL  ');
    expect(match.original).toBe('  LOW CABLE CURL  ');
    expect(match.label).toBe('LOW CABLE CURL');
    expect(match.status).toBe('matched');
    expect(match.selectedPreset).toBe('curl-low');
  });
  it('leaves generic pulling ambiguous and retains unknown exercises', () => {
    expect(matchExercise('pull').status).toBe('ambiguous');
    expect(matchExercise('pull').selectedPreset).toBeUndefined();
    expect(matchExercise('Unspecified custom mechanism XYZ').status).toBe('unrecognized');
    expect(matchExercise('Barbell row').selectedPreset).toBe('compound:row-barbell');
  });
  it('accepts explicit user choices while preserving the source label', () => {
    const unknown = matchExercise('My custom prayer movement');
    const selected = resolveTrainingMatch(unknown, 'classic');
    expect(selected.selectedPreset).toBe('classic');
    expect(selected.original).toBe(unknown.original);
    expect(unknown.status).toBe('unrecognized');
    expect(() => resolveTrainingMatch(unknown, 'not-a-preset')).toThrow('supported catalog');
  });
  it('retains repeated labels with unique stable row IDs', () => {
    const items = parseTraining('Lat prayer\nLat prayer');
    expect(items[0].id).not.toBe(items[1].id);
    expect(parseTraining('Lat prayer\nLat prayer')).toEqual(items);
  });
});

describe('local text and CSV parsing', () => {
  it('parses plain lines without interpreting load-like text as a known exercise', () => {
    const items = parseTraining('Lat prayer\r\n\r\n30 kg\r\npull');
    expect(items.map(item => item.status)).toEqual(['ambiguous', 'unrecognized', 'ambiguous']);
    expect(items[1].original).toBe('30 kg');
  });
  it('parses quoted CSV cells, escaped quotes and multiline values', () => {
    const items = parseTraining('Exercise,Sets,Load\r\n"Lat prayer",3,20\r\n"Curl, cable",2,15\r\n"My ""special""\nmovement",3,5');
    expect(items).toHaveLength(3);
    expect(items[0].candidates).toEqual(expect.arrayContaining([expect.objectContaining({preset: 'classic'})]));
    expect(items[1].original).toBe('Curl, cable');
    expect(items[2].original).toBe('My "special"\nmovement');
    expect(items[2].status).toBe('unrecognized');
  });
  it('supports exercise_name headers, non-first columns, BOM and semicolon separators', () => {
    const items = parseTraining('\uFEFFsets;exercise_name;reps\n3;Lat prayer;10');
    expect(items).toHaveLength(1);
    expect(items[0].candidates).toEqual(expect.arrayContaining([expect.objectContaining({preset: 'classic'})]));
  });
  it('retains commas in plain names when no exercise header is supplied', () => {
    const items = parseTraining('My exercise, seated\nLat prayer');
    expect(items[0].original).toBe('My exercise, seated');
    expect(items[1].candidates).toEqual(expect.arrayContaining([expect.objectContaining({preset: 'classic'})]));
    expect(parseTraining('"My custom exercise')[0].original).toBe('"My custom exercise');
  });
  it('rejects invalid CSV and bounded oversized imports', () => {
    expect(() => parseTraining('Exercise,sets\n"Lat prayer,3')).toThrow('unclosed');
    expect(() => parseTraining('Sets,Exercise\n3')).toThrow('missing its exercise column');
    expect(() => parseTraining('x'.repeat(MAX_TRAINING_BYTES + 1))).toThrow('1 MB');
    expect(() => parseTraining('é'.repeat(MAX_TRAINING_BYTES / 2 + 1))).toThrow('1 MB');
    expect(() => parseTraining(Array(MAX_TRAINING_ROWS + 1).fill('Lat prayer').join('\n'))).toThrow('1000');
  });
});
