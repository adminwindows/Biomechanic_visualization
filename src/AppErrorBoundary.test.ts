import { describe, expect, it } from 'vitest';
import { captureAppRecovery } from './AppErrorBoundary';

describe('render-error recovery', () => {
  it('preserves exact unreadable app strings and backup keys without exposing unrelated storage', () => {
    const memory = new Map([['biomechanics.calibration-guide.v1', '{unreadable'], ['exercise-biomechanics-lab.comparison.v1', '{"version":999}'], ['biomechanics.machine-workspace.v1.backup.12', 'exact old snapshot'], ['unrelated-token', 'not an app record']]);
    const storage = { length: memory.size, key: (index: number) => [...memory.keys()][index], getItem: (key: string) => memory.get(key) ?? null };
    const recovered = JSON.parse(captureAppRecovery(storage));
    expect(recovered.entries).toEqual([...memory].slice(0, 3).map(([key, raw]) => ({ key, raw })));
    expect(captureAppRecovery(storage)).not.toContain('unrelated-token');
    expect(memory.get('biomechanics.calibration-guide.v1')).toBe('{unreadable');
  });
  it('propagates storage access errors so the UI cannot claim recovery was downloaded', () => {
    expect(() => captureAppRecovery({ length: 1, key: () => 'biomechanics.key', getItem: () => { throw new Error('Storage blocked'); } })).toThrow('Storage blocked');
  });
});
