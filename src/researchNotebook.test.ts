import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './state';
import { COMPOUND_KEY, initialCompound } from './compoundState';
import { MACHINE_WORKSPACE_KEY, createMachineWorkspace } from './machineLibrary';
import {
  RESEARCH_KEY, createResearchEntry, exportResearchNotebook, importResearchNotebook,
  listResearchEntries, parseResearchNotebook, recoverResearchNotebook, removeResearchEntry,
  researchSnapshot, restoreResearchEntry, updateResearchEntry, validateResearchDraft,
  captureResearchAttachment, restoreResearchAttachment, type ResearchDraft,
} from './researchNotebook';

let memory: Map<string, string>;
const draft = (patch: Partial<ResearchDraft> = {}): ResearchDraft => ({
  title: 'Higher outlet, same force', classification: 'hypothesis',
  hypothesis: 'Does changing only outlet height change resistance near overhead?',
  observation: 'External moments do not identify muscle-force sharing.', citations: [], ...patch,
});
beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('research snapshots and evidence notes', () => {
  it('keeps immutable independent snapshots while allowing notes to evolve', () => {
    const state = createInitialState();
    state.criterion = 'Resistance at the same overhead angle';
    const original = structuredClone(state);
    const saved = createResearchEntry(state, draft());
    state.setups[0].pulleyHeight = 3;
    saved.snapshot.setups[0].pulleyHeight = 4;
    const updated = updateResearchEntry(saved.id, draft({ title: 'Recorded finding', classification: 'calculation', observation: 'A signed external contribution changed.' }));
    expect(updated.snapshot).toEqual(original);
    expect(updated.id).toBe(saved.id);
    expect(updated.createdAt).toBe(saved.createdAt);
    expect(updated.classification).toBe('calculation');
    const restored = researchSnapshot(updated);
    restored.setups[0].hipX = 9;
    expect(listResearchEntries()[0].snapshot).toEqual(original);
  });

  it('round-trips citations, body provenance and comparison coordinates through portable JSON', () => {
    const state = createInitialState();
    state.motionMode = 'usable'; state.clearIntervalAnchors = [160, 160];
    const citation = { title: 'Torque method', url: 'https://openstax.org/books/university-physics-volume-1/pages/10-6-torque', note: 'Explains torque; does not compare training growth outcomes.' };
    createResearchEntry(state, draft({ classification: 'source', citations: [citation] }));
    const exported = exportResearchNotebook();
    memory.clear();
    expect(importResearchNotebook(exported)).toEqual({ added: 1, recalculated: 0 });
    expect(exportResearchNotebook()).toBe(exported);
    expect(listResearchEntries()[0].snapshot).toEqual(state);
  });

  it('merges colliding IDs without replacing saved evidence and exports individual entries', () => {
    const saved = createResearchEntry(createInitialState(), draft());
    const exported = exportResearchNotebook();
    updateResearchEntry(saved.id, draft({ observation: 'Keep this updated observation.' }));
    importResearchNotebook(exported);
    const entries = listResearchEntries();
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map(item => item.id)).size).toBe(2);
    expect(entries.find(item => item.id === saved.id)?.observation).toBe('Keep this updated observation.');
    expect(parseResearchNotebook(exportResearchNotebook([saved.id])).entries).toHaveLength(1);
  });

  it('separates empirical findings from uncited hypotheses and blocks unsafe citation URLs', () => {
    expect(() => validateResearchDraft(draft({ classification: 'study' }))).toThrow('needs a citation');
    expect(validateResearchDraft(draft({ classification: 'observation' })).classification).toBe('observation');
    const citation = { title: 'User supplied study', url: 'https://example.org/study', note: 'Population and protocol still need checking.' };
    expect(validateResearchDraft(draft({ classification: 'study', citations: [citation] })).classification).toBe('study');
    for (const url of ['javascript:alert(1)', 'data:text/html,body', 'https://user:secret@example.org', 'relative/path']) {
      expect(() => validateResearchDraft(draft({ citations: [{ ...citation, url }] }))).toThrow(/HTTP|HTTPS/);
    }
  });

  it('rejects malformed imports and leaves saved work unchanged', () => {
    createResearchEntry(createInitialState(), draft());
    const original = memory.get(RESEARCH_KEY);
    expect(() => importResearchNotebook('{broken')).toThrow('valid JSON');
    expect(() => importResearchNotebook(' '.repeat(2_000_001))).toThrow('2 MB');
    const duplicate = JSON.parse(exportResearchNotebook());
    duplicate.entries.push(duplicate.entries[0]);
    expect(() => importResearchNotebook(JSON.stringify(duplicate))).toThrow('duplicate identifiers');
    const invalid = JSON.parse(exportResearchNotebook());
    invalid.entries[0].snapshot.angles[0] = 900;
    expect(() => importResearchNotebook(JSON.stringify(invalid))).toThrow('finite number');
    expect(memory.get(RESEARCH_KEY)).toBe(original);
  });

  it('protects unreadable stored data until explicit backup-and-recovery', () => {
    const original = '{not a valid notebook';
    memory.set(RESEARCH_KEY, original);
    expect(() => listResearchEntries()).toThrow('original data has been kept');
    expect(() => createResearchEntry(createInitialState(), draft())).toThrow('original data has been kept');
    expect(memory.get(RESEARCH_KEY)).toBe(original);
    const backup = recoverResearchNotebook();
    expect(memory.get(backup!)).toBe(original);
    expect(listResearchEntries()).toEqual([]);
  });

  it('retains source model provenance and raw older data when saving migrated notes', () => {
    createResearchEntry(createInitialState(), draft());
    const old = JSON.parse(exportResearchNotebook());
    old.entries[0].sourceModelVersion = 'pullover-1';
    old.entries[0].snapshot.modelVersion = 'pullover-1';
    const original = JSON.stringify(old);
    memory.set(RESEARCH_KEY, original);
    const restored = listResearchEntries()[0];
    expect(restored.sourceModelVersion).toBe('pullover-1');
    expect(restored.snapshot.modelVersion).not.toBe('pullover-1');
    expect(memory.get(RESEARCH_KEY)).toBe(original);
    updateResearchEntry(restored.id, draft({ title: 'Migrated note' }));
    expect([...memory.entries()].find(([key]) => key.startsWith(`${RESEARCH_KEY}.model-backup.`))?.[1]).toBe(original);
  });

  it('supports deletion undo and reports storage failure without claiming success', () => {
    const saved = createResearchEntry(createInitialState(), draft());
    const removed = removeResearchEntry(saved.id);
    expect(listResearchEntries()).toEqual([]);
    expect(restoreResearchEntry(removed)).toEqual(saved);
    const previous = memory.get(RESEARCH_KEY);
    vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => updateResearchEntry(saved.id, draft({ title: 'Unstored change' }))).toThrow('Quota exceeded');
    expect(memory.get(RESEARCH_KEY)).toBe(previous);
  });
});


describe('compound and machine research sources', () => {
  const compound = () => initialCompound(createInitialState().profiles.map(profile => profile.values) as ReturnType<typeof initialCompound>['profiles']);

  it('preserves typed source snapshots through note editing and portable export', () => {
    const state = createInitialState(), source = compound();
    source.name = 'Coupled elbow comparison'; source.configs[0].loadMass = 31;
    const saved = createResearchEntry(state, draft(), { kind: 'compound', snapshot: source });
    source.configs[0].loadMass = 90;
    updateResearchEntry(saved.id, draft({ observation: 'Keep the original motion and masses.' }));
    const exported = exportResearchNotebook(); memory.clear(); importResearchNotebook(exported);
    const entry = listResearchEntries()[0];
    expect(entry.attachment?.kind).toBe('compound');
    if (entry.attachment?.kind !== 'compound') throw new Error('Missing compound attachment');
    expect(entry.attachment.snapshot.configs[0].loadMass).toBe(31);
    expect(entry.attachment.snapshot.name).toBe('Coupled elbow comparison');
    expect(entry.snapshot).toEqual(state);
  });

  it('captures the latest validated source and rejects unopened or malformed stores', () => {
    expect(() => captureResearchAttachment('machine')).toThrow('Open and configure');
    const source = createMachineWorkspace(); source.profiles[0].name = 'Measured comparison context';
    memory.set(MACHINE_WORKSPACE_KEY, JSON.stringify(source));
    const attachment = captureResearchAttachment('machine');
    expect(attachment.snapshot).toEqual(source);
    source.profiles[0].name = 'Later edit'; memory.set(MACHINE_WORKSPACE_KEY, JSON.stringify(source));
    expect(captureResearchAttachment('machine').snapshot).toEqual(source);
    expect(attachment.kind === 'machine' && attachment.snapshot.profiles[0].name).toBe('Measured comparison context');
    memory.set(MACHINE_WORKSPACE_KEY, '{broken');
    expect(() => captureResearchAttachment('machine')).toThrow('original has been kept');
    expect(memory.get(MACHINE_WORKSPACE_KEY)).toBe('{broken');
  });

  it('rejects invalid typed attachments before modifying the notebook', () => {
    createResearchEntry(createInitialState(), draft(), { kind: 'machine', snapshot: createMachineWorkspace() });
    const original = memory.get(RESEARCH_KEY), invalid = JSON.parse(exportResearchNotebook());
    invalid.entries[0].attachment.snapshot.angles[0] = 999;
    expect(() => importResearchNotebook(JSON.stringify(invalid))).toThrow('specified domain');
    invalid.entries[0].attachment.kind = 'arbitrary-storage';
    expect(() => importResearchNotebook(JSON.stringify(invalid))).toThrow('supported compound or machine');
    expect(memory.get(RESEARCH_KEY)).toBe(original);
  });

  it('restores only the selected workspace, backs up its original and preserves captured body dimensions', () => {
    const original = compound(); original.name = 'Current work';
    memory.set(COMPOUND_KEY, JSON.stringify(original)); memory.set(MACHINE_WORKSPACE_KEY, 'unrelated machine work');
    const source = compound(); source.profiles[0].upperArm = .37;
    const result = restoreResearchAttachment({ kind: 'compound', snapshot: source });
    expect(memory.get(result.backupKey!)).toBe(JSON.stringify(original));
    expect(JSON.parse(memory.get(COMPOUND_KEY)!)).toMatchObject({ useMainProfiles: false, profiles: [{ upperArm: .37 }, {}] });
    expect(source.useMainProfiles).toBe(true);
    expect(memory.get(MACHINE_WORKSPACE_KEY)).toBe('unrelated machine work');
    const machine = createMachineWorkspace(); machine.profiles[0].name = 'Saved machine';
    const restored = restoreResearchAttachment({ kind: 'machine', snapshot: machine });
    expect(memory.get(restored.backupKey!)).toBe('unrelated machine work');
    expect(JSON.parse(memory.get(MACHINE_WORKSPACE_KEY)!)).toEqual(machine);
  });

  it('does not overwrite a workspace when its recovery copy cannot be written', () => {
    const original = JSON.stringify(createMachineWorkspace()); memory.set(MACHINE_WORKSPACE_KEY, original);
    vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: () => { throw new Error('Storage full'); } });
    expect(() => restoreResearchAttachment({ kind: 'machine', snapshot: createMachineWorkspace() })).toThrow('could not be restored');
    expect(memory.get(MACHINE_WORKSPACE_KEY)).toBe(original);
  });
});
